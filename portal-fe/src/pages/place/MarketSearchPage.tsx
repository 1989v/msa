import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchMarkets, searchMarketStores, type MarketSearchResult, type MarketAttractionRef } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import Footer from '../../components/Footer';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { marketMapPath, marketIndexMeta, placeHreflangAlternates, placePath, placeUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { formatGoodPriceMenu, marketDisplayName, marketMatchLabel } from './marketView';
import MarketMenuDetails from './MarketMenuDetails';
import { marketStoreSearchEnabled, marketStoreSearchStatus } from './useMarketStoreSearch';
import './PlacePage.css';
import './MarketSearchPage.css';

const COPY = {
  ko: { back: '← 관광지 탐색', search: '가게·품목 검색', submit: '찾기', markets: '시장', stores: '가게', count: '가게', loading: '불러오는 중…', error: '시장 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', empty: '검색 결과가 없습니다.', previous: '이전', next: '다음', types: { STREET: '거리형', BUILDING: '건물형', MIXED: '혼합형' } },
  en: { back: '← Explore Korea', search: 'Search shops or goods', submit: 'Search', markets: 'Markets', stores: 'Shops', count: 'shops', loading: 'Loading…', error: 'Could not load markets. Please try again in a moment.', empty: 'No results found.', previous: 'Previous', next: 'Next', types: { STREET: 'Street market', BUILDING: 'Building market', MIXED: 'Mixed market' } },
} as const;

function detailHref(attraction: MarketAttractionRef | null, query: string): string | null {
  if (!attraction) return null;
  return `${marketMapPath(attraction.lang, attraction.id)}${query ? `?marketQuery=${encodeURIComponent(query)}` : ''}`;
}

/** A market without a TourAPI attraction row has no detail page; show the result without a dead link. */
function ResultLink({ to, children }: { to: string | null; children: ReactNode }) {
  return to ? <Link to={to}>{children}</Link> : <div>{children}</div>;
}

export default function MarketSearchPage() {
  useHeritageSurface();
  const { pathname, search } = useLocation();
  const lang: PlaceLang = pathname.startsWith('/en') ? 'en' : 'ko';
  const C = COPY[lang];
  const meta = marketIndexMeta(lang);
  // Query parameters are accepted for shared entry links only. Searches stay on the hub URL.
  const [input, setInput] = useState(() => (new URLSearchParams(search).get('q') ?? '').trim().slice(0, 50));
  const [query, setQuery] = useState(input);
  const [page, setPage] = useState(0);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-search', query, lang, page],
    queryFn: async (): Promise<MarketSearchResult> => {
      const engine = marketStoreSearchEnabled(query) ? await searchMarketStores(query, { lang, page, size: 20 }) : null;
      if (marketStoreSearchStatus(query, engine) === 'fallback' || !engine) return searchMarkets(query, lang, page);
      return {
        query,
        markets: engine.markets.map(market => ({ contentId: market.contentId,
          name: lang === 'en' ? market.marketNameEn || market.marketName : market.marketName,
          region: market.region ?? null, marketType: market.marketType ?? '', storeCount: market.count, attraction: market.attraction ?? null })),
        stores: { total: engine.total, page, size: 20, items: engine.items.map(shop => ({
          storeId: shop.storeId, name: shop.name ?? '', nameEn: shop.nameEn, items: null,
          category: shop.categorySub ?? null, categoryEn: shop.categorySubEn,
          marketContentId: shop.contentId, marketName: shop.marketName ?? '', zoneName: shop.address ?? null,
          latitude: null, longitude: null, attraction: shop.attraction ?? null, matchedBy: shop.matchedBy,
          goodPrice: shop.goodPrice ? { category: shop.categorySub ?? '', menus: (shop.goodPriceMenus ?? []).map(name => ({ name, price: null })) } : null,
        })) },
      };
    },
    staleTime: 60_000, retry: false,
  });
  useSeo({ ...meta, canonical: placeUrl(lang, '/markets'), lang, alternates: placeHreflangAlternates('/markets') });
  const shops = data?.stores.items ?? [];
  return <div className="place-page">
    <header className="place-header"><nav aria-label={lang === 'en' ? 'Breadcrumb' : '탐색 경로'}><Link className="place-btn" to={placePath(lang)}>{C.back}</Link></nav></header>
    <main className="market-search-main">
      <h1 className="place-detail-title">{meta.heading}</h1><p className="place-subtitle">{meta.description}</p>
      <form className="market-search-form" onSubmit={(event) => { event.preventDefault(); setQuery(input.trim()); setPage(0); }}>
        <label htmlFor="market-search">{C.search}</label>
        <div><input id="market-search" type="search" maxLength={50} value={input} onChange={(event) => setInput(event.target.value)} /><button type="submit" className="place-btn">{C.submit}</button></div>
      </form>
      {isLoading && <p role="status">{C.loading}</p>}
      {isError && <p role="alert">{C.error}</p>}
      {data && !isError && <>
        {data.markets.length > 0 && <section aria-label={C.markets}><h2>{C.markets}</h2><ul className="market-search-results">{data.markets.map((market) => <li key={market.contentId}>
          <ResultLink to={detailHref(market.attraction, query)}><strong>{market.name}</strong><span>{[market.region, C.types[market.marketType as keyof typeof C.types], `${market.storeCount} ${C.count}`].filter(Boolean).join(' · ')}</span></ResultLink>
        </li>)}</ul></section>}
        {query && shops.length > 0 && <section aria-label={C.stores}><h2>{C.stores} ({data.stores.total})</h2><ul className="market-search-results">{shops.map((shop) => <li key={shop.storeId}>
          <ResultLink to={detailHref(shop.attraction, query)}><strong>{marketDisplayName(shop, lang)}</strong>{shop.goodPrice && <>
            <span className="market-search-good-price-badge">{lang === 'en' ? 'Good price' : '착한가격'}</span>
            {shop.goodPrice.menus[0] && <span className="market-search-good-price-menu">{formatGoodPriceMenu(shop.goodPrice.menus[0], lang)}</span>}
          </>}<span>{[lang === 'en' ? shop.itemsEn || shop.items : shop.items, lang === 'en' ? shop.categoryEn || shop.category : shop.category].filter(Boolean).join(' · ')}</span><span data-related={shop.matchedBy === 'RELATED_CATEGORY' || undefined}>{marketMatchLabel(shop.matchedBy, shop.relatedCategory, lang)}</span><MarketMenuDetails store={{ ...shop, items: null, itemsEn: null, category: null, categoryEn: null }} lang={lang} /><span>{[shop.marketName, shop.zoneName].filter(Boolean).join(' · ')}</span></ResultLink>
        </li>)}</ul></section>}
        {data.markets.length === 0 && shops.length === 0 && <p role="status">{C.empty}</p>}
        <nav className="market-search-pagination" aria-label={lang === 'en' ? 'Result pages' : '결과 페이지'}>
          {page > 0 && <button type="button" className="place-btn" onClick={() => setPage(page - 1)}>{C.previous}</button>}
          {(query ? (page + 1) * data.stores.size < data.stores.total : data.markets.length === data.stores.size) && <button type="button" className="place-btn" onClick={() => setPage(page + 1)}>{C.next}</button>}
        </nav>
      </>}
    </main><Footer lang={lang} />
  </div>;
}
