import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, type ReactElement } from 'react';
import { isApexProd } from './shell/serviceHref';
import AppShellChrome from './components/shell/AppShellChrome';
import HomePage from './pages/HomePage';
import PortfolioPage from './pages/PortfolioPage';
import ShopPage from './pages/ShopPage';
import ShopProductDetailPage from './pages/ShopProductDetailPage';
import MyOrdersPage from './pages/MyOrdersPage';
import ShopLoginPage from './pages/ShopLoginPage';
import ShopOAuthCallbackPage from './pages/ShopOAuthCallbackPage';

// ADR-0058 R3 FE 통합 — 흡수될 sub-app 슬롯 (lazy). P2 에서 실제 앱 라우터로 교체.
// ADR-0059 — 게임 플랫폼 (game:feature API 는 code-dictionary 와 동일 오리진)
const GamesPage = lazy(() => import('./pages/games/GamesPage'));
const GameDetailPage = lazy(() => import('./pages/games/GameDetailPage'));
// ADR-0065 — K-관광/지리 탐색. place.<domain> 이 정규 주소 (host 인식 루트 라우팅),
// apex/개발은 /place. 구글맵 로더 포함이라 lazy 분리.
const PlacePage = lazy(() => import('./pages/place/PlacePage'));
// ADR-0069 — 혜택 링크 허브 (deal.<domain>). place/game 과 같은 host 인식 루트 라우팅.
const DealPage = lazy(() => import('./pages/deal/DealPage'));
// ADR-0072 — 블로그 (blog.<domain>). 본문 렌더(marked/dompurify)가 들어가므로 lazy 로 분리한다.
const BlogHomePage = lazy(() => import('./pages/blog/BlogHomePage'));
const BlogPostPage = lazy(() => import('./pages/blog/BlogPostPage'));
const BlogCategoryPage = lazy(() => import('./pages/blog/BlogCategoryPage'));
const BlogAuthorPage = lazy(() => import('./pages/blog/BlogAuthorPage'));
const BlogStudioPage = lazy(() => import('./pages/blog/BlogStudioPage'));
const BlogEditorPage = lazy(() => import('./pages/blog/BlogEditorPage'));
const BlogLoginPage = lazy(() => import('./pages/blog/BlogLoginPage'));
const AttractionPage = lazy(() => import('./pages/place/AttractionPage'));
// ADR-0071 — 지역 페이지. "제주 가볼 만한 곳" 류 질의의 착지점 (코드 세그먼트: 시도 2자리/시군구 5자리)
const RegionPage = lazy(() => import('./pages/place/RegionPage'));
// ADR-0066 — IT(개념 사전·3D 그래프·트리맵). 메인이 런처가 되면서 three.js 를 쓰지 않게 됐다.
// eager 로 두면 타일만 보는 방문자도 그래프 엔진을 통째로 받는다.
const SearchPage = lazy(() => import('./pages/SearchPage'));
// ADR-0074 — 내 찜 모아보기 (호스트 인식: game=GAME, place=ATTRACTION, blog=BLOG_POST, apex=탭)
const FavoritesPage = lazy(() => import('./components/favorite/FavoritesPage'));
// ADR-0064 — 이력서 (resume.<domain>). 공개 포털 번들과 코드가 섞이지 않게 lazy 로 분리한다.
// ADR-0076 — 개인정보처리방침. 광고·분석의 전제 문서이고 모든 호스트의 푸터가 이 주소를
// 건다. 읽으러 오는 사람만 받으면 되므로 lazy 로 뺀다.
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const ResumePage = lazy(() => import('./pages/resume/ResumePage'));
const ResumeDetailPage = lazy(() => import('./pages/resume/ResumeDetailPage'));
const ResumePrintPage = lazy(() => import('./pages/resume/ResumePrintPage'));
const QuantApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.QuantApp })));
const GifticonApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.GifticonApp })));
const AgentViewerApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.AgentViewerApp })));

// game.<domain> 서브도메인 — 동일 portal-fe 번들을 서빙하되 루트가 게임 허브 (ADR-0059)
const isGamesHost = window.location.hostname.split('.')[0] === 'game';
// place.<domain> — 같은 portal-fe 번들을 서빙하되 루트가 K-관광/지리 탐색이다 (ADR-0065)
const isPlaceHost = window.location.hostname.split('.')[0] === 'place';
// resume.<domain> — 같은 portal-fe 번들을 서빙하되 루트가 이력서다 (ADR-0064)
const isResumeHost = window.location.hostname.split('.')[0] === 'resume';
// deal.<domain> — 같은 번들을 서빙하되 루트가 혜택 링크 허브다 (ADR-0069)
const isDealHost = window.location.hostname.split('.')[0] === 'deal';
// blog.<domain> — 같은 번들을 서빙하되 루트가 블로그다 (ADR-0072)
const isBlogHost = window.location.hostname.split('.')[0] === 'blog';
// apex 의 /games 는 game 서브도메인으로 정리 — 게임 주소를 하나로 고정.
// localhost/k3d 등 개발 환경은 서브도메인이 없으므로 apex 프로덕션에서만 보낸다.
// `isApexProd` 는 전시 타일(TileGrid)과 공유한다 — 기준이 갈리면 타일이 거는 주소와
// 라우트가 어긋난다 (shell/serviceHref.ts).

