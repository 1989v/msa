import { displayDescription, type GameDetail, type MyGameRecord, type ReleaseNote } from '../../api/gameApi';
import { StarRating, StarRatingInput, starsFromHalves } from './StarRating';
import type { GameLang } from '../../api/gameApi';

/**
 * 상세 화면의 정보 패널 셋 — 랭킹 / 내 기록 / 평가.
 *
 * **좁은 화면에서는 탭으로 접는다.** 셋을 세로로 쌓으면 첫 화면에서 플레이 버튼이
 * 스크롤 아래로 밀린다 — 게임을 하러 온 사람이 먼저 만나는 것이 정보 더미가 되면 안 된다.
 * 넓은 화면에서는 접을 이유가 없으므로 셋을 한 번에 편다(CSS 가 담당).
 */
function minutes(sec: number, lang: GameLang): string {
  const m = Math.round(sec / 60);
  if (sec < 60) return lang === 'en' ? 'under a minute' : '1분 미만';
  if (m < 60) return lang === 'en' ? `${m} min` : `${m}분`;
  const h = Math.floor(m / 60);
  return lang === 'en' ? `${h}h ${m % 60}m` : `${h}시간 ${m % 60}분`;
}

function sinceLabel(iso: string | null, lang: GameLang): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (lang === 'en') return days <= 0 ? 'today' : `${days}d ago`;
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

/**
 * 정보 패널 셋 — 평가 / 랭킹 / 내 기록.
 *
 * **탭을 쓰지 않는다.** 넓은 화면은 2단이라 접을 이유가 없고, 좁은 화면에서는
 * 썸네일과 플레이 버튼이 이미 첫 화면을 차지하므로 그 아래는 스크롤로 읽는 편이
 * 자연스럽다. 탭은 "무엇이 있는지" 를 감춘다.
 *
 * 배치는 페이지가 정한다 — 여기서는 각 조각이 자기 내용만 안다.
 */
export function GameAboutPanel({ game, lang, favorites }: {
  game: GameDetail;
  lang: GameLang;
  favorites: number | null;
}) {
  return (
    <section className="game-panel" aria-labelledby="game-about-heading">
      <h2 className="game-panel-title" id="game-about-heading">{lang === 'en' ? 'About' : '소개'}</h2>
      <div className="game-rating-summary">
        {/* ratingAvg 는 BE 척도(halves 1~10) 다 — 별과 숫자가 같은 축을 써야 9.1 과 4.6 이 함께 뜨지 않는다 */}
        {game.ratingCount > 0 && (
          <>
            <StarRating value={starsFromHalves(game.ratingAvg)} />
            <span className="game-rating-figure">
              {starsFromHalves(game.ratingAvg).toFixed(1)}
              <span className="game-stat-sub"> ({game.ratingCount.toLocaleString()}{lang === 'en' ? '' : '표'})</span>
            </span>
          </>
        )}
        {favorites != null && favorites > 0 && (
          <span className="game-stat-sub">♡ {favorites.toLocaleString()}</span>
        )}
      </div>
      <p className="game-about-body">{displayDescription(game, lang)}</p>
    </section>
  );
}

/** 평점 매기기 — 내 기록과 한 줄에 서므로 소개에서 떼어 낸다 */
export function GameRatePanel({ myHalves, onRate, ratingMessage, lang }: {
  myHalves: number | null;
  onRate: (halves: number) => void;
  ratingMessage: string | null;
  lang: GameLang;
}) {
  return (
    <section className="game-panel" aria-labelledby="game-rate-heading">
      {/* 별만 늘어놓으면 보여주는 것인지 누르는 것인지 모른다 — 무엇을 하는 자리인지 적는다 */}
      <h2 className="game-panel-title" id="game-rate-heading">
        {myHalves != null
          ? (lang === 'en' ? 'Your rating' : '내 평가')
          : (lang === 'en' ? 'Rate this game' : '이 게임을 평가하기')}
      </h2>
      <StarRatingInput halves={myHalves} onRate={onRate} lang={lang} />
      {/* 게스트도 한 번은 매길 수 있다 — 안 적으면 로그인해야 하는 줄 알고 지나친다 */}
      <p className="game-panel-note">
        {lang === 'en'
          ? 'You can rate once from this device without signing in.'
          : '로그인 없이도 이 기기에서 한 번 평가할 수 있습니다.'}
      </p>
      {ratingMessage && <p className="game-panel-note">{ratingMessage}</p>}
    </section>
  );
}

export function GameMyRecordPanel({ record, loggedIn, lang }: {
  record: MyGameRecord | null;
  loggedIn: boolean;
  lang: GameLang;
}) {
  return (
    <section className="game-panel" aria-labelledby="game-my-record-heading">
      <h2 className="game-panel-title" id="game-my-record-heading">
        {lang === 'en' ? 'My record' : '내 기록'}
      </h2>
      {!loggedIn ? (
        <p className="game-panel-note">
          {lang === 'en' ? 'Sign in to keep your record.' : '로그인하면 내 기록이 남습니다.'}
        </p>
      ) : !record ? (
        <p className="game-panel-note">{lang === 'en' ? 'Loading…' : '불러오는 중…'}</p>
      ) : record.plays === 0 ? (
        <p className="game-panel-note">{lang === 'en' ? 'No plays yet.' : '아직 플레이 기록이 없습니다.'}</p>
      ) : (
        <>
          <dl className="game-stat-grid">
            <div>
              <dt>{lang === 'en' ? 'Plays' : '플레이'}</dt>
              <dd>{record.plays.toLocaleString()}{lang === 'en' ? '' : '회'}</dd>
            </div>
            <div>
              <dt>{lang === 'en' ? 'Total time' : '총 시간'}</dt>
              <dd>{minutes(record.totalSeconds, lang)}</dd>
            </div>
            {record.bestScore != null && (
              <div>
                <dt>{lang === 'en' ? 'Best' : '내 최고'}</dt>
                <dd>
                  {record.bestScore.toLocaleString()}
                  {record.bestRank != null && (
                    <span className="game-stat-sub">
                      {lang === 'en' ? ` · #${record.bestRank}` : ` · ${record.bestRank}위`}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {sinceLabel(record.lastPlayedAt, lang) && (
              <div>
                <dt>{lang === 'en' ? 'Last played' : '마지막 플레이'}</dt>
                <dd>{sinceLabel(record.lastPlayedAt, lang)}</dd>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}

/**
 * 버전별 업데이트 노트 — 전 게임 공통.
 *
 * 노트가 없으면 판 자체를 그리지 않는다. 「업데이트 없음」을 보여줄 이유가 없고,
 * 대부분의 게임이 아직 노트가 없어서 빈 판이 기본 상태가 되어 버린다.
 */
export function GameReleaseNotesPanel({ notes, lang }: { notes: ReleaseNote[]; lang: GameLang }) {
  if (notes.length === 0) return null;
  return (
    <section className="game-panel" aria-labelledby="game-notes-heading">
      <h2 className="game-panel-title" id="game-notes-heading">
        {lang === 'en' ? 'Update notes' : '업데이트 노트'}
      </h2>
      <ol className="game-notes">
        {notes.map((n) => (
          <li key={n.version} className="game-note">
            <p className="game-note-head">
              <span className="game-note-version">{n.version}</span>
              <span className="game-stat-sub">{n.releasedAt}</span>
            </p>
            {/* 본문은 문단이다 — 줄바꿈을 살려야 「무엇이 왜 바뀌었나」가 읽힌다 */}
            <p className="game-note-body">{(lang === 'en' && n.bodyEn) || n.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
