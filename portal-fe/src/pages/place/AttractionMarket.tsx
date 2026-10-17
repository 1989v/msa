import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useAttractionMarket, useMarketDishes, useMarketBasemapMeta } from './marketQueries';
import type { MarketResponse, MarketZone } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { formatGoodPriceMenu, formatGoodPriceSummary, formatMarketFloor, groupMarketPins, hasMarketCoordinate, marketSourceBadges, matchesMarketName, matchesMarketStore, normalizeMarketName, projectMarketPins, visibleMarketStores, zoneIds } from './marketView';
import './AttractionMarket.css';
import MarketMenuDetails from './MarketMenuDetails';
import { marketDisplayName, sectionMatchLabel } from './marketView';
import { placePath } from '../../seo/copy.mjs';
import MarketMap from './MarketMap';
import MarketStewardApplication from './MarketStewardApplication';

const COPY = {
  ko: { title: '시장 구역·가게', type: '시장 유형', count: '점포수', cycle: '개설주기', facilities: '편의시설', all: '전체 구역', zones: '골목·건물·층', search: '가게·품목·업종 찾기', outside: '시장 밖도 보기', out: '시장 밖', unknown: '위치 미확인', found: '찾은 가게', none: '없음', shops: '가게 목록', parcel: '같은 필지 가게', reset: '전체 가게 보기', noCoordinates: '좌표가 있는 가게가 없습니다. 아래 목록을 확인하세요.', noPin: '지도 위치 없음', map: '가게 위치 지도', mapNote: '북쪽이 위입니다. 점은 필지 단위 위치이며, 실제 출입구와 다를 수 있습니다.', reference: '참고 위치는 점선으로 표시합니다.', empty: '이 구역에 표시할 가게가 없습니다.', types: { STREET: '거리형', BUILDING: '건물형', MIXED: '혼합형' } },
  en: { title: 'Market areas & shops', type: 'Market type', count: 'Shop count', cycle: 'Opening schedule', facilities: 'Facilities', all: 'All areas', zones: 'Alleys, buildings & floors', search: 'Find a shop, goods or category', outside: 'Include shops outside the market', out: 'Outside market', unknown: 'Location unconfirmed', found: 'Found shop', none: 'Not found', shops: 'Shop list', parcel: 'Shops on this parcel', reset: 'Show all shops', noCoordinates: 'No shop coordinates available. See the list below.', noPin: 'No map location', map: 'Shop location map', mapNote: 'North is up. Pins show parcel locations and may differ from entrances.', reference: 'Dashed rings indicate reference locations.', empty: 'No shops to display in this area.', types: { STREET: 'Street market', BUILDING: 'Building market', MIXED: 'Mixed market' } },
} as const;

const ZONE_COLORS = Array.from({ length: 9 }, (_, index) => `var(--market-zone-${index + 1})`);
const flattenZones = (zones: MarketZone[]): MarketZone[] => zones.flatMap((zone) => [zone, ...flattenZones(zone.children)]);

/** A failed or absent market response only removes this optional section. */
export default function AttractionMarket({ contentId, lang, initialQuery }: { contentId: string; lang: PlaceLang; initialQuery?: string }) {
  const [includeOutside, setIncludeOutside] = useState(false);
  const { data, isError } = useAttractionMarket(contentId, lang, includeOutside);
  if (!data || isError) return null;
  return <MarketSection key={contentId} contentId={contentId} data={data} lang={lang} initialQuery={initialQuery} includeOutside={includeOutside} onOutside={setIncludeOutside} />;
}

