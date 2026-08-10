import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  displayDescription,
  displayTitle,
  endGameSession,
  fetchGameDetail,
  fetchSimilarGames,
  genreLabel,
  rateGame,
  startGameSession,
  type GameDetail,
  type GameLang,
  type GameSummary,
} from '../../api/gameApi';
import {
  BRAND,
  breadcrumbJsonLd,
  detailMeta,
  gameDetailUrl,
  gamePath,
  gameUrl,
  genreSlug,
  hreflangAlternates,
  socialImage,
  videoGameJsonLd,
} from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import AuthButton from '../../components/AuthButton';
import { useStageFit } from './useStageFit';
import { fetchGraphData } from '../../api/searchApi';
import { isLoggedIn } from '../../auth/auth';
import type { GraphNode } from '../../types/graph';
import { INTERNAL_GAMES } from './internalGames';
import GameCard from './GameCard';
import './Games.css';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function InternalGamePlayer({ slug }: { slug: string }) {
  const [nodes, setNodes] = useState<GraphNode[] | null>(null);
  const GameComponent = INTERNAL_GAMES[slug];

  useEffect(() => {
    fetchGraphData()
      .then((data) => setNodes(data.nodes.filter((n) => n.description && n.description.length > 20)))
      .catch(() => setNodes([]));
  }, []);

  if (!GameComponent) return <p className="games-status">지원하지 않는 내장 게임입니다.</p>;
  if (nodes === null) return <p className="games-status">게임 데이터 로딩 중…</p>;
  if (nodes.length < 6) return <p className="games-status">플레이에 필요한 개념 데이터가 부족합니다.</p>;

  return (
    <Suspense fallback={<p className="games-status">게임 로딩 중…</p>}>
      <GameComponent nodes={nodes} />
    </Suspense>
  );
}

/** 허브 경로 — game 서브도메인에서는 루트가, 그 외 호스트에서는 /games 가 허브다 */
const HUB_SUB = window.location.hostname.split('.')[0] === 'game' ? '' : '/games';