function GameHostRedirect() {
  const { pathname, search, hash } = window.location;
  // 허브(/games, /en/games)는 게임 호스트에서 루트(/, /en)가 정규 주소다
  const target = pathname === '/games' ? '/' : pathname === '/en/games' ? '/en' : pathname;
  window.location.replace(`https://game.1989v.com${target}${search}${hash}`);
  return null;
}

/** 게임 라우트 — apex 프로덕션에서는 게임 호스트로 보내고, 그 외에는 그대로 렌더 */
function gameRoute(element: ReactElement) {
  return isApexProd ? <GameHostRedirect /> : element;
}

function PlaceHostRedirect() {
  const { pathname, search, hash } = window.location;
  // 허브(/place, /en/place)는 place 호스트에서 루트(/, /en)가 정규 주소다 (ADR-0065)
  const target = pathname.replace(/^(\/en)?\/place/, '$1') || '/';
  window.location.replace(`https://place.1989v.com${target}${search}${hash}`);
  return null;
}

/** place 라우트 — apex 프로덕션에서는 place 호스트로 보내고, 그 외에는 그대로 렌더 */
function placeRoute(element: ReactElement) {
  return isApexProd ? <PlaceHostRedirect /> : element;
}

function DealHostRedirect() {
  const { search, hash } = window.location;
  // 허브는 deal 호스트에서 루트가 정규 주소다 (ADR-0069)
  window.location.replace(`https://deal.1989v.com/${search}${hash}`);
  return null;
}

/** deal 라우트 — apex 프로덕션에서는 deal 호스트로 보내고, 그 외(로컬/개발)에는 그대로 렌더 */
function dealRoute(element: ReactElement) {
  return isApexProd ? <DealHostRedirect /> : element;
}

function BlogHostRedirect() {
  const { pathname, search, hash } = window.location;
  // 허브(/blog)는 블로그 호스트에서 루트가 정규 주소다 (ADR-0072)
  const target = pathname.replace(/^\/blog/, '') || '/';
  window.location.replace(`https://blog.1989v.com${target}${search}${hash}`);
  return null;
}

/** 블로그 라우트 — apex 프로덕션에서는 blog 호스트로 보내고, 그 외(로컬/개발)에는 그대로 렌더 */
function blogRoute(element: ReactElement) {
  return isApexProd ? <BlogHostRedirect /> : element;
}

/**
 * 블로그의 짧은 주소(`/posts/:slug`, `/c/*`, `/authors/:handle`, `/studio`)는 blog 호스트의
 * 것이다. apex 프로덕션에 함께 열면 같은 글이 두 주소로 돌아다녀 canonical 이 갈린다 —
 * 서브도메인이 없는 개발 환경에서만 예외로 연다.
 */
const blogRoutesEnabled = isBlogHost || !isApexProd;

