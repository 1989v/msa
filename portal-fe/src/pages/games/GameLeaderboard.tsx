import { useCallback, useEffect, useState } from 'react';
import {
  fetchLeaderboard,
  getGameNickname,
  type GameLang,
  type ScoreBoardDef,
  type ScorePeriod,
  type ScoreTrack,
} from '../../api/gameApi';
import {
  PERIOD_LABELS,
  PERIOD_ORDER,
  TRACK_LABELS,
  boardLabel,
  hasAnyPeriodRecord,
  initialBoard,
  isMyEntry,
  keepOrPickTrack,
  trackedTracks,
  type PeriodBoards,
  type TrackBoards,
} from './leaderboardView';

const UI = {
  ko: {
    heading: '랭킹',
    refresh: '새로고침',
    loading: '랭킹 불러오는 중…',
    error: '랭킹을 불러오지 못했습니다.',
    retry: '다시 시도',
    emptyTitle: '아직 기록이 없습니다',
    emptyBody: '첫 기록에 도전해 보세요 — 위 플레이 버튼으로 시작합니다.',
    emptyDayTitle: '오늘은 아직 기록이 없습니다',
    emptyDayBody: '오늘의 1위 자리가 비어 있습니다 — 한 판이면 됩니다.',
    colRank: '순위',
    colPlayer: '플레이어',
    colScore: '점수',
    me: '내 기록',
    periodLabel: '랭킹 기간',
    trackLabel: '랭킹 보드',
    trackNote: '영구 강화를 쓴 기록은 따로 셉니다 — 두 보드는 서로 비교하지 않습니다.',
    boardLabel: '모드',
    boardNote: '모드마다 순위표가 따로입니다 — 재는 것이 달라 한 표에 섞지 않습니다.',
    pager: '순위 넘기기',
    prev: '앞 순위',
    next: '다음 순위',
    dayNote: '오늘의 기록은 매일 자정(한국 시간)에 새로 시작합니다.',
    nickNote: '게임 안에서 닉네임을 정하면 기록이 이 표에 남습니다.',
  },
  en: {
    heading: 'Leaderboard',
    refresh: 'Refresh',
    loading: 'Loading the leaderboard…',
    error: 'Could not load the leaderboard.',
    retry: 'Try again',
    emptyTitle: 'No records yet',
    emptyBody: 'Be the first — start with the play button above.',
    emptyDayTitle: 'No records today yet',
    emptyDayBody: "Today's top spot is open — one run takes it.",
    colRank: 'Rank',
    colPlayer: 'Player',
    colScore: 'Score',
    me: 'Your run',
    periodLabel: 'Leaderboard period',
    trackLabel: 'Leaderboard track',
    trackNote: 'Runs with permanent upgrades are counted separately — the two boards are not compared.',
    boardLabel: 'Mode',
    boardNote: 'Each mode keeps its own board — they measure different things, so they are not merged.',
    pager: 'Ranking pages',
    prev: 'Higher ranks',
    next: 'Lower ranks',
    dayNote: "Today's board starts over at midnight, Korea time.",
    nickNote: 'Set a nickname inside the game and your runs will show up here.',
  },
} as const;

const EMPTY_TRACKS: TrackBoards = { BASE: [], MODDED: [] };
const EMPTY: PeriodBoards = { ALL_TIME: EMPTY_TRACKS, DAILY: EMPTY_TRACKS };

interface Props {
  slug: string;
  lang: GameLang;
  /**
   * 게임이 나눈 모드. 비어 있으면(대부분의 게임) 보드가 하나뿐이라 탭도 요청도 늘지 않는다.
   * 이름은 카탈로그가 준다 — 게임 안 선언은 sandbox iframe 안이라 여기서 못 읽는다 (V59).
   */
  scoreBoards: ScoreBoardDef[];
  /**
   * 값이 바뀌면 보드를 다시 읽는다. 게임은 sandbox iframe 안에서 자기 힘으로 점수를 올리고
   * 부모에게 알리는 규약이 없다 — 프레임 간 메시지 규약을 새로 발명하는 대신,
   * 플레이를 끝내고 나온 순간(상세 페이지가 아는 유일한 신호)에 다시 읽는다.
   */
  reloadToken: number;
  /**
   * 한 쪽에 보여 줄 줄 수. 주면 그만큼씩 잘라 **옆으로 넘겨** 본다.
   * 상세 화면은 5를 준다 — 세로로 열 줄을 쌓으면 그 아래 내용이 첫 화면 밖으로 밀린다.
   */
  pageSize?: number;
}

