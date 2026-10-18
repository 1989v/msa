import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchMarkets, searchMarketStores, type MarketSearchResult, type MarketAttractionRef } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import Footer from '../../components/Footer';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { NAVER_MAP_KEY_ID, marketMapPath, marketIndexMeta, placeHreflangAlternates, placePath, placeUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { formatGoodPriceMenu, marketDisplayName, marketMatchLabel } from './marketView';
import MarketMenuDetails from './MarketMenuDetails';
import MarketSearchMap, { type MarketSearchPick } from './MarketSearchMap';
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

/** A market without a TourAPI attraction row has no detail page; show the result without a dead link.
 * 평범한 클릭은 옆 지도에 그 시장을 띄우고, 새 탭·수정 키 클릭은 링크 그대로 전체 지도로 간다. */
function ResultLink({ to, current, onPick, children }: { to: string | null; current: boolean; onPick: () => void; children: ReactNode }) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    // 이미 지도에 띄운 결과를 다시 누르면 전체 지도로 간다. 지도 키가 없으면 늘 링크다.
    if (!NAVER_MAP_KEY_ID || current || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onPick();
  };
  return to ? <Link to={to} aria-current={current || undefined} onClick={click}>{children}</Link> : <div>{children}</div>;
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
  const [picked, setPicked] = useState<{ query: string; pick: MarketSearchPick } | null>(null);
  const mapRef = useRef<HTMLElement>(null);
  // 검색어가 있으면 첫 결과의 시장을 기본으로 띄운다. 결과를 누르면 그 시장(가게면 그 가게)으로 바꾼다.
  const fallback: MarketSearchPick | null = !query || !data ? null : data.markets[0]
    ? { contentId: data.markets[0].contentId, name: data.markets[0].name, attraction: data.markets[0].attraction, storeId: null }
    : shops[0] ? { contentId: shops[0].marketContentId, name: shops[0].marketName, attraction: shops[0].attraction, storeId: null } : null;
  const pick = picked?.query === query ? picked.pick : fallback;
  const choose = (next: MarketSearchPick) => { setPicked({ query, pick: next }); mapRef.current?.scrollIntoView?.({ block: 'nearest' }); };
  return <div className="place-page">
    <header className="place-header"><nav aria-label={lang === 'en' ? 'Breadcrumb' : '탐색 경로'}><Link className="place-btn" to={placePath(lang)}>{C.back}</Link></nav></header>
    <main className="market-search-main" data-map={pick ? '' : undefined}>
      <h1 className="place-detail-title">{meta.heading}</h1><p className="place-subtitle">{meta.description}</p>
      <form className="market-search-form" onSubmit={(event) => { event.preventDefault(); setQuery(input.trim()); setPage(0); }}>
        <label htmlFor="market-search">{C.search}</label>
        <div><input id="market-search" type="search" maxLength={50} value={input} onChange={(event) => setInput(event.target.value)} /><button type="submit" className="place-btn">{C.submit}</button></div>
      </form>
      {pick && <MarketSearchMap ref={mapRef} pick={pick} lang={lang} query={query} results={data?.stores.items} />}
      <div className="market-search-body">
      {isLoading && <p role="status">{C.loading}</p>}
      {isError && <p role="alert">{C.error}</p>}
      {data && !isError && <>
        {data.markets.length > 0 && <section aria-label={C.markets}><h2>{C.markets}</h2><ul className="market-search-results">{data.markets.map((market) => <li key={market.contentId}>
          <ResultLink to={detailHref(market.attraction, query)} current={pick?.contentId === market.contentId && pick.storeId == null} onPick={() => choose({ contentId: market.contentId, name: market.name, attraction: market.attraction, storeId: null })}><strong>{market.name}</strong><span>{[market.region, C.types[market.marketType as keyof typeof C.types], `${market.storeCount} ${C.count}`].filter(Boolean).join(' · ')}</span></ResultLink>
        </li>)}</ul></section>}
        {query && shops.length > 0 && <section aria-label={C.stores}><h2>{C.stores} ({data.stores.total})</h2><ul className="market-search-results">{shops.map((shop) => <li key={shop.storeId}>
          <ResultLink to={detailHref(shop.attraction, query)} current={pick?.storeId === shop.storeId} onPick={() => choose({ contentId: shop.marketContentId, name: shop.marketName, attraction: shop.attraction, storeId: shop.storeId })}><strong>{marketDisplayName(shop, lang)}</strong>{shop.goodPrice && <>
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
      </div>
    </main><Footer lang={lang} />
  </div>;
}