function AdminHostRedirect() {
  window.location.replace('https://admin.1989v.com' + window.location.pathname.replace(/^\/admin/, ''));
  return null;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<div style={{ padding: 32, color: 'var(--ko-text-muted)' }}>로딩…</div>}>
        <Routes>
          {/* apex 루트는 서비스 런처 (ADR-0066). 개념 사전·시각화는 /tech 가 받는다. */}
          <Route
            path="/"
            element={
              isResumeHost ? (
                <ResumePage />
              ) : isGamesHost ? (
                <GamesPage />
              ) : isPlaceHost ? (
                <PlacePage />
              ) : isDealHost ? (
                <DealPage />
              ) : isBlogHost ? (
                <BlogHomePage />
              ) : (
                <HomePage />
              )
            }
          />
          <Route path="/tech" element={<SearchPage />} />
          {/* 내 찜 (ADR-0074) — 개인 화면이라 모든 호스트에서 그 자리 그대로 연다 (리다이렉트 없음) */}
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/en/favorites" element={<FavoritesPage />} />
          {/* 이력서 상세 — resume 호스트에만 둔다. apex 에 열어두면 전체공개 상태에서
              색인 대상인 1989v.com 경로로 이력서가 노출된다 (ADR-0064: 이력서는 noindex) */}
          {isResumeHost && <Route path="/d/:slug" element={<ResumeDetailPage />} />}
          {isResumeHost && <Route path="/print" element={<ResumePrintPage />} />}
          {/* 개인정보처리방침 — 호스트를 가리지 않는다. 서브도메인마다 방침을 따로 두면
              한 곳만 고쳐진 채로 남는다 (ADR-0076) */}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/products/:id" element={<ShopProductDetailPage />} />
          <Route path="/shop/orders" element={<MyOrdersPage />} />
          <Route path="/shop/login" element={<ShopLoginPage />} />
          <Route path="/oauth/callback" element={<ShopOAuthCallbackPage />} />
          {/* 게임 — 언어(/en)와 장르는 URL 로 승격해 검색엔진이 개별 색인할 수 있게 한다 */}
          <Route path="/place" element={placeRoute(<PlacePage />)} />
          <Route path="/en/place" element={placeRoute(<PlacePage />)} />
          {/* 혜택 링크 허브 — 한국어만 (P1). apex 는 서브도메인으로 넘긴다 */}
          <Route path="/deal" element={dealRoute(<DealPage />)} />
          {/* 블로그 — apex 는 서브도메인으로 넘긴다 (ADR-0072) */}
          <Route path="/blog" element={blogRoute(<BlogHomePage />)} />
          {blogRoutesEnabled && <Route path="/posts/:slug" element={<BlogPostPage />} />}
          {blogRoutesEnabled && <Route path="/c/*" element={<BlogCategoryPage />} />}
          {blogRoutesEnabled && <Route path="/authors/:handle" element={<BlogAuthorPage />} />}
          {blogRoutesEnabled && <Route path="/studio" element={<BlogStudioPage />} />}
          {blogRoutesEnabled && <Route path="/studio/write" element={<BlogEditorPage />} />}
          {blogRoutesEnabled && <Route path="/studio/edit/:id" element={<BlogEditorPage />} />}
          {isBlogHost && <Route path="/login" element={<BlogLoginPage />} />}
          {/* 관광지 상세 — 고유명사 검색의 착지점 (ADR-0062). place 호스트가 정규 주소 */}
          {/* 지역 페이지 — 지역 단위 질의의 착지점 (ADR-0071). place 호스트가 정규 주소 */}
          <Route path="/regions/:code" element={placeRoute(<RegionPage />)} />
          <Route path="/en/regions/:code" element={placeRoute(<RegionPage />)} />
          <Route path="/place/regions/:code" element={placeRoute(<RegionPage />)} />
          <Route path="/en/place/regions/:code" element={placeRoute(<RegionPage />)} />
          <Route path="/attractions/:id" element={placeRoute(<AttractionPage />)} />
          <Route path="/en/attractions/:id" element={placeRoute(<AttractionPage />)} />
          <Route path="/place/attractions/:id" element={placeRoute(<AttractionPage />)} />
          <Route path="/en/place/attractions/:id" element={placeRoute(<AttractionPage />)} />

          {/* 개명된 게임의 옛 주소 — 색인·공유 링크가 죽지 않게 새 슬러그로 넘긴다.
              슬러그를 바꿀 때마다 여기 한 줄이 늘어난다 (DB 는 새 슬러그만 안다). */}
          <Route path="/games/rustveil-holdout" element={<Navigate to="/games/deadline" replace />} />
          <Route path="/en/games/rustveil-holdout" element={<Navigate to="/en/games/deadline" replace />} />

          <Route path="/games" element={gameRoute(<GamesPage />)} />
          <Route path="/games/genre/:genre" element={gameRoute(<GamesPage />)} />
          <Route path="/games/:slug" element={gameRoute(<GameDetailPage />)} />
          {/* /en 루트는 호스트 성격을 따른다 — place 호스트: K-관광 영문, 그 외: 게임 허브 영문 */}
          <Route path="/en" element={isPlaceHost ? <PlacePage /> : gameRoute(<GamesPage />)} />
          <Route path="/en/games" element={gameRoute(<GamesPage />)} />
          <Route path="/en/games/genre/:genre" element={gameRoute(<GamesPage />)} />
          <Route path="/en/games/:slug" element={gameRoute(<GameDetailPage />)} />

          {/* 흡수 sub-app 슬롯 (P2 통합 대상) */}
          {/* 어드민은 admin.1989v.com 한 곳뿐이다 — 공개 포털 번들에 어드민 코드를 넣지
              않는다(2026-08-09, ADR-0063). 기존 링크만 정식 호스트로 넘긴다. */}
          <Route path="/admin/*" element={<AdminHostRedirect />} />
          <Route path="/quant/*" element={<QuantApp />} />
          <Route path="/gifticon/*" element={<GifticonApp />} />
          <Route path="/agent-viewer/*" element={<AgentViewerApp />} />
        </Routes>
      </Suspense>
      {/* 모바일 앱 셸 — 탭바 + 스택 전환 방향 판정 (kh-motion-app-shell spec §4) */}
      <AppShellChrome />
    </BrowserRouter>
  );
}

export default App;
