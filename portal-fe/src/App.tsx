import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy, type ReactElement } from 'react';
import SearchPage from './pages/SearchPage';
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
// ADR-0065 — K-관광 지도 검색 (/tour, /en/tour). 구글맵 로더 포함이라 lazy 분리.
const TourPage = lazy(() => import('./pages/tour/TourPage'));
// ADR-0064 — 이력서 (resume.<domain>). 공개 포털 번들과 코드가 섞이지 않게 lazy 로 분리한다.
const ResumePage = lazy(() => import('./pages/resume/ResumePage'));
const ResumeDetailPage = lazy(() => import('./pages/resume/ResumeDetailPage'));
const QuantApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.QuantApp })));
const GifticonApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.GifticonApp })));
const AgentViewerApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.AgentViewerApp })));

// game.<domain> 서브도메인 — 동일 portal-fe 번들을 서빙하되 루트가 게임 허브 (ADR-0059)
const isGamesHost = window.location.hostname.split('.')[0] === 'game';
// resume.<domain> — 같은 portal-fe 번들을 서빙하되 루트가 이력서다 (ADR-0064)
const isResumeHost = window.location.hostname.split('.')[0] === 'resume';
// apex 의 /games 는 game 서브도메인으로 정리 — 게임 주소를 하나로 고정.
// localhost/k3d 등 개발 환경은 서브도메인이 없으므로 apex 프로덕션에서만 보낸다.
const isApexProd = window.location.hostname === '1989v.com';

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

function AdminHostRedirect() {
  window.location.replace('https://admin.1989v.com' + window.location.pathname.replace(/^\/admin/, ''));
  return null;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<div style={{ padding: 32, color: 'var(--ko-text-muted)' }}>로딩…</div>}>
        <Routes>
          {/* portal 자체 (코드사전/포트폴리오/커머스) */}
          <Route
            path="/"
            element={isResumeHost ? <ResumePage /> : isGamesHost ? <GamesPage /> : <SearchPage />}
          />
          {/* 이력서 상세 — resume 호스트에만 둔다. apex 에 열어두면 전체공개 상태에서
              색인 대상인 1989v.com 경로로 이력서가 노출된다 (ADR-0064: 이력서는 noindex) */}
          {isResumeHost && <Route path="/d/:slug" element={<ResumeDetailPage />} />}
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/products/:id" element={<ShopProductDetailPage />} />
          <Route path="/shop/orders" element={<MyOrdersPage />} />
          <Route path="/shop/login" element={<ShopLoginPage />} />
          <Route path="/oauth/callback" element={<ShopOAuthCallbackPage />} />
          {/* 게임 — 언어(/en)와 장르는 URL 로 승격해 검색엔진이 개별 색인할 수 있게 한다 */}
          <Route path="/tour" element={<TourPage />} />
          <Route path="/en/tour" element={<TourPage />} />

          <Route path="/games" element={gameRoute(<GamesPage />)} />
          <Route path="/games/genre/:genre" element={gameRoute(<GamesPage />)} />
          <Route path="/games/:slug" element={gameRoute(<GameDetailPage />)} />
          <Route path="/en" element={gameRoute(<GamesPage />)} />
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
    </BrowserRouter>
  );
}

export default App;
