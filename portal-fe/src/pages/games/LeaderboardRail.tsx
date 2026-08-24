import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  displayTitle,
  fetchActiveLeaderboards,
  getGameNickname,
  type GameLang,
  type LeaderboardBoard,
} from '../../api/gameApi';
import { gamePath } from '../../seo/copy.mjs';
import { PERIOD_LABELS, TRACK_LABELS, isMyEntry, railBoardLabel, railView, stepIndex } from './leaderboardView';

/** 한 칸에 머무는 시간. 3줄을 읽고 "전체 보기"를 누를지 정하기에 6초면 넉넉하다. */
const ROTATE_MS = 6000;
const BOARD_LIMIT = 8;
const ENTRY_LIMIT = 3;

const UI = {
  ko: {
    section: '지금의 기록',
    label: '게임별 랭킹',
    prev: '이전 랭킹',
    next: '다음 랭킹',
    more: '전체 보기',
    me: '나',
    position: '{i} / {n}',
  },
  en: {
    section: 'Current records',
    label: 'Game leaderboards',
    prev: 'Previous leaderboard',
    next: 'Next leaderboard',
    more: 'View all',
    me: 'you',
    position: '{i} / {n}',
  },
} as const;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 허브 상단 랭킹 레일 — 기록이 있는 게임만 돌아가며 보여준다.
 *
 * 기록이 하나도 없으면 **아무것도 그리지 않는다.** 빈 위젯이 자리를 잡고 있으면
 * 고장난 화면처럼 보이고, 채워 넣을 가짜 데이터도 없다.
 *
 * 오늘 기록이 있는 보드는 오늘 것을 싣는다(`railView`). 오늘 것만 싣지 않는 이유는
 * 기록이 드문 지금 아무도 안 논 날이 대부분이고, 그런 날 레일이 통째로 사라지기 때문이다.
 * 오늘 기록은 보드 목록 응답에 함께 실려 오므로 요청은 여전히 한 번이다.
 */
export default function LeaderboardRail({ lang }: { lang: GameLang }) {
  const L = UI[lang];
  const [boards, setBoards] = useState<LeaderboardBoard[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchActiveLeaderboards(BOARD_LIMIT, ENTRY_LIMIT)
      .then((list) => {
        if (!alive) return;
        setBoards(list);
        setNickname(getGameNickname());
      })
      // 실패도 "보여줄 랭킹 없음"과 같게 다룬다 — 허브 상단에 오류 상자를 세우지 않는다
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const total = boards.length;

  useEffect(() => {
    // 한 칸뿐이면 돌 곳이 없고, 모션을 줄인 사용자에게는 저절로 움직이는 것을 주지 않는다.
    if (total < 2 || paused || prefersReducedMotion()) return;
    const timer = window.setInterval(() => setIndex((i) => stepIndex(i, total, 1)), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [total, paused]);

  if (total === 0) return null;

  const board = boards[stepIndex(index, total, 0)];
  const shown = railView(board);

  return (
    <section
      className="games-rail"
      aria-label={L.label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="games-rail-head">
        <span className="games-rail-section">{L.section}</span>
        {total > 1 && (
          <div className="games-rail-nav">
            <button
              type="button"
              className="games-rail-step"
              aria-label={L.prev}
              onClick={() => setIndex((i) => stepIndex(i, total, -1))}
            >
              ‹
            </button>
            <span className="games-rail-position">{L.position.replace('{i}', String(stepIndex(index, total, 0) + 1)).replace('{n}', String(total))}</span>
            <button
              type="button"
              className="games-rail-step"
              aria-label={L.next}
              onClick={() => setIndex((i) => stepIndex(i, total, 1))}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* key 로 칸이 바뀔 때마다 스밈이 다시 발화한다 */}
      <div className="games-rail-slide" key={`${board.slug}-${board.track}-${board.board}-${shown.period}`}>
        <div className="games-rail-game">
          <h2 className="games-rail-title">{displayTitle(board, lang)}</h2>
          <span className="games-rail-track">{TRACK_LABELS[lang][board.track]}</span>
          {/* 모드를 나눈 게임만 칩이 하나 더 붙는다 — 어느 모드의 1위인지 알아야 순위가 뜻을 갖는다 */}
          {railBoardLabel(board, lang) && (
            <span className="games-rail-track">{railBoardLabel(board, lang)}</span>
          )}
          {/* 역대 기록일 때는 표식을 달지 않는다 — 늘 붙는 라벨은 읽히지 않는다 */}
          {shown.period === 'DAILY' && (
            <span className="games-rail-today">{PERIOD_LABELS[lang].DAILY}</span>
          )}
        </div>
        <ol className="games-rail-entries">
          {shown.entries.map((entry) => (
            <li
              key={`${entry.rank}-${entry.nickname}`}
              className={isMyEntry(entry, nickname) ? 'is-me' : undefined}
            >
              <span className="games-rail-rank">{entry.rank}</span>
              <span className="games-rail-nick">{entry.nickname}</span>
              {/* 색만으로 "내 기록"을 표시하지 않는다 */}
              {isMyEntry(entry, nickname) && <span className="games-rail-me">{L.me}</span>}
              <span className="games-rail-score">{entry.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
        <Link className="games-rail-more" to={gamePath(lang, `/games/${board.slug}`)} viewTransition>
          {L.more} →
        </Link>
      </div>
    </section>
  );
}