export default function GameLeaderboard({ slug, lang, scoreBoards, reloadToken, pageSize }: Props) {
  const L = UI[lang];
  const [boards, setBoards] = useState<PeriodBoards | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<ScorePeriod>('ALL_TIME');
  // 사용자가 고른 트랙은 "선호"로만 들고 있다 — 지금 보고 있는 기간에 그 트랙이 없으면
  // keepOrPickTrack 이 렌더 때 옮겨 준다. 상태 둘을 서로 맞추려 들면 어긋난다.
  const [track, setTrack] = useState<ScoreTrack | null>(null);
  // 모드는 트랙과 달리 "고른 것만" 읽는다. 넷을 미리 받는 트랙·기간과 달리 모드는 게임마다
  // 개수가 다르고, 셋을 미리 받으면 요청이 4개에서 12개가 된다 — 대부분 빈 응답으로.
  const [board, setBoard] = useState<string | null>(initialBoard(scoreBoards));
  const [nickname, setNickname] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    setBoards(null);
    // 기간과 트랙이 둘 다 보드 식별자라 한 요청으로 넷을 받을 수 없다. 넷을 나란히 받아
    // 기록이 있는 것만 탭으로 세운다 — 어느 탭이 비었는지 알아야 탭을 감출 수 있다.
    Promise.all([
      fetchLeaderboard(slug, 'BASE', 10, 'ALL_TIME', board),
      fetchLeaderboard(slug, 'MODDED', 10, 'ALL_TIME', board),
      fetchLeaderboard(slug, 'BASE', 10, 'DAILY', board),
      fetchLeaderboard(slug, 'MODDED', 10, 'DAILY', board),
    ])
      .then(([base, modded, baseToday, moddedToday]) => {
        setBoards({
          ALL_TIME: { BASE: base, MODDED: modded },
          DAILY: { BASE: baseToday, MODDED: moddedToday },
        });
        setNickname(getGameNickname());
      })
      .catch(() => {
        setBoards(null);
        setFailed(true);
      });
  }, [slug, board]);

  // 게임이 바뀌면 고른 것도 처음으로. 같은 게임을 다시 읽는 것(플레이 후 복귀)은
  // 보고 있던 기간을 유지한다 — 오늘 보드를 보다 한 판 하고 왔는데 전체로 튀면 안 된다.
  useEffect(() => {
    setPeriod('ALL_TIME');
    setTrack(null);
    setBoard(initialBoard(scoreBoards));
    // scoreBoards 는 slug 와 함께 바뀐다 — 같은 게임에서 배열 정체성만 바뀌어도 다시 맞출 이유가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const view = (boards ?? EMPTY)[period];
  const tracks = trackedTracks(view);
  const activeTrack = keepOrPickTrack(track, view);
  const rows = activeTrack ? view[activeTrack] : [];

  /* 쪽 넘김. 보드·트랙·기간이 바뀌면 첫 쪽으로 돌아간다 — 3쪽을 보다 다른 보드로 옮겼는데
     빈 3쪽이 남아 있으면 기록이 없는 것처럼 보인다.
     되돌리는 것을 효과가 아니라 렌더 중 계산으로 두는 이유: 효과로 하면 한 프레임 동안
     빈 쪽이 먼저 그려졌다가 지워진다. 보고 있던 것이 무엇이었는지를 상태에 같이 담는다. */
  const pageKey = `${board}|${period}|${activeTrack ?? ''}`;
  const [pager, setPager] = useState({ key: pageKey, page: 0 });
  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const page = pager.key === pageKey ? Math.min(pager.page, pageCount - 1) : 0;
  const goPage = (n: number) => setPager({ key: pageKey, page: n });
  const hasRecord = boards !== null && hasAnyPeriodRecord(boards);
  // 모드가 여럿이면 이 모드가 비어 있어도 탭은 남는다 — 탭이 사라지면 다른 모드로 갈 길이 없다.
  const hasBoardTabs = scoreBoards.length > 1;

  return (
    <section className="game-leaderboard" aria-labelledby="game-leaderboard-heading">
      <h2 className="games-collection-title game-leaderboard-heading" id="game-leaderboard-heading">
        {L.heading}
        <button type="button" className="game-leaderboard-refresh" onClick={load}>
          {L.refresh}
        </button>
      </h2>

      {failed && (
        <div className="games-status game-leaderboard-status game-leaderboard-error">
          <span>{L.error}</span>
          <button type="button" className="game-leaderboard-refresh" onClick={load}>
            {L.retry}
          </button>
        </div>
      )}

      {!failed && boards === null && <p className="games-status game-leaderboard-status">{L.loading}</p>}

      {/*
        모드 탭은 그 모드에 기록이 없어도 남는다 — 탭까지 사라지면 다른 모드로 건너갈 길이
        없어져, 기록이 있는 보드가 있는데도 "아직 기록이 없습니다"만 보이게 된다.
      */}
      {!failed && boards !== null && hasBoardTabs && (
        <div className="game-leaderboard-tracks" role="tablist" aria-label={L.boardLabel}>
          {scoreBoards.map((def) => (
            <button
              key={def.key}
              type="button"
              role="tab"
              id={`game-leaderboard-board-${def.key}`}
              aria-selected={def.key === board}
              aria-controls="game-leaderboard-panel"
              className={`game-leaderboard-track${def.key === board ? ' active' : ''}`}
              onClick={() => setBoard(def.key)}
            >
              {boardLabel(def, lang)}
            </button>
          ))}
        </div>
      )}

      {!failed && boards !== null && !hasRecord && (
        <div className="game-leaderboard-empty">
          <p className="game-leaderboard-empty-title">{L.emptyTitle}</p>
          <p className="game-leaderboard-empty-body">{L.emptyBody}</p>
        </div>
      )}

      {!failed && boards !== null && hasRecord && (
        <>
          <div className="game-leaderboard-periods" role="tablist" aria-label={L.periodLabel}>
            {PERIOD_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`game-leaderboard-period-${key}`}
                aria-selected={key === period}
                aria-controls="game-leaderboard-panel"
                className={`game-leaderboard-period${key === period ? ' active' : ''}`}
                onClick={() => setPeriod(key)}
              >
                {PERIOD_LABELS[lang][key]}
              </button>
            ))}
          </div>

          {tracks.length > 1 && (
            <div className="game-leaderboard-tracks" role="tablist" aria-label={L.trackLabel}>
              {tracks.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`game-leaderboard-tab-${key}`}
                  aria-selected={key === activeTrack}
                  aria-controls="game-leaderboard-panel"
                  className={`game-leaderboard-track${key === activeTrack ? ' active' : ''}`}
                  onClick={() => setTrack(key)}
                >
                  {TRACK_LABELS[lang][key]}
                </button>
              ))}
            </div>
          )}

          {tracks.length > 1 && <p className="game-leaderboard-note">{L.trackNote}</p>}

          <div
            id="game-leaderboard-panel"
            role="tabpanel"
            aria-labelledby={`game-leaderboard-period-${period}`}
          >
            {/* 오늘 아무도 안 논 것은 고장이 아니라 비어 있는 1위 자리다 */}
            {!activeTrack ? (
              <div className="game-leaderboard-empty">
                <p className="game-leaderboard-empty-title">{L.emptyDayTitle}</p>
                <p className="game-leaderboard-empty-body">{L.emptyDayBody}</p>
              </div>
            ) : (
              <table className="kh-table game-leaderboard-table">
                <thead>
                  <tr>
                    <th scope="col">{L.colRank}</th>
                    <th scope="col">{L.colPlayer}</th>
                    <th scope="col" className="num">
                      {L.colScore}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(pageSize ? rows.slice(page * pageSize, (page + 1) * pageSize) : rows).map((entry) => {
                    const mine = isMyEntry(entry, nickname);
                    return (
                      <tr key={`${entry.rank}-${entry.nickname}`} className={mine ? 'is-me' : undefined}>
                        <td className="game-leaderboard-rank num">{entry.rank}</td>
                        <td>
                          <span className="game-leaderboard-nick">{entry.nickname}</span>
                          {/* 내 줄은 색으로만 구분하지 않는다 — 낱말과 굵은 선을 함께 준다 */}
                          {mine && <span className="game-leaderboard-me">{L.me}</span>}
                          {entry.detail && <span className="game-leaderboard-detail">{entry.detail}</span>}
                        </td>
                        <td className="num">{entry.score.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 다섯 줄씩 넘겨 본다 — 열 줄을 한 번에 쌓으면 그 아래 패널이 첫 화면 밖으로 밀린다 */}
          {pageSize != null && pageCount > 1 && (
            <nav className="game-leaderboard-pager" aria-label={L.pager}>
              <button
                type="button"
                className="game-leaderboard-page-btn"
                onClick={() => goPage(Math.max(0, page - 1))}
                disabled={page === 0}
                aria-label={L.prev}
              >
                ‹
              </button>
              <span className="game-leaderboard-page-range">
                {page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)}
              </span>
              <button
                type="button"
                className="game-leaderboard-page-btn"
                onClick={() => goPage(Math.min(pageCount - 1, page + 1))}
                disabled={page >= pageCount - 1}
                aria-label={L.next}
              >
                ›
              </button>
            </nav>
          )}

          {period === 'DAILY' && <p className="game-leaderboard-note">{L.dayNote}</p>}
          {!nickname && <p className="game-leaderboard-note">{L.nickNote}</p>}
        </>
      )}

      {!failed && boards !== null && hasBoardTabs && (
        <p className="game-leaderboard-note">{L.boardNote}</p>
      )}
    </section>
  );
}
