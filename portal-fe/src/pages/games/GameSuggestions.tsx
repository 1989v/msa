import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createSuggestion,
  editSuggestion,
  fetchSuggestions,
  replyToSuggestion,
  resolveGameNickname,
  setGameNickname,
  type GameLang,
  type GameSuggestion,
  type SuggestionStatus,
} from '../../api/gameApi';

/**
 * 게임별 개선 제안.
 *
 * 읽기는 누구나, 쓰기는 로그인해야 한다. 본문·처리 상태·답변이 전부 공개라
 * 「이 제안이 어떻게 됐는지」를 남이 봐도 알 수 있다.
 *
 * 입력·버튼·배지는 `.kh-*` 프리미티브를 그대로 쓴다 — 입력에 상자를 두르면 지면이 서식처럼
 * 보인다는 것이 이 디자인의 판단이고(`docs/design/k-heritage.html`), 화면마다 자기 폼을
 * 그리면 그 판단이 화면 수만큼 갈린다.
 *
 * 표시 이름은 랭킹에 쓰는 것과 같은 값(`game_nickname`)이다. 아직 없으면 회원 닉네임을
 * 받아 채우고, 그것도 못 받으면 그 자리에서 입력받는다 — 제안을 쓰려던 사람을
 * 다른 화면으로 보내지 않는다.
 */

const STATUS_LABEL: Record<SuggestionStatus, { ko: string; en: string }> = {
  OPEN: { ko: '접수', en: 'Received' },
  REVIEWING: { ko: '검토중', en: 'Reviewing' },
  APPLIED: { ko: '반영', en: 'Applied' },
  DECLINED: { ko: '반려', en: 'Declined' },
};

const MIN_BODY = 5;
const MAX_BODY = 500;
const MAX_REPLY = 1000;

function when(iso: string | null, lang: GameLang): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (lang === 'en') return days <= 0 ? 'today' : `${days}d ago`;
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

function StatusBadge({ status, lang }: { status: SuggestionStatus; lang: GameLang }) {
  return (
    <span className={`game-suggestion-badge is-${status.toLowerCase()}`}>
      {lang === 'en' ? STATUS_LABEL[status].en : STATUS_LABEL[status].ko}
    </span>
  );
}

