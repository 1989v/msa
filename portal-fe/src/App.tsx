import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import SearchPage from './pages/SearchPage';
import PortfolioPage from './pages/PortfolioPage';
import ShopPage from './pages/ShopPage';
import ShopProductDetailPage from './pages/ShopProductDetailPage';
import MyOrdersPage from './pages/MyOrdersPage';
import ShopLoginPage from './pages/ShopLoginPage';
import ShopOAuthCallbackPage from './pages/ShopOAuthCallbackPage';

// ADR-0058 R3 FE 통합 — 흡수될 sub-app 슬롯 (lazy). P2 에서 실제 앱 라우터로 교체.
const AdminApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.AdminApp })));
const QuantApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.QuantApp })));
const GifticonApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.GifticonApp })));
const AgentViewerApp = lazy(() => import('./shell/placeholders').then((m) => ({ default: m.AgentViewerApp })));

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<div style={{ padding: 32, color: 'var(--ko-text-muted)' }}>로딩…</div>}>
        <Routes>
          {/* portal 자체 (코드사전/포트폴리오/커머스) */}
          <Route path="/" element={<SearchPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/products/:id" element={<ShopProductDetailPage />} />
          <Route path="/shop/orders" element={<MyOrdersPage />} />
          <Route path="/shop/login" element={<ShopLoginPage />} />
          <Route path="/oauth/callback" element={<ShopOAuthCallbackPage />} />

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