export default function GameDetailPage() {
  const { slug = '' } = useParams();
  const { pathname } = useLocation();
  const lang: GameLang = pathname.startsWith('/en/') ? 'en' : 'ko';
  const [game, setGame] = useState<GameDetail | null>(null);
  const [similar, setSimilar] = useState<GameSummary[]>([]);
  const [playing, setPlaying] = useState(false);
  const stageFit = useStageFit(playing);
  const [notFound, setNotFound] = useState(false);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const sessionRef = useRef<{ slug: string; key: string } | null>(null);

  useEffect(() => {
    setGame(null);
    setPlaying(false);
    setNotFound(false);
    setMyScore(null);
    setRatingMessage(null);
    fetchGameDetail(slug)
      .then(setGame)
      .catch(() => setNotFound(true));
    fetchSimilarGames(slug)
      .then(setSimilar)
      .catch(() => setSimilar([]));
  }, [slug]);

  // 세션 종료 — 페이지 이탈/게임 전환 시 best-effort
  useEffect(
    () => () => {
      const session = sessionRef.current;
      if (session) {
        endGameSession(session.slug, session.key).catch(() => undefined);
        sessionRef.current = null;
      }
    },
    [slug],
  );

  const handlePlay = async () => {
    setPlaying(true);
    try {
      const session = await startGameSession(slug);
      sessionRef.current = { slug, key: session.sessionKey };
    } catch {
      // 세션 기록 실패는 플레이를 막지 않는다
    }
  };

  const handleRate = async (score: number) => {
    try {
      const result = await rateGame(slug, score);
      setMyScore(score);
      setRatingMessage(`평가 완료 — 평균 ${result.ratingAvg.toFixed(1)}점 (${result.ratingCount.toLocaleString()}표)`);
      setGame((prev) => (prev ? { ...prev, ratingAvg: result.ratingAvg, ratingCount: result.ratingCount } : prev));
    } catch {
      setRatingMessage('평점 등록에 실패했습니다 — 잠시 후 다시 시도해 주세요.');
    }
  };

  const canonical = gameDetailUrl(lang, slug);
  const meta = game ? detailMeta(lang, game) : null;
  useSeo(
    game && meta
      ? {
          title: meta.title,
          description: meta.description,
          canonical,
          lang,
          image: socialImage(game),
          alternates: hreflangAlternates(`/games/${slug}`),
          jsonLd: [
            videoGameJsonLd(lang, game),
            breadcrumbJsonLd(lang, [
              { name: lang === 'en' ? 'Games' : '게임', url: gameUrl(lang) },
              {
                name: genreLabel(game.genre, lang),
                url: gameUrl(lang, `/games/genre/${genreSlug(game.genre)}`),
              },
              { name: meta.heading, url: canonical },
            ]),
          ],
        }
      : notFound
        ? {
            title: lang === 'en' ? `Game not found | ${BRAND}` : `게임을 찾을 수 없습니다 | ${BRAND}`,
            lang,
            noindex: true,
          }
        : { title: '', lang }, // 로딩 중 — 프리렌더된 메타를 유지
  );

  if (notFound) {
    return (
      <div className="games-page">
        <p className="games-status">
          {lang === 'en' ? 'Game not found.' : '게임을 찾을 수 없습니다.'}
        </p>
        <Link className="games-back" to={gamePath(lang, HUB_SUB)}>
          {lang === 'en' ? '← Back to all games' : '← 게임 목록으로'}
        </Link>
      </div>
    );
  }

  if (!game) return <div className="games-page games-status">불러오는 중…</div>;

  return (
    <div className="games-page">
      <div className="games-topbar">
        <AuthButton />
      </div>
      <nav className="games-breadcrumb" aria-label={lang === 'en' ? 'Breadcrumb' : '탐색 경로'}>
        <Link className="games-back" to={gamePath(lang, HUB_SUB)}>
          ← {lang === 'en' ? 'Games' : '게임'}
        </Link>
        <Link
          className="games-back"
          to={gamePath(lang, `/games/genre/${genreSlug(game.genre)}`)}
        >
          {genreLabel(game.genre, lang)}
        </Link>
      </nav>

      <div className="game-detail-head">
        <div>
          <h1 className="games-title">{displayTitle(game, lang)}</h1>
          <div className="game-detail-meta">
            {game.ratingCount > 0 && (
              <span className="game-card-rating">
                ★ {game.ratingAvg.toFixed(1)} ({game.ratingCount.toLocaleString()}표)
              </span>
            )}
            <span className="game-card-plays">{game.playCount.toLocaleString()} plays</span>
            <span className="game-detail-dev">by {game.developerName}</span>
          </div>
          <div className="game-card-tags">
            {game.tags.map((tag) => (
              <span key={tag} className="game-tag-chip">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="game-stage" aria-label="게임 플레이 영역">
        {!playing ? (
          <div className="game-stage-idle">
            <p className="game-stage-desc">{displayDescription(game, lang)}</p>
            <button className="game-play-btn" onClick={handlePlay}>
              ▶ 플레이
            </button>
          </div>
        ) : game.loadType === 'INTERNAL_ROUTE' ? (
          <InternalGamePlayer slug={game.entryUrl} />
        ) : (
          <iframe
            ref={stageFit.ref}
            className="game-stage-frame"
            src={game.entryUrl}
            title={game.title}
            allow="autoplay; fullscreen; gamepad"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock"
            style={stageFit.height ? { height: `${stageFit.height}px`, minHeight: 0 } : undefined}
          />
        )}
      </section>

      <section className="game-rating-section" aria-label="평점 남기기">
        <h2 className="games-collection-title">
          {lang === 'en' ? 'Rate this game' : '이 게임 어땠나요?'}
        </h2>
        {!isLoggedIn() && (
          <p className="games-status">로그인 없이도 이 기기에서 한 번 평가할 수 있습니다.</p>
        )}
        <div className="game-rating-scores">
          {SCORES.map((score) => (
            <button
              key={score}
              className={`game-score-btn ${myScore === score ? 'active' : ''}`}
              onClick={() => handleRate(score)}
              aria-label={`${score}점 주기`}
            >
              {score}
            </button>
          ))}
        </div>
        {ratingMessage && <p className="games-status">{ratingMessage}</p>}
      </section>

      {similar.length > 0 && (
        <section className="games-collection" aria-label="비슷한 게임">
          <h2 className="games-collection-title">
            {lang === 'en' ? 'More Games Like This' : '비슷한 게임 더 보기'}
          </h2>
          <div className="games-row">
            {similar.map((s) => (
              <GameCard key={s.slug} game={s} lang={lang} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
