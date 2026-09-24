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
import { GamesPage } from '@/pages/GamesPage';
import { GameSuggestionsPage } from '@/pages/games/GameSuggestionsPage';
import { PrivateGamesPage } from '@/pages/games/PrivateGamesPage';
import { QuantAssetCatalogPage } from '@/pages/QuantAssetCatalogPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SearchDebugPage } from '@/pages/SearchDebugPage';
import { SearchQueryBuilderPage } from '@/pages/SearchQueryBuilderPage';
import { SearchJudgmentsPage } from '@/pages/SearchJudgmentsPage';
import { ResumePage } from '@/pages/ResumePage';
import { ResumeProfilePage } from '@/pages/ResumeProfilePage';
import { DisplayServicesPage } from '@/pages/DisplayServicesPage';
import { DealOffersPage } from '@/pages/DealOffersPage';
import { DealCategoriesPage } from '@/pages/DealCategoriesPage';
// ADR-0072 — blog.1989v.com. 운영자가 글을 쓰는 기본 경로가 여기다.
import { BlogPostsPage } from '@/pages/blog/BlogPostsPage';
import { BlogCategoriesPage } from '@/pages/blog/BlogCategoriesPage';
import { BlogAuthorsPage } from '@/pages/blog/BlogAuthorsPage';
import { SellersPage } from '@/pages/SellersPage';
import { PromotionsPage } from '@/pages/PromotionsPage';
import { SettlementsPage } from '@/pages/SettlementsPage';
import { BlogCommentsPage } from '@/pages/blog/BlogCommentsPage';
// ADR-0098 — 광고 네트워크 운영(심사·광고주·지면·문맥·HOUSE·리포트·원장)
import { AdsReviewPage } from '@/pages/ads/AdsReviewPage';
import { AdsAdvertisersPage } from '@/pages/ads/AdsAdvertisersPage';
import { AdsPlacementsPage } from '@/pages/ads/AdsPlacementsPage';
import { AdsContextMappingsPage } from '@/pages/ads/AdsContextMappingsPage';
import { AdsHousePage } from '@/pages/ads/AdsHousePage';
import { AdsPublisherReportPage } from '@/pages/ads/AdsPublisherReportPage';
import { AdsLedgerCheckPage } from '@/pages/ads/AdsLedgerCheckPage';

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
        <Route path="sellers" element={<SellersPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="settlements" element={<SettlementsPage />} />
        <Route path="code-dictionary" element={<CodeDictionaryPage />} />
        <Route path="games" element={<GamesPage />} />
        <Route path="games/suggestions" element={<GameSuggestionsPage />} />
        <Route path="games/private" element={<PrivateGamesPage />} />
        <Route path="quant/assets" element={<QuantAssetCatalogPage />} />
        <Route path="resume" element={<ResumePage />} />
        <Route path="resume/profile" element={<ResumeProfilePage />} />
        <Route path="display/services" element={<DisplayServicesPage />} />
        <Route path="deal/offers" element={<DealOffersPage />} />
        <Route path="deal/categories" element={<DealCategoriesPage />} />
        <Route path="blog/posts" element={<BlogPostsPage />} />
        <Route path="blog/categories" element={<BlogCategoriesPage />} />
        <Route path="blog/authors" element={<BlogAuthorsPage />} />
        <Route path="blog/comments" element={<BlogCommentsPage />} />
        <Route path="ads/review" element={<AdsReviewPage />} />
        <Route path="ads/advertisers" element={<AdsAdvertisersPage />} />
        <Route path="ads/placements" element={<AdsPlacementsPage />} />
        <Route path="ads/context-mappings" element={<AdsContextMappingsPage />} />
        <Route path="ads/house" element={<AdsHousePage />} />
        <Route path="ads/publisher-report" element={<AdsPublisherReportPage />} />
        <Route path="ads/ledger" element={<AdsLedgerCheckPage />} />
        <Route path="search-debug" element={<SearchDebugPage />} />
        <Route path="search-debug/query-builder" element={<SearchQueryBuilderPage />} />
        <Route path="search-debug/judgments" element={<SearchJudgmentsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}