/** 한 건의 답글 줄기. 운영자 배지는 이름이 아니라 authorType 이 그린다 */
function ReplyThread({ item, lang }: { item: GameSuggestion; lang: GameLang }) {
  if (item.replies.length === 0) return null;
  return (
    <ul className="game-suggestion-replies">
      {item.replies.map((reply) => (
        <li key={reply.id} className={`game-suggestion-reply is-${reply.authorType.toLowerCase()}`}>
          <span className="game-suggestion-reply-who">
            {reply.authorType === 'OPERATOR'
              ? (lang === 'en' ? 'Operator' : '운영자')
              : reply.authorName}
          </span>
          <span className="game-suggestion-when">{when(reply.createdAt, lang)}</span>
          <p className="game-suggestion-reply-body">{reply.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function GameSuggestionsPanel({ slug, lang, loggedIn }: {
  slug: string;
  lang: GameLang;
  loggedIn: boolean;
}) {
  const [items, setItems] = useState<GameSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [nickname, setNickname] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const t = useCallback((ko: string, en: string) => (lang === 'en' ? en : ko), [lang]);

  const reload = useCallback(() => {
    let alive = true;
    setLoading(true);
    fetchSuggestions(slug)
      .then((page) => alive && setItems(page.content ?? []))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    // 게임을 옮기면 먼저 비운다 — 안 그러면 새 게임 화면에 앞 게임의 제안이 잠깐 남는다
    setItems([]);
    setEditing(null);
    setReplyingTo(null);
    return reload();
  }, [reload]);

  // 이름은 쓰려는 사람에게만 필요하다 — 비로그인 방문자에게 회원 API 를 부르지 않는다
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    resolveGameNickname().then((n) => alive && setNickname(n));
    return () => {
      alive = false;
    };
  }, [loggedIn]);

  function fail(error: unknown) {
    const detail = (error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message;
    setMessage(detail ?? t('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Could not save. Please try again.'));
  }

  async function submit() {
    if (!nickname || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await createSuggestion(slug, nickname, body);
      setBody('');
      reload();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: number) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await editSuggestion(slug, id, editBody);
      setEditing(null);
      reload();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(id: number) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await replyToSuggestion(slug, id, replyBody);
      setReplyingTo(null);
      setReplyBody('');
      reload();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="game-panel game-suggestions" aria-labelledby="game-suggestions-heading">
      <h2 className="game-panel-title" id="game-suggestions-heading">
        {t('개선 제안', 'Suggestions')}
      </h2>
      <p className="game-panel-note">
        {t(
          '불편했던 점이나 바꿨으면 하는 것을 한 가지씩 적어 주세요. 확인하면 상태가 바뀌고 답변이 달립니다.',
          'Tell us one thing you would change. We mark what we read and reply here.',
        )}
      </p>

      {!loggedIn ? (
        <p className="game-panel-note">
          <Link to={`/login?next=${encodeURIComponent(window.location.href)}`}>
            {t('로그인', 'Sign in')}
          </Link>
          {t('하면 제안을 남길 수 있습니다.', ' to leave a suggestion.')}
        </p>
      ) : nickname == null ? (
        /* 회원 닉네임을 못 받았을 때만 물어본다 — 평소에는 이 줄이 보이지 않는다 */
        <div className="game-suggestion-nick">
          <label htmlFor="game-suggestion-nick-input">{t('표시할 이름', 'Display name')}</label>
          <input
            className="kh-field"
            id="game-suggestion-nick-input"
            type="text"
            maxLength={16}
            value={nicknameDraft}
            onChange={(e) => setNicknameDraft(e.target.value)}
            placeholder={t('2~16자', '2-16 chars')}
          />
          <button className="kh-button" type="button" onClick={() => setNickname(setGameNickname(nicknameDraft))}>
            {t('저장', 'Save')}
          </button>
        </div>
      ) : (
        <form
          className="game-suggestion-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {/* 500자 상한의 짧은 글이라 두 줄로 연다 — 첫 화면의 큰 빈 칸은 쓰라는 신호가
              아니라 채워야 할 분량으로 읽힌다. 길게 쓰면 세로로 늘릴 수 있다. */}
          <textarea
            className="kh-field"
            aria-label={t('개선 제안 내용', 'Your suggestion')}
            rows={2}
            maxLength={MAX_BODY}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('예) 2스테이지 보스가 너무 빠릅니다', 'e.g. The stage 2 boss is too fast')}
          />
          <div className="game-suggestion-formfoot">
            {/* 이름은 랭킹과 같은 값이라 여기서 다시 묻지 않는다 — 무엇으로 올라가는지만 알린다 */}
            <span className="game-suggestion-who">{nickname}</span>
            <span className="game-suggestion-count">{body.trim().length}/{MAX_BODY}</span>
            <button className="kh-button" type="submit" disabled={busy || body.trim().length < MIN_BODY}>
              {t('제안 등록', 'Submit')}
            </button>
          </div>
        </form>
      )}

      {message && <p className="game-panel-note">{message}</p>}

      {loading ? (
        <p className="game-panel-note">{t('불러오는 중…', 'Loading…')}</p>
      ) : items.length === 0 ? (
        <p className="game-panel-note">{t('아직 등록된 제안이 없습니다.', 'No suggestions yet.')}</p>
      ) : (
        <ul className="game-suggestion-list">
          {items.map((item) => (
            <li key={item.id} className="game-suggestion">
              <div className="game-suggestion-head">
                <span className="game-suggestion-who">{item.nickname}</span>
                <span className="game-suggestion-when">{when(item.createdAt, lang)}</span>
                {item.edited && (
                  <span className="game-suggestion-edited">{t('수정됨', 'edited')}</span>
                )}
                <StatusBadge status={item.status} lang={lang} />
              </div>

              {editing === item.id ? (
                <div className="game-suggestion-edit">
                  <textarea
                    className="kh-field"
                    aria-label={t('제안 수정', 'Edit suggestion')}
                    rows={3}
                    maxLength={MAX_BODY}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <div className="game-suggestion-actions">
                    <button
                      className="kh-button"
                      type="button"
                      disabled={busy || editBody.trim().length < MIN_BODY}
                      onClick={() => void saveEdit(item.id)}
                    >
                      {t('저장', 'Save')}
                    </button>
                    <button className="kh-button kh-button-ghost" type="button" onClick={() => setEditing(null)}>
                      {t('취소', 'Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="game-suggestion-body">{item.body}</p>
              )}

              <ReplyThread item={item} lang={lang} />

              {replyingTo === item.id && (
                <div className="game-suggestion-edit">
                  <textarea
                    className="kh-field"
                    aria-label={t('답글', 'Reply')}
                    rows={2}
                    maxLength={MAX_REPLY}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />
                  <div className="game-suggestion-actions">
                    <button
                      className="kh-button"
                      type="button"
                      disabled={busy || replyBody.trim().length === 0}
                      onClick={() => void sendReply(item.id)}
                    >
                      {t('답글 등록', 'Reply')}
                    </button>
                    <button className="kh-button kh-button-ghost" type="button" onClick={() => setReplyingTo(null)}>
                      {t('취소', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}

              {/* 수정·답글은 내 글에만 뜬다. 서버도 같은 판정을 하므로 이 버튼이 권한은 아니다 */}
              {item.mine && editing !== item.id && replyingTo !== item.id && (
                <div className="game-suggestion-actions">
                  <button
                    className="kh-button kh-button-ghost"
                    type="button"
                    onClick={() => {
                      setEditing(item.id);
                      setEditBody(item.body);
                    }}
                  >
                    {t('수정', 'Edit')}
                  </button>
                  <button className="kh-button kh-button-ghost" type="button" onClick={() => setReplyingTo(item.id)}>
                    {t('답글', 'Reply')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
