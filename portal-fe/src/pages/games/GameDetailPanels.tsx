import { useEffect, useState } from 'react';
import { fetchFavoriteCount, fetchMyGameRecord, type GameDetail, type MyGameRecord } from '../../api/gameApi';
import { isLoggedIn } from '../../auth/auth';
import GameLeaderboard from './GameLeaderboard';
import { StarRating, StarRatingInput, starsFromHalves } from './StarRating';
import type { GameLang } from '../../api/gameApi';

/**
 * 상세 화면의 정보 패널 셋 — 랭킹 / 내 기록 / 평가.
 *
 * **좁은 화면에서는 탭으로 접는다.** 셋을 세로로 쌓으면 첫 화면에서 플레이 버튼이
 * 스크롤 아래로 밀린다 — 게임을 하러 온 사람이 먼저 만나는 것이 정보 더미가 되면 안 된다.
 * 넓은 화면에서는 접을 이유가 없으므로 셋을 한 번에 편다(CSS 가 담당).
 */
type PanelKey = 'rank' | 'me' | 'reviews';

function minutes(sec: number): string {
  if (sec < 60) return '1분 미만';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

function sinceLabel(iso: string | null, lang: GameLang): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (lang === 'en') return days <= 0 ? 'today' : `${days}d ago`;
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

export default function GameDetailPanels({
  game,
  slug,
  lang,
  boardToken,
  myHalves,
  onRate,
  ratingMessage,
}: {
  game: GameDetail;
  slug: string;
  lang: GameLang;
  boardToken: number;
  myHalves: number | null;
  onRate: (halves: number) => void;
  ratingMessage: string | null;
}) {
  const [tab, setTab] = useState<PanelKey>('rank');
  const [me, setMe] = useState<MyGameRecord | null>(null);
  const [favorites, setFavorites] = useState<number | null>(null);
  const loggedIn = isLoggedIn();

  useEffect(() => {
    let alive = true;
    fetchFavoriteCount(slug).then((n) => alive && setFavorites(n));
    // 내 기록은 로그인 상태에서만 부른다 — 게스트에게는 401 이 정상이라 요청 자체를 안 한다
    if (loggedIn) fetchMyGameRecord(slug).then((r) => alive && setMe(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
    // 플레이가 끝나면 boardToken 이 바뀐다 — 그때 내 기록도 다시 읽는다
  }, [slug, loggedIn, boardToken]);

  const tabs: { key: PanelKey; label: string }[] = [
    { key: 'rank', label: lang === 'en' ? 'Ranking' : '랭킹' },
    { key: 'me', label: lang === 'en' ? 'My record' : '내 기록' },
    { key: 'reviews', label: lang === 'en' ? 'Ratings' : '평가' },
  ];

  return (
    <div className="game-panels">
      <div className="game-panel-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`game-panel-tab${tab === t.key ? ' is-on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className={`game-panel${tab === 'rank' ? ' is-open' : ''}`} aria-label="랭킹">
        <h2 className="game-panel-title">{lang === 'en' ? 'Ranking' : '랭킹'}</h2>
        <GameLeaderboard slug={slug} lang={lang} scoreBoards={game.scoreBoards ?? []} reloadToken={boardToken} />
      </section>

      <section className={`game-panel${tab === 'me' ? ' is-open' : ''}`} aria-label="내 기록">
        <h2 className="game-panel-title">{lang === 'en' ? 'My record' : '내 기록'}</h2>
        {!loggedIn ? (
          <p className="games-status">
            {lang === 'en' ? 'Sign in to keep your record.' : '로그인하면 내 기록이 남습니다.'}
          </p>
        ) : !me ? (
          <p className="games-status">{lang === 'en' ? 'Loading…' : '불러오는 중…'}</p>
        ) : me.plays === 0 ? (
          <p className="games-status">
            {lang === 'en' ? 'No plays yet.' : '아직 플레이 기록이 없습니다.'}
          </p>
        ) : (
          <dl className="game-stat-grid">
            <div>
              <dt>{lang === 'en' ? 'Plays' : '플레이'}</dt>
              <dd>{me.plays.toLocaleString()}{lang === 'en' ? '' : '회'}</dd>
            </div>
            <div>
              <dt>{lang === 'en' ? 'Total time' : '총 시간'}</dt>
              <dd>{minutes(me.totalSeconds)}</dd>
            </div>
            {me.bestScore != null && (
              <div>
                <dt>{lang === 'en' ? 'Best' : '내 최고'}</dt>
                <dd>
                  {me.bestScore.toLocaleString()}
                  {me.bestRank != null && <span className="game-stat-sub"> · {me.bestRank}위</span>}
                </dd>
              </div>
            )}
            {sinceLabel(me.lastPlayedAt, lang) && (
              <div>
                <dt>{lang === 'en' ? 'Last played' : '마지막 플레이'}</dt>
                <dd>{sinceLabel(me.lastPlayedAt, lang)}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section className={`game-panel${tab === 'reviews' ? ' is-open' : ''}`} aria-label="평가">
        <h2 className="game-panel-title">{lang === 'en' ? 'Ratings' : '평가'}</h2>
        <div className="game-rating-summary">
          <StarRating value={starsFromHalves(game.ratingAvg)} />
          <span className="game-rating-figure">
            {game.ratingAvg.toFixed(1)}
            <span className="game-stat-sub"> ({game.ratingCount.toLocaleString()}{lang === 'en' ? '' : '표'})</span>
          </span>
          {favorites != null && favorites > 0 && (
            <span className="game-stat-sub">♡ {favorites.toLocaleString()}</span>
          )}
        </div>
        {!loggedIn && (
          <p className="games-status">
            {lang === 'en'
              ? 'You can rate once from this device without signing in.'
              : '로그인 없이도 이 기기에서 한 번 평가할 수 있습니다.'}
          </p>
        )}
        <StarRatingInput halves={myHalves} onRate={onRate} lang={lang} />
        {ratingMessage && <p className="games-status">{ratingMessage}</p>}
      </section>
    </div>
  );
}