function MarketSection({ contentId, data, lang, initialQuery, includeOutside, onOutside }: {
  contentId: string; data: MarketResponse; lang: PlaceLang; initialQuery?: string; includeOutside: boolean; onOutside: (value: boolean) => void;
}) {
  const C = COPY[lang];
  const { data: dishes = [] } = useMarketDishes();
  const { data: basemapMeta } = useMarketBasemapMeta(contentId);
  const searchId = useId();
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [query, setQuery] = useState(() => (initialQuery ?? new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('marketQuery') ?? '').trim().slice(0, 50));
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollToMarket] = useState(() => Boolean(query || (typeof window !== 'undefined' && window.location.hash === '#market')));
  useEffect(() => {
    if (scrollToMarket || window.location.hash === '#market') sectionRef.current?.scrollIntoView?.({ block: 'start' });
  }, [scrollToMarket]);
  const [parcelKey, setParcelKey] = useState<string | null>(null);
  const [focusStoreId, setFocusStoreId] = useState<number | null>(null);
  const [expandedZones, setExpandedZones] = useState(false);
  const zones = flattenZones(data.zones);
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const stores = visibleMarketStores(data.stores, includeOutside, selectedZone ? zoneIds(selectedZone) : undefined);
  const pins = groupMarketPins(stores);
  const projection = projectMarketPins(pins, data);
  const paths = data.paths ?? [];
  const hasGeometry = Boolean(data.boundary?.polygon.length || paths.some((path) => path.geometry.length));
  const searched = normalizeMarketName(query).length > 0;
  const found = stores.filter((store) => matchesMarketName(store, query, dishes));
  const parcel = pins.find((pin) => pin.key === parcelKey);
  const listed = parcel ? parcel.stores : stores;
  const ordered = [...(searched ? found : listed)].sort((a, b) =>
    (matchesMarketStore(a, query, dishes)?.rank ?? 4) - (matchesMarketStore(b, query, dishes)?.rank ?? 4)
    || a.name.localeCompare(b.name, 'ko') || (a.id ?? 0) - (b.id ?? 0));
  const allVisibleStores = visibleMarketStores(data.stores, includeOutside);
  const countZone = (zone: MarketZone) => { const ids = zoneIds(zone); return allVisibleStores.filter((store) => store.zoneId != null && ids.includes(store.zoneId)).length; };
  const marketName = normalizeMarketName(data.market.name);
  const priority = (zone: MarketZone) => zone.kind === 'ROAD' && marketName.length > 0 && normalizeMarketName(zone.name).includes(marketName);
  const sortedZones = [...zones].sort((a, b) => Number(priority(b)) - Number(priority(a)) || countZone(b) - countZone(a) || a.name.localeCompare(b.name, 'ko', { numeric: true }));
  const defaultZones = sortedZones.filter((zone) => zone.kind !== 'ROAD' || countZone(zone) > 0).slice(0, 8);
  const collapsedZones = sortedZones.filter((zone) => defaultZones.includes(zone) || (zone.id != null && zone.id === zoneId));
  const shownZones = expandedZones ? sortedZones : collapsedZones;
  const hiddenZoneCount = sortedZones.length - collapsedZones.length;
  const matchedLabel = (store: (typeof stores)[number]) => sectionMatchLabel(matchesMarketStore(store, query, dishes), lang);
  const color = (id: number | null) => {
    const index = id == null ? -1 : zones.findIndex((zone) => zone.id === id);
    return index < 0 ? 'var(--ko-text-muted)' : ZONE_COLORS[index % ZONE_COLORS.length];
  };
  const pathColor = (id: number | null | undefined) => {
    const index = paths.findIndex((path) => path.id === id);
    return index < 0 ? undefined : ZONE_COLORS[index % ZONE_COLORS.length];
  };
  const mapPoints = [...(projection?.points ?? [])].sort((a, b) =>
    Number(a.stores.some((store) => matchesMarketName(store, query, dishes)))
    - Number(b.stores.some((store) => matchesMarketName(store, query, dishes))));
  const clearSelection = () => { setParcelKey(null); setFocusStoreId(null); };
  const pickZone = (id: number | null) => { setZoneId(id); clearSelection(); };
  const attribution = data.market.attribution;
  const goodPrice = data.market.goodPrice;
  const facts = [
    [C.type, C.types[data.market.marketType]], [C.count, data.market.storeCountRaw],
    [C.cycle, data.market.openingCycle], [C.facilities, data.market.facilities],
  ];

  return (
    <section id="market" ref={sectionRef} tabIndex={-1} className="place-market" aria-label={C.title} data-place-section="market">
      <h2 className="place-detail-info-title">{C.title}</h2>
      <p className="place-market-name">{data.market.name}</p>
      <dl className="place-market-facts">
        {facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {goodPrice && <p className="place-market-source place-market-good-price-summary">
        {formatGoodPriceSummary(goodPrice, lang)}{' · '}<a href={goodPrice.attribution.url} target="_blank" rel="noreferrer">{goodPrice.attribution.name}</a>
      </p>}
      {attribution && <p className="place-market-source"><a href={attribution.url} target="_blank" rel="noreferrer">{attribution.name}</a>{' · '}{attribution.license}</p>}
      <div className="place-market-controls">
        <label htmlFor={searchId}>{C.search}</label>
        <input id={searchId} type="search" placeholder={lang === 'en' ? 'Shop, item, menu or category' : '가게·품목·메뉴·업종'} value={query} onChange={(event) => { setQuery(event.target.value); clearSelection(); }} />
        <label className="place-market-outside"><input type="checkbox" checked={includeOutside} onChange={(event) => { clearSelection(); onOutside(event.target.checked); }} />{C.outside}</label>
      </div>
      <nav className="place-market-zones" aria-label={C.zones}>
        <button type="button" aria-pressed={zoneId == null} onClick={() => pickZone(null)}>{C.all}</button>
        {shownZones.map((zone, index) => <ZoneFilter key={zone.id ?? `${zone.name}-${index}`} zone={zone} count={countZone(zone)} selected={zoneId} onSelect={pickZone} color={color} lang={lang} />)}
        {(hiddenZoneCount > 0 || expandedZones) && <button type="button" aria-expanded={expandedZones} onClick={() => setExpandedZones((value) => !value)}>
          {expandedZones ? (lang === 'en' ? 'Show fewer roads' : '길 접기') : (lang === 'en' ? `Other roads ${hiddenZoneCount}` : `다른 길 ${hiddenZoneCount}개`)}
        </button>}
      </nav>
      <div className="place-market-layout">
        <div className="place-market-map">
          {data.nearbyRadiusMetres != null && <p className="place-market-note">{lang === 'en' ? `Showing shops within ${data.nearbyRadiusMetres} m of the market` : `시장 주변 ${data.nearbyRadiusMetres} m 안 가게를 보입니다`}</p>}
          {projection ? <MarketMap contentId={contentId} basemapMeta={basemapMeta} data={data} lang={lang} projection={projection} points={mapPoints}
            hasGeometry={hasGeometry} query={query} dishes={dishes} selectedZoneId={zoneId} onZoneSelect={pickZone} selectedKey={parcelKey} focusStoreId={focusStoreId} onSelect={setParcelKey}
            color={color} pathColor={pathColor} basemapAttribution={<p className="place-market-source place-market-basemap-attribution">
              <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>{' · '}
              <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>{' · '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
            </p>} /> : <p>{C.noCoordinates}</p>}
          {(data.attribution ?? []).map((credit, index) => <p key={index} className="place-market-source place-market-geometry-attribution">{credit}</p>)}
          <p className="place-market-note">{C.mapNote} {C.reference}</p>
        </div>
        {(parcelKey == null || searched) && <div className="place-market-panel">
          <h3>{C.shops} ({ordered.length})</h3>
          {searched && <p role="status" aria-label={lang === 'en' ? 'Shop search results' : '가게 검색 결과'}>{found.length ? `${C.found}: ${found.length}` : `${C.none}: ${query.trim()}`}</p>}
          {ordered.length === 0 && <p>{C.empty}</p>}
          <ul className="place-market-shops">
            {ordered.map((store, index) => <li key={store.id ?? `${store.name}-${index}`} data-found={matchesMarketName(store, query, dishes) || undefined} data-outside={store.membership === 'OUT' || undefined}>
              {searched && hasMarketCoordinate(store) && store.id != null
                ? <button type="button" aria-label={`${lang === 'en' ? 'Show on map' : '지도에서 보기'}: ${store.name}`} onClick={() => {
                  // A repeated choice is a fresh focus request, even after panning or closing the sheet.
                  flushSync(() => setFocusStoreId(null));
                  setFocusStoreId(store.id); setParcelKey(null);
                }}><strong>{marketDisplayName(store, lang)}</strong></button>
                : <strong>{marketDisplayName(store, lang)}</strong>}
              <div className="place-market-badges">
                {store.goodPrice && <span className="place-market-good-price-badge">{lang === 'en' ? 'Good price' : '착한가격'}</span>}
                {matchedLabel(store) && <span data-related={matchesMarketStore(store, query, dishes)?.matchedBy === 'related' || undefined}>{matchedLabel(store)}</span>}
                {marketSourceBadges(store, lang).map((badge) => <span key={badge}>{badge}</span>)}
                {store.nearby ? <span>{lang === 'en' ? 'Nearby · Membership unconfirmed' : '주변 · 소속 미확인'}</span> : store.membership === 'OUT' && <span>{C.out}</span>}
                {store.membership === 'UNKNOWN' && <span>{C.unknown}</span>}
                {!hasMarketCoordinate(store) && <span>{C.noPin}</span>}
              </div>
              {store.goodPrice && store.goodPrice.menus.length > 0 && <p className="place-market-good-price-menus">{(parcel ? store.goodPrice.menus : store.goodPrice.menus.slice(0, 2)).map((menu) => formatGoodPriceMenu(menu, lang)).join(' · ')}</p>}
              <MarketMenuDetails store={store} lang={lang} />
              <p>{[store.roadAddress || store.jibunAddress, store.buildingName, store.dong, formatMarketFloor(store.floor, lang), store.ho].filter(Boolean).join(' · ')}</p>
              {store.pinKind === 'REFERENCE' && <p>{[store.relativePosition, store.positionNote].filter(Boolean).join(' · ')}</p>}
            </li>)}
          </ul>
        </div>}
      </div>
      {(data.restaurants ?? []).length > 0 && <section aria-label={lang === 'en' ? 'Restaurants introduced by Korea Tourism Organization' : '관광공사 소개 음식점'}>
        <h3>{lang === 'en' ? 'Restaurants introduced by Korea Tourism Organization' : '관광공사 소개 음식점'}</h3>
        <ul className="place-market-shops">{data.restaurants!.map((restaurant) => <li key={`${restaurant.attraction.lang}-${restaurant.attraction.id}`}>
          <a href={placePath(restaurant.attraction.lang, `/attractions/${restaurant.attraction.id}`)}>{marketDisplayName({ ...restaurant, name: restaurant.title }, lang)}</a>
          <MarketMenuDetails store={{ items: null, tourMenu: restaurant }} lang={lang} />
        </li>)}</ul>
      </section>}
      {data.market.id != null && <MarketStewardApplication marketId={data.market.id} lang={lang} />}
    </section>
  );
}

function ZoneFilter({ zone, count, selected, onSelect, color, lang }: {
  zone: MarketZone; count: number; lang: PlaceLang; selected: number | null; onSelect: (id: number | null) => void; color: (id: number | null) => string;
}) {
  const label = [zone.name, zone.dong, formatMarketFloor(zone.floor, lang)].filter((value, index, values) => value && values.indexOf(value) === index).join(' · ');
  return <div className="place-market-zone" data-kind={zone.kind}>
    <button type="button" disabled={zone.id == null} aria-pressed={zone.id != null && selected === zone.id} onClick={() => onSelect(zone.id)}>
      <span className="place-market-zone-swatch" style={{ background: color(zone.id) }} />{label} ({count})
    </button>
  </div>;
}
