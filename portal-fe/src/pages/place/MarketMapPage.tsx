import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAttraction, type PlaceLang } from '../../api/placeApi';
import { attractionPath, marketMapMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useAttractionMarket, useMarketDishes } from './marketQueries';
import { groupMarketPins, projectMarketPins, topMarketItems, visibleMarketStores } from './marketView';
import { useMarketStoreSearch } from './useMarketStoreSearch';
import { MARKET_STORE_TYPES, marketStoreType, marketStoreTypeColor, marketStoreTypeCounts } from './marketStoreType';
import MarketMap from './MarketMap';
import MarketList, { marketListStores } from './MarketList';
import MarketStoreDetail from './MarketStoreDetail';
import type { MarketViewport } from './MarketNaverMap';
import './PlacePage.css';
import './AttractionMarket.css';
import './MarketMapPage.css';

const SNAPS = ['peek', 'half', 'full'] as const;
/** 마지막 키와 결과를 기억한다 — 같은 키면 같은 값을 돌려준다. */
function rememberLast<K, V>(make: (key: K) => V): (key: K) => V {
  let last: { key: K; value: V } | null = null;
  return (key) => { if (!last || last.key !== key) last = { key, value: make(key) }; return last.value; };
}
// 번호 Map 은 번호가 바뀔 때만 새로 만든다 — 지도는 Map 이 바뀌면 열린 정보창을 다시 그린다.
const numbersOf = (key: string) => new Map(key ? key.split(',').flatMap((id, index) => id ? [[Number(id), index + 1] as const] : []) : []);
type Snap = typeof SNAPS[number];
export default function MarketMapPage() {
  const { pathname } = useLocation();
  return <MarketMapScreen key={pathname} />;
}

