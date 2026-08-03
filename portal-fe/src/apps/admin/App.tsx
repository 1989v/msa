import './index.css';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@admin/components/layout/AppLayout';
import { LoginPage } from '@admin/pages/LoginPage';
import { OAuthCallbackPage } from '@admin/pages/OAuthCallbackPage';
import { UnauthorizedPage } from '@admin/pages/UnauthorizedPage';
import { DashboardPage } from '@admin/pages/DashboardPage';
import { SystemPage } from '@admin/pages/SystemPage';
import { MembersPage } from '@admin/pages/MembersPage';
import { ProductsPage } from '@admin/pages/ProductsPage';
import { OrdersPage } from '@admin/pages/OrdersPage';
import { CodeDictionaryPage } from '@admin/pages/CodeDictionaryPage';
import { QuantAssetCatalogPage } from '@admin/pages/QuantAssetCatalogPage';
import { ProfilePage } from '@admin/pages/ProfilePage';
import { SearchDebugPage } from '@admin/pages/SearchDebugPage';
import { SearchQueryBuilderPage } from '@admin/pages/SearchQueryBuilderPage';
import { SearchJudgmentsPage } from '@admin/pages/SearchJudgmentsPage';

export default function App() {
  return (
    <Routes>
      {/* 전용 서브도메인(admin.<domain>) 루트 서빙 — prefix 없이 / 가 곧 대시보드 */}
      <Route path="login" element={<LoginPage />} />
      <Route path="oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="unauthorized" element={<UnauthorizedPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="code-dictionary" element={<CodeDictionaryPage />} />
        <Route path="quant/assets" element={<QuantAssetCatalogPage />} />
        <Route path="search-debug" element={<SearchDebugPage />} />
        <Route path="search-debug/query-builder" element={<SearchQueryBuilderPage />} />
        <Route path="search-debug/judgments" element={<SearchJudgmentsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}