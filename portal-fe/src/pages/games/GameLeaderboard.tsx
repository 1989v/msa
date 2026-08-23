import { useCallback, useEffect, useState } from 'react';
import {
  fetchLeaderboard,
  getGameNickname,
  type GameLang,
  type ScoreTrack,
} from '../../api/gameApi';
import {
  TRACK_LABELS,
  hasAnyRecord,
  isMyEntry,
  keepOrPickTrack,
  trackedTracks,
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
    colRank: '순위',
    colPlayer: '플레이어',
    colScore: '점수',
    me: '내 기록',
    trackLabel: '랭킹 보드',
    trackNote: '영구 강화를 쓴 기록은 따로 셉니다 — 두 보드는 서로 비교하지 않습니다.',
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
    colRank: 'Rank',
    colPlayer: 'Player',
    colScore: 'Score',
    me: 'Your run',
    trackLabel: 'Leaderboard track',
    trackNote: 'Runs with permanent upgrades are counted separately — the two boards are not compared.',
    nickNote: 'Set a nickname inside the game and your runs will show up here.',
  },
} as const;

const EMPTY: TrackBoards = { BASE: [], MODDED: [] };

interface Props {
  slug: string;
  lang: GameLang;
  /**
   * 값이 바뀌면 보드를 다시 읽는다. 게임은 sandbox iframe 안에서 자기 힘으로 점수를 올리고
   * 부모에게 알리는 규약이 없다 — 프레임 간 메시지 규약을 새로 발명하는 대신,
   * 플레이를 끝내고 나온 순간(상세 페이지가 아는 유일한 신호)에 다시 읽는다.
   */
  reloadToken: number;
}

export default function GameLeaderboard({ slug, lang, reloadToken }: Props) {
  const L = UI[lang];
  const [boards, setBoards] = useState<TrackBoards | null>(null);
  const [failed, setFailed] = useState(false);
  const [track, setTrack] = useState<ScoreTrack | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    setBoards(null);
    // 트랙은 보드 식별자의 일부라 한 요청으로 둘을 받을 수 없다 — 두 보드를 나란히 받아
    // 기록이 있는 쪽만 탭으로 세운다.
    Promise.all([fetchLeaderboard(slug, 'BASE'), fetchLeaderboard(slug, 'MODDED')])
      .then(([base, modded]) => {
        const next: TrackBoards = { BASE: base, MODDED: modded };
        setBoards(next);
        setTrack((prev) => keepOrPickTrack(prev, next));
        setNickname(getGameNickname());
      })
      .catch(() => {
        setBoards(null);
        setFailed(true);
      });
  }, [slug]);

  useEffect(() => {
    setTrack(null);
    load();
  }, [load, reloadToken]);

  const tracks = trackedTracks(boards ?? EMPTY);
  const rows = boards && track ? boards[track] : [];

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

      {!failed && boards !== null && !hasAnyRecord(boards) && (
        <div className="game-leaderboard-empty">
          <p className="game-leaderboard-empty-title">{L.emptyTitle}</p>
          <p className="game-leaderboard-empty-body">{L.emptyBody}</p>
        </div>
      )}

      {!failed && boards !== null && track && (
        <>
          {tracks.length > 1 && (
            <>
              <div className="game-leaderboard-tracks" role="tablist" aria-label={L.trackLabel}>
                {tracks.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    id={`game-leaderboard-tab-${key}`}
                    aria-selected={key === track}
                    aria-controls="game-leaderboard-panel"
                    className={`game-leaderboard-track${key === track ? ' active' : ''}`}
                    onClick={() => setTrack(key)}
                  >
                    {TRACK_LABELS[lang][key]}
                  </button>
                ))}
              </div>
              <p className="game-leaderboard-note">{L.trackNote}</p>
            </>
          )}

          <div
            id="game-leaderboard-panel"
            role={tracks.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={tracks.length > 1 ? `game-leaderboard-tab-${track}` : undefined}
          >
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
                {rows.map((entry) => {
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
          </div>

          {!nickname && <p className="game-leaderboard-note">{L.nickNote}</p>}
        </>
      )}
    </section>
  );
}
