import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
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
import { shouldAutoLandscape } from './stageOrientation';
import FavoriteButton from '../../components/favorite/FavoriteButton';
import { useStageFit } from './useStageFit';
import { fetchGraphData } from '../../api/searchApi';
import type { GraphNode } from '../../types/graph';
import { INTERNAL_GAMES } from './internalGames';
import GameCard from './GameCard';
import { peekParty } from './party';
import { GameAboutPanel, GameMyRecordPanel, GameRatePanel, GameReleaseNotesPanel } from './GameDetailPanels';
import { GameSuggestionsPanel } from './GameSuggestions';
import { useGameSideData } from './useGameSideData';
import GameLeaderboard from './GameLeaderboard';
import GNB from '../../components/GNB';
import Footer from '../../components/Footer';
import { starsFromHalves } from './StarRating';
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
  // 플레이를 끝내고 나온 순간에 랭킹을 다시 읽는다 (GameLeaderboard 의 reloadToken 주석 참조)
  const [boardToken, setBoardToken] = useState(0);
  const stageFit = useStageFit(playing);
  const [notFound, setNotFound] = useState(false);
  // 내 평점은 BE 척도(halves 1~10) 그대로 든다 — 화면 변환은 StarRating 몫
  const [myHalves, setMyHalves] = useState<number | null>(null);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const sessionRef = useRef<{ slug: string; key: string } | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const immersive = playing && stageFit.immersive;
  const side = useGameSideData(slug, boardToken);
  /* 좁은 화면에서만 쓰는 탭. 넓은 화면은 둘 다 펴므로 이 값이 화면을 바꾸지 않는다
     (CSS 가 미디어쿼리로 무시한다) — 상태를 폭에 따라 갈라 두면 회전할 때마다 튄다. */
  const [tab, setTab] = useState<'about' | 'rank' | 'notes' | 'ideas'>('about');
  /* 업데이트 탭은 노트가 있는 게임에만 뜬다. 라우트가 하나라 「비슷한 게임」으로 옮겨도
     이 컴포넌트는 remount 되지 않으므로, 노트 없는 게임으로 넘어가면 버튼은 사라지고
     tab 만 'notes' 로 남아 아무 판도 안 보이는 화면이 된다 — 그때 소개로 되돌린다. */
  const notesTab = side.notes.length > 0;
  if (tab === 'notes' && !notesTab) setTab('about');
  /* 이어할 저장이 있는가. 같은 질의를 두 번 보내지 않으려고 내 기록에서 꺼내 쓴다 —
     게스트는 서버 저장이 없어 `me` 가 null 이고, 없는데 안내를 띄우면 거짓말이 된다. */
  const continueHint = side.me?.hasSave ?? false;

  // 몰입 중에는 뒤쪽 문서가 스크롤되면 안 된다 — 조이스틱 드래그가 페이지를 끌고 다닌다.
  useEffect(() => {
    if (!immersive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [immersive]);

  const enterLandscape = useCallback(() => {
    const el = stageRef.current;
    if (!el || document.fullscreenElement) return;
    el.requestFullscreen?.()
      .then(() =>
        (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })
          ?.lock?.('landscape')
          ?.catch(() => undefined),
      )
      .catch(() => undefined);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      (screen.orientation as { unlock?: () => void } | undefined)?.unlock?.();
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    enterLandscape();
  };

  /**
   * 가로 전용 게임은 **시작하면 알아서 가로로 간다** (ADR 없음 — 카탈로그 `orientation` 필드).
   *
   * 이 필드는 도메인 → DTO → gameApi 까지 배선돼 있었는데 **읽는 코드가 없어** 죽은 값이었다.
   * 가로 전용 게임(2560×1440 캔버스 등)이 세로 폰에서 열리면 390×219 CSS px 로 줄어
   * 조작 대상이 손톱만 해진다 — 사용자가 매번 `⛶ 크게` 를 눌러야 했다.
   *
   * 전환은 **사용자 제스처(플레이 버튼) 안에서만** 허용되므로 재생 시작 직후에 부른다.
   * 실패해도(iOS Safari 는 임의 요소 전체화면이 없다) 몰입 오버레이가 뷰포트를 채우므로
   * 기기를 돌리면 그대로 가로가 된다 — 그래서 실패를 삼킨다.
   */
  /* 방향 값을 **ref 로** 들고 있는다 — `handlePlay` 가 이 값에 의존하면 안 되기 때문이다.
     `handlePlay` 는 상세 로드 effect 의 의존성이라, 정체성이 바뀌면 그 effect 가 다시 돌고
     그러면 상세를 또 가져와 다시 렌더 → 무한 루프가 된다. 2026-08-25 운영 회귀로 실측:
     화면이 깜빡이며 "불러오는 중" 에서 진입이 막혔다. 아래 주석이 경고하던 바로 그것이다. */
  const orientationRef = useRef<string | null | undefined>(undefined);
  orientationRef.current = game?.orientation;

  const autoLandscape = useCallback(() => {
    const go = shouldAutoLandscape({
      orientation: orientationRef.current,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      portrait: window.innerHeight >= window.innerWidth,
      fullscreen: !!document.fullscreenElement,
    });
    if (go) enterLandscape();
  }, [enterLandscape]);

  /* 자동 시작(파티 인계)이 상세 로드 직후 이 함수를 부르므로 slug 기준으로 고정한다 —
     매 렌더마다 새로 만들면 그 effect 가 계속 다시 돈다.
     **의존성에 game 에서 파생된 값을 넣지 마라** — 위 orientationRef 가 그래서 있다. */
  const handlePlay = useCallback(async () => {
    setPlaying(true);
    autoLandscape();
    try {
      const session = await startGameSession(slug);
      sessionRef.current = { slug, key: session.sessionKey };
    } catch {
      // 세션 기록 실패는 플레이를 막지 않는다
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    setGame(null);
    setPlaying(false);
    setNotFound(false);
    setMyHalves(null);
    setRatingMessage(null);
    fetchGameDetail(slug)
      .then((detail) => {
        setGame(detail);
        /* 「랜덤으로 돌리기」로 넘어온 판 — 참가자·방식이 이미 정해졌으니 ▶ 를 한 번 더
           누르게 하지 않는다. 여기서 값을 지우지는 않는다: 읽어서 소비하는 쪽은 게임이다 */
        if (peekParty(slug)) void handlePlay();
      })
      .catch(() => setNotFound(true));
    fetchSimilarGames(slug)
      .then(setSimilar)
      .catch(() => setSimilar([]));
  }, [slug, handlePlay]);

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

  const handleClose = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    setPlaying(false);
    setBoardToken((token) => token + 1);
  };

  /**
   * 가로 몰입. 전체화면 API 로 브라우저 크롬까지 걷어낸 뒤 가로로 잠근다 —
   * 세로 그대로 전체화면이 되면 게임만 커지고 얻는 게 없다.
   * iOS Safari 는 임의 요소 전체화면이 없어 실패하는데, 몰입 오버레이가 이미 뷰포트를
   * 채우고 있으므로 기기를 돌리면 그대로 가로 배치가 된다.
   */

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
      : // 조회 실패·로딩 중 모두 프리렌더된 메타를 유지한다 — 실패에 noindex 를 심으면
        // 일시적 장애가 색인 제외로 굳는다 (2026-08-22 place 에서 실측)
        { title: '', lang },
  );

  /* 로딩·에러 화면도 같은 껍데기를 쓴다. 본문만 껍데기 안에 두면 이 두 화면에서는
     사이트 구조가 사라져 돌아갈 길이 뒤로가기뿐이 된다 — 이 커밋이 고치려던 바로 그것이다. */
  if (notFound) {
    return (
      <>
        <GNB items={[]} />
        <div className="games-page kh-arcade">
          <p className="games-status">
            {lang === 'en' ? 'Game not found.' : '게임을 찾을 수 없습니다.'}
          </p>
          <Link className="games-back" to={gamePath(lang, HUB_SUB)} viewTransition>
            {lang === 'en' ? '← Back to all games' : '← 게임 목록으로'}
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  if (!game) {
    return (
      <>
        <GNB items={[]} />
        <div className="games-page games-status">
          {lang === 'en' ? 'Loading…' : '불러오는 중…'}
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      {/* 머리띠·바닥글은 컨테이너 **밖**에 둔다 — 안에 넣으면 max-width 에 갇혀 전폭이 아니다.
          메뉴를 비우는 것은 허브와 같은 이유다: 게임 호스트에서는 같은 경로가 다른 화면을
          가리키므로 링크를 섞으면 어긋난다.

          **게임을 실행하는 동안에는 둘 다 감춘다.** 몰입 상자가 화면을 덮어도 그 뒤로
          문서가 스크롤되면 머리띠·바닥글이 비집고 나온다 — 게임 중에는 게임만 보여야 한다. */}
      {!immersive && <GNB items={[]} />}
    <div className="games-page kh-arcade">
      <div className="games-topbar">
        {/* 로그인/로그아웃은 GNB 가 갖는다. 여기 또 두면 한 화면에 두 번 나온다 —
            GNB 가 없던 시절의 잔재다(허브 topbar 에는 원래 없다). */}
        <Link className="games-favorites-link" to={lang === 'en' ? '/en/favorites' : '/favorites'} viewTransition>
          {lang === 'en' ? 'My favorites' : '내 찜'}
        </Link>
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
            {/* 별점은 아래 소개 패널이 갖는다 — 한 화면에 두 번 찍지 않는다 */}
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

      {/* 넓은 화면은 2단 — 왼쪽에 읽을 것(소개·랭킹·내 기록), 오른쪽에 할 것(썸네일·플레이).
          좁은 화면은 한 단으로 접히고 DOM 순서대로 무대가 먼저 온다.
          **플레이 중에는 2단을 풀어 무대가 전폭을 쓴다** — 게임을 반 폭에 가둘 이유가 없다. */}
      <div className={`game-detail-body${playing ? ' is-playing' : ''}`}>
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
            {/* 스크린샷이 없는 게임이 절반이라 썸네일로 대체한다 — 빈 자리를 남기지 않는다 */}
            <div className="game-stage-shot-wrap">
            <img
              className="game-stage-shot"
              src={`/games/thumbs/shots/${slug}.jpg`}
              alt=""
              loading="eager"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallback) return;
                img.dataset.fallback = '1';
                img.src = game.thumbnailUrl;
              }}
            />
            <button className="game-play-btn" onClick={handlePlay}>
              ▶ {lang === 'en' ? 'Play' : '플레이'}
            </button>
            </div>
            <ul className="game-stage-facts">
              <li>{genreLabel(game.genre, lang)}</li>
              <li>{game.playerMode === 'MULTI'
                ? (lang === 'en' ? '2+ players' : '2인 이상')
                : (lang === 'en' ? 'Single player' : '1인')}</li>
              {game.estimatedMinutes != null && (
                <li>{lang === 'en' ? `~${game.estimatedMinutes} min` : `약 ${game.estimatedMinutes}분`}</li>
              )}
              {game.supportsMobile && <li>{lang === 'en' ? 'Mobile' : '모바일 지원'}</li>}
            </ul>
            {/* 저장이 있을 때만 띄운다. 없을 때 문구가 있으면 소음이고,
                있을 때 안 보이면 처음부터 다시 할까 봐 망설인다 */}
            {continueHint && (
              <p className="game-stage-continue">
                {lang === 'en' ? 'Resumes from your saved progress.' : '저장된 진행에서 이어갑니다.'}
              </p>
            )}
          </div>
        ) : game.loadType === 'INTERNAL_ROUTE' ? (
          <InternalGamePlayer slug={game.entryUrl} />
        ) : (
          <iframe
            ref={stageFit.ref}
            className="game-stage-frame"
            src={game.entryUrl}
            title={game.title}
            allow="autoplay; fullscreen; gamepad; pointer-lock"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock"
            style={stageFit.height ? { height: `${stageFit.height}px`, minHeight: 0 } : undefined}
          />
        )}
      </section>

      {/* 무대 바로 아래 — 내 기록과 평점이 한 줄. 넓은 화면에서는 두 단을 가로질러 앉는다 */}
      <div className="game-detail-mine">
        <GameMyRecordPanel record={side.me} loggedIn={side.loggedIn} lang={lang} />
        <GameRatePanel
          myHalves={myHalves}
          onRate={handleRate}
          ratingMessage={ratingMessage}
          lang={lang}
        />
      </div>

      {/* 좁은 화면 전용 탭. 넓은 화면에서는 CSS 가 이 줄을 감추고 두 판을 모두 편다 */}
      <div className="game-detail-tabs" role="tablist" aria-label={lang === 'en' ? 'Sections' : '구성'}>
        <button
          type="button" role="tab" aria-selected={tab === 'about'}
          className={`game-panel-tab${tab === 'about' ? ' is-on' : ''}`}
          onClick={() => setTab('about')}
        >
          {lang === 'en' ? 'About' : '소개'}
        </button>
        <button
          type="button" role="tab" aria-selected={tab === 'rank'}
          className={`game-panel-tab${tab === 'rank' ? ' is-on' : ''}`}
          onClick={() => setTab('rank')}
        >
          {lang === 'en' ? 'Ranking' : '랭킹'}
        </button>
        {/* 노트가 없는 게임이 대부분이라 탭 자체를 내지 않는다 — 눌러서 빈 판을 만나게 하지 않는다 */}
        {side.notes.length > 0 && (
          <button
            type="button" role="tab" aria-selected={tab === 'notes'}
            className={`game-panel-tab${tab === 'notes' ? ' is-on' : ''}`}
            onClick={() => setTab('notes')}
          >
            {lang === 'en' ? 'Updates' : '업데이트'}
          </button>
        )}
        {/* 제안 탭은 늘 있다 — 비어 있어도 「여기에 쓰면 된다」를 보여 주는 것이 이 판의 일이다 */}
        <button
          type="button" role="tab" aria-selected={tab === 'ideas'}
          className={`game-panel-tab${tab === 'ideas' ? ' is-on' : ''}`}
          onClick={() => setTab('ideas')}
        >
          {lang === 'en' ? 'Suggestions' : '개선 제안'}
        </button>
      </div>

      <div className={`game-tabpane game-pane-about${tab === 'about' ? ' is-on' : ''}`}>
        <GameAboutPanel game={game} lang={lang} favorites={side.favorites} />
      </div>

      {/* 제목은 GameLeaderboard 가 갖는다(새로고침 버튼이 붙어 있다) — 여기 또 달면 두 번 나온다.
          다섯 줄씩 넘겨 본다 — 열 줄을 쌓으면 그 아래가 첫 화면 밖으로 밀린다. */}
      <div className={`game-tabpane game-pane-rank${tab === 'rank' ? ' is-on' : ''}`}>
        <GameLeaderboard
          slug={slug}
          lang={lang}
          scoreBoards={game.scoreBoards ?? []}
          reloadToken={boardToken}
          pageSize={5}
        />
      </div>

      <div className={`game-tabpane game-pane-notes${tab === 'notes' ? ' is-on' : ''}`}>
        <GameReleaseNotesPanel notes={side.notes} lang={lang} />
      </div>

      <div className={`game-tabpane game-pane-ideas${tab === 'ideas' ? ' is-on' : ''}`}>
        <GameSuggestionsPanel slug={slug} lang={lang} loggedIn={side.loggedIn} />
      </div>
      </div>

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
      {!immersive && <Footer />}
    </>
  );
}
