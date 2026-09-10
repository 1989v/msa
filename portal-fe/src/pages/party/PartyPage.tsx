import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { gamePath } from '../../seo/copy.mjs';
import { displayTitle, getGameLang, listGames, type GameSummary } from '../../api/gameApi';
import { getAccessToken } from '../../auth/auth';
import {
  castBallot,
  fetchRosters,
  openVote,
  saveFriendGroup,
  setRosterOptIn,
  type FriendGroup,
  type SeatAuth,
  type VoteView,
} from '../../api/partyApi';
import { PARTY_MODES, writeParty, type PartyMode } from '../games/party';
import {
  candidates,
  isInteractive,
  randomFrom,
  votingApplies,
  type Branch,
  type PartyGame,
} from './gameChoice';
import { encodeQr, qrSvgPath } from './qr';
import {
  canStart,
  fromGroup,
  MAX_WEIGHT,
  players,
  setMode,
  setPick,
  setWeight,
  toHandoff,
  toggle,
  type RoundConfig,
} from './roundConfig';
import { inviteLink } from './partyRelay';
import { usePartyRoom } from './usePartyRoom';
import './party.css';

/**
 * 파티 세션 (ADR-0092) — 친구끼리 뭔가 정할 때 여는 자리.
 *
 * 한 화면이 두 역할을 한다. `/party` 는 **방장**, `/party/:room` 은 **참가자**다.
 * 방장은 명부를 만들고 게임을 정하고 시작하며, 참가자는 명부에서 자기 이름을 고르고 기다린다.
 *
 * **이름은 서버로 가지 않는다.** 명부는 방장 기기에서 릴레이를 거쳐 참가자에게 전달될 뿐이고,
 * 릴레이는 `d` 를 열어보지 않는다. 계정 저장을 켠 사람의 친구 그룹만 서버에 남는다.
 */

/** 방 자리 수 — 명부 상한(12)에 관전 여유를 더한다. 릴레이 상한은 20 */
const SEATS = 16;

const MANUAL_GROUP = -1;

type Phase = 'setup' | 'branch' | 'vote' | 'ready';