function MarketMapScreen() {
  useHeritageSurface();
  const { id = '' } = useParams();
  const { pathname } = useLocation();
  const lang: PlaceLang = pathname.startsWith('/en/') ? 'en' : 'ko';
  const en = lang === 'en';
  const [params, setParams] = useSearchParams();
  const query = params.get('marketQuery') ?? '';
  const [includeOutside, setIncludeOutside] = useState(false);
  const storeType = MARKET_STORE_TYPES.find(type => type.key === params.get('type'))?.key ?? null;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // `?store=` 는 검색 화면 지도에서 「상세보기」로 들어올 때 — 그 가게에 맞추고 상세를 연다. 초깃값만 읽는다.
  const [linkedStore] = useState(() => { const id = Number(params.get('store')); return Number.isSafeInteger(id) && id > 0 ? id : null; });
  const [focusStoreId, setFocusStoreId] = useState<number | null>(linkedStore);
  const [viewport, setViewport] = useState<MarketViewport | null>(null);
  const [snap, setSnap] = useState<Snap>('peek');
  const [detailId, setDetailId] = useState<number | null>(linkedStore);
  // 목록 페이지(「더 보기」)와 번호는 페이지가 갖는다 — 지도가 같은 번호를 핀에 쓴다. 조건이 바뀌면 50으로 돌아간다.
  const [page, setPage] = useState({ key: '', limit: 50 });
  // 아래 조건부 return 뒤에서 쓰므로 useMemo 대신 마운트마다 하나씩 둔다.
  const [numbersFor] = useState(() => rememberLast(numbersOf));
  const pointerStart = useRef<number | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const dragged = useRef(false);
  const attraction = useQuery({ queryKey: ['attraction', id], queryFn: () => fetchAttraction(id), enabled: !!id, retry: false });
  const market = useAttractionMarket(attraction.data?.contentId ?? '', lang, includeOutside);
  const { data: dishes = [] } = useMarketDishes();
  const storeSearch = useMarketStoreSearch(query, attraction.data?.contentId ?? '', lang);
  useSeo({ ...marketMapMeta(lang, attraction.data ?? { id }, market.data), lang });
  if (attraction.isError || (attraction.data && (market.isError || (market.isSuccess && !market.data)))) return <Navigate to={attractionPath(lang, id)} replace />;
  if (!attraction.data || !market.data) return <main aria-busy="true">{en ? 'Loading…' : '불러오는 중…'}</main>;
  const data = market.data;
  const types = marketStoreTypeCounts(visibleMarketStores(data.stores, includeOutside));
  const stores = visibleMarketStores(data.stores, includeOutside, storeType);
  const projection = projectMarketPins(groupMarketPins(stores), data);
  const listing = marketListStores(data, query, storeType, viewport, selectedKey, includeOutside, dishes, storeSearch, focusStoreId == null);
  const resetKey = JSON.stringify([data.market.contentId, query, storeType, viewport, includeOutside, selectedKey]);
  const limit = page.key === resetKey ? page.limit : 50;
  // 번호는 검색 중이면 보이는 결과에, 아니면 선택한 필지(또는 포커스한 가게)에 1부터. 같은 Map 이 목록과 지도에 간다.
  const numbered = listing.searching ? listing.rows.slice(0, limit) : listing.rows.filter(store => listing.selected.has(store) || (focusStoreId != null && store.id === focusStoreId));
  const numbers = numbersFor(numbered.map(store => store.id ?? '').join(','));
  const detailStore = detailId == null ? null : data.stores.find(store => store.id === detailId) ?? null;
  const clear = () => { setSelectedKey(null); setFocusStoreId(null); setDetailId(null); };
  const focusStore = (id: number) => { flushSync(() => setFocusStoreId(null)); setFocusStoreId(id); };
  const deselect = () => { setSelectedKey(null); setFocusStoreId(null); };
  // 지도에서 다른 핀을 고르면 목록에서 맞춘 가게는 놓는다 — 그때부터 목록은 그 핀의 가게만 보인다.
  const selectPin = (key: string | null) => { if (key == null) { deselect(); return; } setSelectedKey(key); setFocusStoreId(current => current != null && groupMarketPins(stores).find(pin => pin.stores.some(store => store.id === current))?.key === key ? current : null); };
  // 같은 가게의 상세보기를 다시 누르면 닫는다.
  const toggleDetail = (id: number) => setDetailId(current => current === id ? null : id);
  const setQuery = (value: string) => { const next = new URLSearchParams(params); if (value) next.set('marketQuery', value); else next.delete('marketQuery'); setParams(next, { replace: true }); clear(); };
  // 품목을 고르면 검색창에 넣는다 — 입력은 제어하지 않으므로 값을 직접 쓴다.
  const pickItem = (item: string) => { if (searchInput.current) searchInput.current.value = item; setQuery(item); setSnap('half'); };
  const pickType = (key: typeof storeType) => { const next = new URLSearchParams(params); if (key) next.set('type', key); else next.delete('type'); setParams(next, { replace: true }); clear(); };
  const color = (store: typeof stores[number]) => marketStoreTypeColor(marketStoreType(store));
  return <main className="market-map-page" data-snap={snap}>
    <div className="market-map-top">
      <Link to={attractionPath(lang, id)} aria-label={en ? 'Back to attraction' : '관광지 상세로'}>←</Link>
      <h1>{(en ? attraction.data.title : null) || data.market.name || attraction.data.title}</h1>
      {/* 제어 입력이면 입력 직후 React 가 URL 의 옛 값을 되써서 한글 조합이 끊긴다(URL 갱신은 트랜지션). 화면은 경로마다 다시 마운트되므로 초깃값만 URL 에서 읽는다. */}
      <input ref={searchInput} type="search" aria-label={en ? 'Find a shop, goods or category' : '가게·품목·업종 찾기'} maxLength={50} defaultValue={query} onFocus={() => setSnap('half')} onChange={event => setQuery(event.target.value)} />
      <label><input type="checkbox" checked={includeOutside} onChange={event => { setIncludeOutside(event.target.checked); clear(); }} />{en ? 'Include outside' : '시장 밖도 보기'}</label>
    </div>
    <nav className="market-map-types" aria-label={en ? 'Shop types' : '가게 유형'}>
      <button type="button" aria-pressed={storeType == null} onClick={() => pickType(null)}>{en ? 'All' : '전체'}</button>
      {types.map(type => <button key={type.key} type="button" aria-pressed={storeType === type.key} onClick={() => pickType(type.key)}><span className="market-map-type-dot" aria-hidden="true" style={{ background: marketStoreTypeColor(type.key) }} />{type[lang]} ({type.count})</button>)}
    </nav>
    <div className="market-map-workspace">
      <div className="market-map-stage">
        {projection ? <MarketMap contentId={attraction.data.contentId} data={data} lang={lang} projection={projection} points={projection.points} hasGeometry={!!data.boundary?.polygon.length || !!data.paths?.some(path => path.geometry.length)} query={query} searchStoreIds={storeSearch.status === 'engine' ? storeSearch.storeIds : undefined} dishes={dishes} selectedKey={selectedKey} focusStoreId={focusStoreId} color={color} numbers={numbers} onViewportChange={setViewport} onSelect={selectPin} onDeselect={deselect} onOpenStore={toggleDetail} openStoreId={detailId} /> : <p>{en ? 'No shop coordinates available.' : '좌표가 있는 가게가 없습니다.'}</p>}
      </div>
      <aside className="market-map-list" aria-label={en ? 'Shop list' : '가게 목록'}>
        <button type="button" className="market-map-handle" aria-label={en ? 'Resize shop list' : '가게 목록 크기 조절'} aria-valuetext={snap} onPointerDown={event => { pointerStart.current = event.clientY; dragged.current = false; event.currentTarget.setPointerCapture?.(event.pointerId); }} onPointerUp={event => {
          const delta = (pointerStart.current ?? event.clientY) - event.clientY; pointerStart.current = null;
          if (Math.abs(delta) >= 60) { dragged.current = true; setSnap(SNAPS[Math.max(0, Math.min(2, SNAPS.indexOf(snap) + (delta > 0 ? 1 : -1)))]); }
        }} onPointerCancel={() => { pointerStart.current = null; }} onClick={() => { if (dragged.current) { dragged.current = false; return; } setSnap(SNAPS[(SNAPS.indexOf(snap) + 1) % 3]); }}><span aria-hidden="true">━</span></button>
        <MarketList search={storeSearch} market={data} listing={listing} limit={limit} numbers={numbers} query={query} focusStore={focusStoreId} openStore={detailId} lang={lang} dishes={dishes} topItems={topMarketItems(stores, lang)} onPickItem={pickItem} onShowAll={deselect} onFocusStore={focusStore} onOpenStore={toggleDetail} onMore={() => setPage({ key: resetKey, limit: limit + 50 })} />
      </aside>
      {detailStore && <MarketStoreDetail store={detailStore} number={detailStore.id == null ? undefined : numbers.get(detailStore.id)} lang={lang} onClose={() => setDetailId(null)} onFocus={focusStore} />}
    </div>
  </main>;
}
