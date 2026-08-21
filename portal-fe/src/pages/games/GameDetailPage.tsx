import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  displayDescription,
  displayTitle,
  endGameSession,
  fetchGameDetail,
  fetchSimilarGames,
  genreLabel,
  isBeta,
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
import FavoriteButton from '../../components/favorite/FavoriteButton';
import { useStageFit } from './useStageFit';
import { fetchGraphData } from '../../api/searchApi';
import { isLoggedIn } from '../../auth/auth';
import type { GraphNode } from '../../types/graph';
import { INTERNAL_GAMES } from './internalGames';
import GameCard from './GameCard';
import { StarRating, StarRatingInput, starsFromHalves } from './StarRating';
import './Games.css';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';

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
  useHeritageSurface();
  const { slug = '' } = useParams();
  const { pathname } = useLocation();
  const lang: GameLang = pathname.startsWith('/en/') ? 'en' : 'ko';
  const [game, setGame] = useState<GameDetail | null>(null);
  const [similar, setSimilar] = useState<GameSummary[]>([]);
  const [playing, setPlaying] = useState(false);
  const stageFit = useStageFit(playing);
  const [notFound, setNotFound] = useState(false);
  // 내 평점은 BE 척도(halves 1~10) 그대로 든다 — 화면 변환은 StarRating 몫
  const [myHalves, setMyHalves] = useState<number | null>(null);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const sessionRef = useRef<{ slug: string; key: string } | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const immersive = playing && stageFit.immersive;

  // 몰입 중에는 뒤쪽 문서가 스크롤되면 안 된다 — 조이스틱 드래그가 페이지를 끌고 다닌다.
  useEffect(() => {
    if (!immersive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [immersive]);

  useEffect(() => {
    setGame(null);
    setPlaying(false);
    setNotFound(false);
    setMyHalves(null);
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

  const handleClose = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    setPlaying(false);
  };

  /**
   * 가로 몰입. 전체화면 API 로 브라우저 크롬까지 걷어낸 뒤 가로로 잠근다 —
   * 세로 그대로 전체화면이 되면 게임만 커지고 얻는 게 없다.
   * iOS Safari 는 임의 요소 전체화면이 없어 실패하는데, 몰입 오버레이가 이미 뷰포트를
   * 채우고 있으므로 기기를 돌리면 그대로 가로 배치가 된다.
   */
  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      (screen.orientation as { unlock?: () => void } | undefined)?.unlock?.();
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    el.requestFullscreen?.()
      .then(() =>
        (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })
          ?.lock?.('landscape')
          ?.catch(() => undefined),
      )
      .catch(() => undefined);
  };

  const handleRate = async (halves: number) => {
    try {
      const result = await rateGame(slug, halves);
      setMyHalves(halves);
      const avgStars = starsFromHalves(result.ratingAvg).toFixed(1);
      const votes = result.ratingCount.toLocaleString();
      setRatingMessage(
        lang === 'en'
          ? `Rating saved — average ${avgStars} (${votes} votes)`
          : `평가 완료 — 평균 ${avgStars}점 (${votes}표)`,
      );
      setGame((prev) => (prev ? { ...prev, ratingAvg: result.ratingAvg, ratingCount: result.ratingCount } : prev));
    } catch {
      setRatingMessage(
        lang === 'en'
          ? 'Could not save your rating — please try again later.'
          : '평점 등록에 실패했습니다 — 잠시 후 다시 시도해 주세요.',
      );
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
      <div className="games-page kh-arcade">
        <p className="games-status">
          {lang === 'en' ? 'Game not found.' : '게임을 찾을 수 없습니다.'}
        </p>
        <Link className="games-back" to={gamePath(lang, HUB_SUB)} viewTransition>
          {lang === 'en' ? '← Back to all games' : '← 게임 목록으로'}
        </Link>
      </div>
    );
  }

  if (!game) return <div className="games-page games-status">불러오는 중…</div>;

  return (
    <div className="games-page kh-arcade">
      <div className="games-topbar">
        <Link className="games-favorites-link" to={lang === 'en' ? '/en/favorites' : '/favorites'} viewTransition>
          {lang === 'en' ? 'My favorites' : '내 찜'}
        </Link>
        <AuthButton />
      </div>
      <nav className="games-breadcrumb" aria-label={lang === 'en' ? 'Breadcrumb' : '탐색 경로'}>
        <Link className="games-back" to={gamePath(lang, HUB_SUB)} viewTransition>
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
          <h1 className="games-title">
            {displayTitle(game, lang)}
            {isBeta(game) && <span className="game-badge-beta inline">BETA</span>}
          </h1>
          <FavoriteButton type="GAME" targetKey={slug} />
          {isBeta(game) && (
            <p className="game-detail-beta-note">
              {lang === 'en'
                ? 'In active development — balance and content are still changing. Feedback welcome.'
                : '아직 다듬는 중입니다 — 밸런스와 콘텐츠가 계속 바뀝니다. 피드백 환영.'}
            </p>
          )}
          <div className="game-detail-meta">
            {game.ratingCount > 0 && (
              <span className="game-detail-rating">
                <StarRating value={starsFromHalves(game.ratingAvg)} />
                {starsFromHalves(game.ratingAvg).toFixed(1)} (
                {game.ratingCount.toLocaleString()}
                {lang === 'en' ? ' votes' : '표'})
              </span>
            )}
            <span className="game-card-plays">{game.playCount.toLocaleString()} plays</span>
            <span className="game-detail-dev">by {game.developerName}</span>
          </div>
          <div className="game-card-tags">
            {/* 'beta' 는 상태 배지로 이미 보여 준다 — 칩으로 또 찍으면 같은 말이 두 번 나온다 */}
            {game.tags.filter((t) => t !== 'beta').map((tag) => (
              <span key={tag} className="game-tag-chip">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section
        className={`game-stage${immersive ? ' is-immersive' : ''}`}
        ref={stageRef}
        aria-label="게임 플레이 영역"
        style={immersive && stageFit.stageHeight ? { height: `${stageFit.stageHeight}px` } : undefined}
      >
        {immersive && (
          <div className="game-stage-bar">
            <button className="game-stage-chip" onClick={handleClose} aria-label="게임 닫기">
              ✕
            </button>
            {/* 세로에서는 가로형 캔버스가 폭에 걸려 작아진다 — 가로 전환이 실질적인 해법이라
                아이콘만 두지 않고 이름을 붙여 눈에 띄게 한다. */}
            <button
              className={`game-stage-chip${stageFit.portrait ? ' is-wide' : ''}`}
              onClick={toggleFullscreen}
              aria-label="전체화면 가로 전환"
            >
              {stageFit.portrait ? '⛶ 크게' : '⛶'}
            </button>
          </div>
        )}
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
          <p className="games-status">
            {lang === 'en'
              ? 'You can rate once from this device without signing in.'
              : '로그인 없이도 이 기기에서 한 번 평가할 수 있습니다.'}
          </p>
        )}
        <StarRatingInput halves={myHalves} onRate={handleRate} lang={lang} />
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
