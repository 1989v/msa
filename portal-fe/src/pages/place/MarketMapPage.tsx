import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAttraction, type PlaceLang } from '../../api/placeApi';
import { attractionPath, marketMapMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useAttractionMarket, useMarketDishes } from './marketQueries';
import { groupMarketPins, marketZones, projectMarketPins, visibleMarketStores, zoneIds } from './marketView';
import { useMarketStoreSearch } from './useMarketStoreSearch';
import MarketMap from './MarketMap';
import MarketList from './MarketList';
import type { MarketViewport } from './MarketNaverMap';
import './PlacePage.css';
import './AttractionMarket.css';
import './MarketMapPage.css';

const SNAPS = ['peek', 'half', 'full'] as const;
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
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [expandedZones, setExpandedZones] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [focusStoreId, setFocusStoreId] = useState<number | null>(null);
  const [viewport, setViewport] = useState<MarketViewport | null>(null);
  const [snap, setSnap] = useState<Snap>('peek');
  const pointerStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const attraction = useQuery({ queryKey: ['attraction', id], queryFn: () => fetchAttraction(id), enabled: !!id, retry: false });
  const market = useAttractionMarket(attraction.data?.contentId ?? '', lang, includeOutside);
  const { data: dishes = [] } = useMarketDishes();
  const storeSearch = useMarketStoreSearch(query, attraction.data?.contentId ?? '', lang);
  useSeo({ ...marketMapMeta(lang, attraction.data ?? { id }, market.data), lang });
  if (attraction.isError || (attraction.data && (market.isError || (market.isSuccess && !market.data)))) return <Navigate to={attractionPath(lang, id)} replace />;
  if (!attraction.data || !market.data) return <main aria-busy="true">{en ? 'Loading…' : '불러오는 중…'}</main>;
  const data = market.data;
  const { zones, sortedZones, collapsedZones, countZone, hiddenZoneCount } = marketZones(data, includeOutside, zoneId);
  const zone = zones.find(zone => zone.id === zoneId);
  const stores = visibleMarketStores(data.stores, includeOutside, zone ? zoneIds(zone) : undefined);
  const projection = projectMarketPins(groupMarketPins(stores), data);
  const clear = () => { setSelectedKey(null); setFocusStoreId(null); };
  const pickZone = (id: number | null) => { setZoneId(id); clear(); };
  // 상세 절(AttractionMarket)과 같은 규칙: 구역을 모르면 회색, 길을 모르면 색 없음.
  const color = (id: number | null) => { const index = id == null ? -1 : zones.findIndex(zone => zone.id === id); return index < 0 ? 'var(--ko-text-muted)' : `var(--market-zone-${index % 9 + 1})`; };
  const pathColor = (id: number | null | undefined) => { const index = (data.paths ?? []).findIndex(path => path.id === id); return index < 0 ? undefined : `var(--market-zone-${index % 9 + 1})`; };
  return <main className="market-map-page" data-snap={snap}>
    <div className="market-map-top">
      <Link to={attractionPath(lang, id)} aria-label={en ? 'Back to attraction' : '관광지 상세로'}>←</Link>
      <h1>{(en ? attraction.data.title : null) || data.market.name || attraction.data.title}</h1>
      <input type="search" aria-label={en ? 'Find a shop, goods or category' : '가게·품목·업종 찾기'} maxLength={50} value={query} onFocus={() => setSnap('half')} onChange={event => {
        const next = new URLSearchParams(params); if (event.target.value) next.set('marketQuery', event.target.value); else next.delete('marketQuery'); setParams(next, { replace: true }); clear();
      }} />
      <label><input type="checkbox" checked={includeOutside} onChange={event => { setIncludeOutside(event.target.checked); clear(); }} />{en ? 'Include outside' : '시장 밖도 보기'}</label>
    </div>
    <nav className="market-map-zones" aria-label={en ? 'Market areas' : '시장 구역'}>
      <button type="button" aria-pressed={zoneId == null} onClick={() => pickZone(null)}>{en ? 'All areas' : '전체 구역'}</button>
      {(expandedZones ? sortedZones : collapsedZones).map((zone, index) => <button key={zone.id ?? index} type="button" disabled={zone.id == null} aria-pressed={zoneId != null && zoneId === zone.id} onClick={() => pickZone(zone.id)}>{zone.name} ({countZone(zone)})</button>)}
      {(hiddenZoneCount > 0 || expandedZones) && <button type="button" aria-expanded={expandedZones} onClick={() => setExpandedZones(!expandedZones)}>{expandedZones ? (en ? 'Show fewer roads' : '길 접기') : (en ? `Other roads ${hiddenZoneCount}` : `다른 길 ${hiddenZoneCount}개`)}</button>}
    </nav>
    <div className="market-map-workspace">
      <div className="market-map-stage">
        {projection ? <MarketMap contentId={attraction.data.contentId} data={data} lang={lang} projection={projection} points={projection.points} hasGeometry={!!data.boundary?.polygon.length || !!data.paths?.some(path => path.geometry.length)} query={query} searchStoreIds={storeSearch.status === 'engine' ? storeSearch.storeIds : undefined} dishes={dishes} selectedZoneId={zoneId} onZoneSelect={pickZone} selectedKey={selectedKey} focusStoreId={focusStoreId} color={color} pathColor={pathColor} onViewportChange={setViewport} onSelect={key => { setSelectedKey(key); if (key != null) setSnap('half'); }} /> : <p>{en ? 'No shop coordinates available.' : '좌표가 있는 가게가 없습니다.'}</p>}
      </div>
      <aside className="market-map-list" aria-label={en ? 'Shop list' : '가게 목록'}>
        <button type="button" className="market-map-handle" aria-label={en ? 'Resize shop list' : '가게 목록 크기 조절'} aria-valuetext={snap} onPointerDown={event => { pointerStart.current = event.clientY; dragged.current = false; event.currentTarget.setPointerCapture?.(event.pointerId); }} onPointerUp={event => {
          const delta = (pointerStart.current ?? event.clientY) - event.clientY; pointerStart.current = null;
          if (Math.abs(delta) >= 60) { dragged.current = true; setSnap(SNAPS[Math.max(0, Math.min(2, SNAPS.indexOf(snap) + (delta > 0 ? 1 : -1)))]); }
        }} onPointerCancel={() => { pointerStart.current = null; }} onClick={() => { if (dragged.current) { dragged.current = false; return; } setSnap(SNAPS[(SNAPS.indexOf(snap) + 1) % 3]); }}><span aria-hidden="true">━</span></button>
        <MarketList search={storeSearch} market={data} query={query} zoneId={zoneId} viewport={viewport} selectedKey={selectedKey} focusStore={focusStoreId} includeOutside={includeOutside} lang={lang} dishes={dishes} onFocusStore={id => { flushSync(() => setFocusStoreId(null)); setFocusStoreId(id); }} />
      </aside>
    </div>
  </main>;
}
