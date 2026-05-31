import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SystemPage } from '@/pages/SystemPage';
import { MembersPage } from '@/pages/MembersPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { CodeDictionaryPage } from '@/pages/CodeDictionaryPage';
import { QuantAssetCatalogPage } from '@/pages/QuantAssetCatalogPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SearchDebugPage } from '@/pages/SearchDebugPage';
import { SearchQueryBuilderPage } from '@/pages/SearchQueryBuilderPage';
import { SearchJudgmentsPage } from '@/pages/SearchJudgmentsPage';

export default function App() {
  return (
    <Routes>
      {/* 전용 서브도메인(admin.<domain>) 루트 서빙 — prefix 없이 / 가 곧 대시보드 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/" element={<AppLayout />}>
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