export default function PartyPage() {
  const { room: roomParam } = useParams<{ room?: string }>();
  const isHost = !roomParam;
  const navigate = useNavigate();
  const lang = getGameLang();

  const net = usePartyRoom();
  const { room, host, join, shareRoster, claimName, startRound } = net;

  const [games, setGames] = useState<PartyGame[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [optedIn, setOptedIn] = useState(false);
  const [groupId, setGroupId] = useState<number>(MANUAL_GROUP);
  const [manualText, setManualText] = useState('');
  const [config, setConfig] = useState<RoundConfig>(() => fromGroup([]));
  const [phase, setPhase] = useState<Phase>('setup');
  const [branch, setBranch] = useState<Branch>('pick');
  const [vote, setVote] = useState<VoteView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const signedIn = Boolean(getAccessToken());
  const startedRef = useRef(false);

  /* 방은 화면에 들어오는 즉시 연다 — 설정하는 동안 사람들이 들어와 있게 하려면
     초대 링크가 먼저 있어야 한다. 방장/참가자 각각 한 번만 붙는다. */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (isHost) host(SEATS);
    else join(roomParam!);
  }, [host, isHost, join, roomParam]);

  /* 카탈로그에서 명부 규약을 구현한 게임을 받아 온다 — 목록을 하드코딩하면
     새 게임이 붙어도 여기 손대기 전까지 안 보인다 */
  useEffect(() => {
    listGames({ size: 200 })
      .then((page) => {
        setGames(page.content.map((g) => ({ slug: g.slug, title: displayTitle(g, lang), tags: g.tags })));
        setTitles(
          Object.fromEntries(page.content.map((g: GameSummary) => [g.slug, displayTitle(g, lang)])),
        );
      })
      .catch(() => setNotice('게임 목록을 불러오지 못했습니다. 새로고침해 주세요.'));
  }, [lang]);

  useEffect(() => {
    if (!isHost || !signedIn) return;
    fetchRosters()
      .then((r) => {
        setOptedIn(r.optedIn);
        setGroups(r.groups);
      })
      .catch(() => undefined);
  }, [isHost, signedIn]);

  /* 명부가 바뀌면 방에 다시 뿌린다 — 늦게 들어온 사람도 같은 목록을 본다 */
  const names = useMemo(() => players(config).map((e) => e.alias), [config]);
  useEffect(() => {
    if (isHost && room.room) shareRoster(names);
    // shareRoster 는 소켓 전송이라 의존성에 넣으면 매 렌더 재전송이 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, room.room, names.join('')]);

  const applyGroup = (id: number) => {
    setGroupId(id);
    const group = groups.find((g) => g.id === id);
    if (group) setConfig(fromGroup(group.aliases));
  };

  const applyManual = (text: string) => {
    setManualText(text);
    const list = text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    setConfig((prev) => {
      // 이미 켜고 끈 것과 비율은 이름이 같으면 유지한다 — 오타 하나 고쳤다고 초기화되면 안 된다
      const kept = new Map(prev.entries.map((e) => [e.alias, e]));
      return {
        ...prev,
        entries: list.map((alias) => kept.get(alias) ?? { alias, included: true, weight: 1 }),
      };
    });
  };

  /* ── 게임 선정 ─────────────────────────────────────────── */

  const pool = useMemo(() => candidates(games, branch), [games, branch]);

  const beginRound = useCallback(
    (slug: string) => {
      if (startedRef.current) return;
      startedRef.current = true;
      const handoff = toHandoff(config, room.room ?? undefined);
      writeParty(slug, handoff.names, handoff.mode, {
        pick: handoff.pick,
        weights: handoff.weights,
        room: handoff.room,
      });
      startRound({ game: slug, ...handoff });
      navigate(gamePath(lang, `/games/${slug}`));
    },
    [config, lang, navigate, room.room, startRound],
  );

  const seatAuth: SeatAuth | null =
    room.room && room.seat >= 0 && room.token
      ? { room: room.room, seat: room.seat, token: room.token }
      : null;

  const beginVote = async () => {
    if (!seatAuth) return;
    const slugs = pool.map((g) => g.slug);
    if (slugs.length < 2) {
      setNotice('투표에 올릴 참여형 게임이 둘 이상이어야 합니다.');
      return;
    }
    try {
      setVote(await openVote(seatAuth, slugs));
      setPhase('vote');
    } catch {
      setNotice('투표를 열지 못했습니다.');
    }
  };

  const submitBallot = async (slug: string) => {
    if (!seatAuth) return;
    try {
      setVote(await castBallot(seatAuth, slug));
    } catch {
      setNotice('표를 내지 못했습니다.');
    }
  };

  /* 투표가 마감되면 방장이 그 게임으로 판을 연다 — 참가자는 start 메시지로 따라온다 */
  useEffect(() => {
    if (isHost && vote && !vote.open && vote.winner) beginRound(vote.winner);
  }, [beginRound, isHost, vote]);

  /* 참가자: 방장이 판을 열면 인계를 기록하고 게임으로 간다 */
  useEffect(() => {
    if (isHost || !room.cfg || startedRef.current) return;
    const cfg = room.cfg as {
      game?: string;
      names?: string[];
      mode?: PartyMode;
      pick?: number;
      weights?: number[];
      room?: string;
    };
    if (!cfg.game) return;
    startedRef.current = true;
    writeParty(cfg.game, cfg.names ?? [], cfg.mode ?? 'last', {
      pick: cfg.pick,
      weights: cfg.weights,
      room: cfg.room ?? room.room ?? undefined,
    });
    navigate(gamePath(lang, `/games/${cfg.game}`));
  }, [isHost, lang, navigate, room.cfg, room.room]);

  /* ── 그리기 ────────────────────────────────────────────── */

  const link = room.room ? inviteLink(room.room) : '';
  const qr = useMemo(() => {
    if (!link) return null;
    try {
      const grid = encodeQr(link);
      return { size: grid.length, path: qrSvgPath(grid) };
    } catch {
      return null;
    }
  }, [link]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setNotice('복사가 막혀 있습니다. 주소를 길게 눌러 복사하세요.');
    }
  };

  const saveGroup = async () => {
    const name = window.prompt('이 그룹을 뭐라고 부를까요?');
    if (!name) return;
    try {
      const saved = await saveFriendGroup({ name, aliases: config.entries.map((e) => e.alias) });
      setGroups((prev) => [...prev.filter((g) => g.id !== saved.id), saved]);
      setGroupId(saved.id);
      setNotice(`「${saved.name}」 저장했습니다.`);
    } catch {
      setNotice('저장하지 못했습니다. 같은 이름의 그룹이 있는지 확인해 주세요.');
    }
  };

  const toggleOptIn = async (enabled: boolean) => {
    try {
      const r = await setRosterOptIn(enabled);
      setOptedIn(r.optedIn);
      setGroups(r.groups);
      if (!enabled) setNotice('계정 저장을 껐습니다. 서버에 있던 그룹은 지웠습니다.');
    } catch {
      setNotice('설정을 바꾸지 못했습니다.');
    }
  };

  const myName = room.seat >= 0 ? room.roster.taken[room.seat] : undefined;

  return (
    <div className="party-page kh-arcade">
      <header className="party-header">
        <h1>내기용 게임</h1>
        <p>{isHost ? '친구를 부르고, 뭘 할지 정하고, 한 판으로 끝낸다.' : '들어왔습니다. 이름을 고르세요.'}</p>
      </header>

      {room.error && <p className="party-alert">{room.error}</p>}
      {room.lost && (
        <p className="party-alert">
          방과 연결이 끊겼습니다. {isHost ? '새 방을 열어 다시 초대하세요.' : '방장에게 링크를 다시 받으세요.'}
        </p>
      )}
      {notice && <p className="party-notice">{notice}</p>}

      {/* 초대 — 방 코드는 설정하는 내내 보인다. 나중에 보여 주면 그때까지 아무도 못 들어온다 */}
      <section className="party-invite" aria-label="초대">
        {room.room ? (
          <>
            <div className="party-code-block">
              <span className="party-code-label">방 코드</span>
              <strong className="party-code">{room.room}</strong>
              <button type="button" className="party-copy" onClick={copyLink}>
                {copied ? '복사됨' : '링크 복사'}
              </button>
            </div>
            {qr && (
              <svg
                className="party-qr"
                viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`}
                role="img"
                aria-label="초대 링크 QR"
              >
                <rect x={-2} y={-2} width={qr.size + 4} height={qr.size + 4} fill="#fff" />
                <path d={qr.path} fill="#000" />
              </svg>
            )}
          </>
        ) : (
          <p className="party-status">방을 여는 중…</p>
        )}
      </section>

      {/* 자리 — 누가 들어와 어떤 이름을 골랐는지.
          방장 혼자일 때는 그리지 않는다: 「들어온 사람 0」 한 줄이 카드 하나를 차지해
          390px 화면에서 정작 할 일(명부)이 접힌 아래로 밀린다(실측). */}
      {(room.occupied.length > 1 || !isHost) && (
      <section className="party-seats" aria-label="참가자">
        <h2>들어온 사람 {room.occupied.length}</h2>
        <ul>
          {room.occupied.map((seat) => (
            <li key={seat} className={seat === room.seat ? 'me' : ''}>
              <span className="party-seat-no">{seat + 1}</span>
              <span className="party-seat-name">{room.roster.taken[seat] ?? '이름 고르는 중…'}</span>
              {seat === 0 && <span className="party-seat-tag">방장</span>}
            </li>
          ))}
        </ul>
      </section>
      )}

      {!isHost && (
        <section className="party-claim" aria-label="이름 고르기">
          <h2>{myName ? `${myName} 님으로 참가` : '명부에서 자기 이름을 고르세요'}</h2>
          {room.roster.names.length === 0 ? (
            <p className="party-status">방장이 명부를 정하는 중입니다…</p>
          ) : (
            <div className="party-name-grid">
              {room.roster.names.map((name) => {
                const takenBy = Object.entries(room.roster.taken).find(([, v]) => v === name)?.[0];
                const mine = takenBy !== undefined && Number(takenBy) === room.seat;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`party-name-btn ${mine ? 'mine' : ''}`}
                    disabled={takenBy !== undefined && !mine}
                    onClick={() => claimName(name)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          {vote && (
            <VotePanel vote={vote} titles={titles} onCast={submitBallot} />
          )}
          <p className="party-status">방장이 시작하면 자동으로 넘어갑니다.</p>
        </section>
      )}

      {isHost && phase === 'setup' && (
        <section className="party-roster" aria-label="명부">
          <h2>누가 하나</h2>

          {signedIn ? (
            <div className="party-group-row">
              <label>
                <span className="party-field-label">친구 그룹</span>
                <select value={groupId} onChange={(e) => applyGroup(Number(e.target.value))}>
                  <option value={MANUAL_GROUP}>직접 입력</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.aliases.length})
                    </option>
                  ))}
                </select>
              </label>
              <label className="party-optin">
                <input
                  type="checkbox"
                  checked={optedIn}
                  onChange={(e) => toggleOptIn(e.target.checked)}
                />
                <span>이 계정에 그룹 저장</span>
              </label>
              {optedIn && config.entries.length > 0 && (
                <button type="button" className="party-ghost" onClick={saveGroup}>
                  지금 명부를 그룹으로 저장
                </button>
              )}
            </div>
          ) : (
            <p className="party-status">
              로그인하면 친구 그룹을 저장해 다음에도 씁니다. 지금은 직접 입력으로 진행합니다.
            </p>
          )}

          {groupId === MANUAL_GROUP && (
            <label className="party-manual">
              <span className="party-field-label">이름 (줄바꿈 또는 쉼표)</span>
              <textarea
                rows={4}
                value={manualText}
                onChange={(e) => applyManual(e.target.value)}
                placeholder={'민수\n영희\n철수'}
              />
            </label>
          )}

          {config.entries.length > 0 && (
            <>
              {/* 그룹에서 뺀다고 그룹이 바뀌지는 않는다 — 이번 판에서만이다 */}
              <ul className="party-entries">
                {config.entries.map((entry, i) => (
                  <li key={entry.alias} className={entry.included ? '' : 'out'}>
                    <label className="party-entry-name">
                      <input
                        type="checkbox"
                        checked={entry.included}
                        onChange={() => setConfig((c) => toggle(c, i))}
                      />
                      <span>{entry.alias}</span>
                    </label>
                    <span className="party-weight">
                      <button
                        type="button"
                        aria-label={`${entry.alias} 비율 낮추기`}
                        onClick={() => setConfig((c) => setWeight(c, i, entry.weight - 1))}
                        disabled={!entry.included || entry.weight <= 1}
                      >
                        −
                      </button>
                      <b>×{entry.weight}</b>
                      <button
                        type="button"
                        aria-label={`${entry.alias} 비율 올리기`}
                        onClick={() => setConfig((c) => setWeight(c, i, entry.weight + 1))}
                        disabled={!entry.included || entry.weight >= MAX_WEIGHT}
                      >
                        +
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="party-mode-row">
                {PARTY_MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`party-chip ${config.mode === m.key ? 'active' : ''}`}
                    onClick={() => setConfig((c) => setMode(c, m.key))}
                  >
                    {m.ko}
                    <small>{m.hint}</small>
                  </button>
                ))}
              </div>

              {config.mode !== 'order' && (
                <div className="party-pick-row">
                  <span className="party-field-label">몇 명이 걸리나</span>
                  <button
                    type="button"
                    onClick={() => setConfig((c) => setPick(c, c.pick - 1))}
                    disabled={config.pick <= 1}
                  >
                    −
                  </button>
                  <b>{config.pick}명</b>
                  <button
                    type="button"
                    onClick={() => setConfig((c) => setPick(c, c.pick + 1))}
                    disabled={config.pick >= Math.max(1, names.length - 1)}
                  >
                    +
                  </button>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            className="party-primary"
            disabled={!canStart(config)}
            onClick={() => setPhase('branch')}
          >
            {canStart(config) ? '뭘 할지 정하기' : '두 명 이상 필요합니다'}
          </button>
        </section>
      )}

      {isHost && phase === 'branch' && (
        <section className="party-branch" aria-label="게임 선정">
          <h2>뭘 할까</h2>
          <div className="party-branch-row">
            <button
              type="button"
              className={`party-chip ${branch === 'pick' ? 'active' : ''}`}
              onClick={() => setBranch('pick')}
            >
              게임 픽<small>목록에서 하나 고른다</small>
            </button>
            <button
              type="button"
              className={`party-chip ${branch === 'random' ? 'active' : ''}`}
              onClick={() => setBranch('random')}
            >
              랜덤<small>지켜보는 게임 중 무작위</small>
            </button>
            <button
              type="button"
              className={`party-chip ${branch === 'interactive' ? 'active' : ''}`}
              onClick={() => setBranch('interactive')}
            >
              참여형<small>다 같이 조작한다</small>
            </button>
          </div>

          {branch === 'random' ? (
            <button
              type="button"
              className="party-primary"
              disabled={pool.length === 0}
              onClick={() => {
                const picked = randomFrom(pool);
                if (picked) beginRound(picked.slug);
                else setNotice('돌릴 게임이 없습니다.');
              }}
            >
              {pool.length ? `${pool.length}종에서 무작위로 시작` : '돌릴 게임이 없습니다'}
            </button>
          ) : (
            <>
              {branch === 'interactive' && (
                <div className="party-branch-row">
                  <button
                    type="button"
                    className="party-ghost"
                    disabled={pool.length === 0}
                    onClick={() => {
                      const picked = randomFrom(pool);
                      if (picked) beginRound(picked.slug);
                    }}
                  >
                    참여형 중 무작위
                  </button>
                  {/* 익명 투표는 여기서만 뜬다 — 나머지 갈래는 방장이 정한다 */}
                  {votingApplies(branch, 'pick') && (
                    <button type="button" className="party-ghost" onClick={beginVote}>
                      투표로 정하기
                    </button>
                  )}
                </div>
              )}
              <ul className="party-game-list">
                {pool.map((g) => (
                  <li key={g.slug}>
                    <button type="button" onClick={() => beginRound(g.slug)}>
                      <span>{g.title}</span>
                      {isInteractive(g) && <em>참여형</em>}
                    </button>
                  </li>
                ))}
                {pool.length === 0 && <li className="party-status">해당하는 게임이 없습니다.</li>}
              </ul>
            </>
          )}

          <button type="button" className="party-ghost" onClick={() => setPhase('setup')}>
            명부로 돌아가기
          </button>
        </section>
      )}

      {isHost && phase === 'vote' && vote && (
        <section className="party-vote" aria-label="투표">
          <h2>무엇을 할지 투표</h2>
          <VotePanel vote={vote} titles={titles} onCast={submitBallot} />
        </section>
      )}
    </div>
  );
}

/**
 * 투표 판 — **중간 집계를 보여 주지 않는다.**
 * 서버가 마감 전에는 집계를 비워 보내므로 화면이 고를 것도 없다(뒤에 낸 사람이 흐름을 읽으면
 * 익명 투표가 아니게 된다). 보이는 것은 「몇 명이 냈는가」뿐이다.
 */
function VotePanel({
  vote,
  titles,
  onCast,
}: {
  vote: VoteView;
  titles: Record<string, string>;
  onCast: (slug: string) => void;
}) {
  return (
    <div className="party-vote-panel">
      {vote.open ? (
        <>
          <div className="party-name-grid">
            {vote.candidates.map((slug) => (
              <button key={slug} type="button" className="party-name-btn" onClick={() => onCast(slug)}>
                {titles[slug] ?? slug}
              </button>
            ))}
          </div>
          <p className="party-status">{vote.submitted}명이 냈습니다. 전원이 내면 마감됩니다.</p>
        </>
      ) : (
        <p className="party-result">
          결정: <strong>{titles[vote.winner ?? ''] ?? vote.winner}</strong>
        </p>
      )}
    </div>
  );
}
