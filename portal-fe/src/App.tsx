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
const AdminApp = lazy(() => import('./apps/admin/App'));
// ADR-0059 — 게임 플랫폼 (game:feature API 는 code-dictionary 와 동일 오리진)
const GamesPage = lazy(() => import('./pages/games/GamesPage'));
const GameDetailPage = lazy(() => import('./pages/games/GameDetailPage'));
const QuantApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.QuantApp })));
const GifticonApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.GifticonApp })));
const AgentViewerApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.AgentViewerApp })));

// game.<domain> 서브도메인 — 동일 portal-fe 번들을 서빙하되 루트가 게임 허브 (ADR-0059)
const isGamesHost = window.location.hostname.split('.')[0] === 'game';
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

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<div style={{ padding: 32, color: 'var(--ko-text-muted)' }}>로딩…</div>}>
        <Routes>
          {/* portal 자체 (코드사전/포트폴리오/커머스) */}
          <Route path="/" element={isGamesHost ? <GamesPage /> : <SearchPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/products/:id" element={<ShopProductDetailPage />} />
          <Route path="/shop/orders" element={<MyOrdersPage />} />
          <Route path="/shop/login" element={<ShopLoginPage />} />
          <Route path="/oauth/callback" element={<ShopOAuthCallbackPage />} />
          {/* 게임 — 언어(/en)와 장르는 URL 로 승격해 검색엔진이 개별 색인할 수 있게 한다 */}
          <Route path="/games" element={gameRoute(<GamesPage />)} />
          <Route path="/games/genre/:genre" element={gameRoute(<GamesPage />)} />
          <Route path="/games/:slug" element={gameRoute(<GameDetailPage />)} />
          <Route path="/en" element={gameRoute(<GamesPage />)} />
          <Route path="/en/games" element={gameRoute(<GamesPage />)} />
          <Route path="/en/games/genre/:genre" element={gameRoute(<GamesPage />)} />
          <Route path="/en/games/:slug" element={gameRoute(<GameDetailPage />)} />

          {/* 흡수 sub-app 슬롯 (P2 통합 대상) */}
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/quant/*" element={<QuantApp />} />
          <Route path="/gifticon/*" element={<GifticonApp />} />
          <Route path="/agent-viewer/*" element={<AgentViewerApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
