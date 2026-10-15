import { useId, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarket, type MarketResponse, type MarketZone } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { formatMarketFloor, groupMarketPins, longestMarketSegmentMidpoint, hasMarketCoordinate, marketSourceBadges, matchesMarketName, normalizeMarketName, projectMarketPins, visibleMarketStores, zoneIds } from './marketView';
import './AttractionMarket.css';
import MarketStewardApplication from './MarketStewardApplication';

const COPY = {
  ko: { title: '시장 구역·가게', type: '시장 유형', count: '점포수', cycle: '개설주기', facilities: '편의시설', all: '전체 구역', zones: '골목·건물·층', search: '가게 이름 찾기', outside: '시장 밖도 보기', out: '시장 밖', unknown: '소속 미확인', found: '찾은 가게', none: '없음', shops: '가게 목록', parcel: '같은 필지 가게', reset: '전체 가게 보기', noCoordinates: '좌표가 있는 가게가 없습니다. 아래 목록을 확인하세요.', noPin: '지도 위치 없음', map: '가게 위치 지도', mapNote: '북쪽이 위입니다. 점은 필지 단위 위치이며, 실제 출입구와 다를 수 있습니다.', reference: '참고 위치는 점선으로 표시합니다.', empty: '이 구역에 표시할 가게가 없습니다.', types: { STREET: '거리형', BUILDING: '건물형', MIXED: '혼합형' } },
  en: { title: 'Market areas & shops', type: 'Market type', count: 'Shop count', cycle: 'Opening schedule', facilities: 'Facilities', all: 'All areas', zones: 'Alleys, buildings & floors', search: 'Find a shop by name', outside: 'Include shops outside the market', out: 'Outside market', unknown: 'Membership unconfirmed', found: 'Found shop', none: 'Not found', shops: 'Shop list', parcel: 'Shops on this parcel', reset: 'Show all shops', noCoordinates: 'No shop coordinates available. See the list below.', noPin: 'No map location', map: 'Shop location map', mapNote: 'North is up. Pins show parcel locations and may differ from entrances.', reference: 'Dashed rings indicate reference locations.', empty: 'No shops to display in this area.', types: { STREET: 'Street market', BUILDING: 'Building market', MIXED: 'Mixed market' } },
} as const;

const ZONE_COLORS = Array.from({ length: 9 }, (_, index) => `var(--market-zone-${index + 1})`);
const flattenZones = (zones: MarketZone[]): MarketZone[] => zones.flatMap((zone) => [zone, ...flattenZones(zone.children)]);

/** A failed or absent market response only removes this optional section. */
export default function AttractionMarket({ contentId, lang }: { contentId: string; lang: PlaceLang }) {
  const [includeOutside, setIncludeOutside] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ['attraction-market', contentId, includeOutside, lang],
    queryFn: () => fetchMarket(contentId, includeOutside, lang),
    enabled: contentId.length > 0,
    staleTime: 10 * 60_000,
    retry: false,
    placeholderData: (previous) => previous,
  });
  if (!data || isError) return null;
  return <MarketSection key={contentId} data={data} lang={lang} includeOutside={includeOutside} onOutside={setIncludeOutside} />;
}

function MarketSection({ data, lang, includeOutside, onOutside }: {
  data: MarketResponse; lang: PlaceLang; includeOutside: boolean; onOutside: (value: boolean) => void;
}) {
  const C = COPY[lang];
  const searchId = useId();
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [parcelKey, setParcelKey] = useState<string | null>(null);
  const zones = flattenZones(data.zones);
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const stores = visibleMarketStores(data.stores, includeOutside, selectedZone ? zoneIds(selectedZone) : undefined);
  const pins = groupMarketPins(stores);
  const projection = projectMarketPins(pins, data);
  const paths = data.paths ?? [];
  const hasGeometry = Boolean(data.boundary?.polygon.length || paths.some((path) => path.geometry.length));
  const searched = normalizeMarketName(query).length > 0;
  const found = stores.filter((store) => matchesMarketName(store, query));
  const parcel = pins.find((pin) => pin.key === parcelKey);
  const listed = parcel ? parcel.stores : stores;
  const ordered = [...listed].sort((a, b) => Number(matchesMarketName(b, query)) - Number(matchesMarketName(a, query)));
  const color = (id: number | null) => {
    const index = id == null ? -1 : zones.findIndex((zone) => zone.id === id);
    return index < 0 ? 'var(--ko-text-muted)' : ZONE_COLORS[index % ZONE_COLORS.length];
  };
  const pathColor = (id: number | null | undefined) => {
    const index = paths.findIndex((path) => path.id === id);
    return index < 0 ? undefined : ZONE_COLORS[index % ZONE_COLORS.length];
  };
  const mapPoints = [...(projection?.points ?? [])].filter((pin) => !hasGeometry
    || (pin.x >= 0 && pin.x <= 600 && pin.y >= 0 && pin.y <= 440)).sort((a, b) =>
    Number(a.stores.some((store) => matchesMarketName(store, query)))
    - Number(b.stores.some((store) => matchesMarketName(store, query))));
  const pickZone = (id: number | null) => { setZoneId(id); setParcelKey(null); };
  const attribution = data.market.attribution;
  const facts = [
    [C.type, C.types[data.market.marketType]], [C.count, data.market.storeCountRaw],
    [C.cycle, data.market.openingCycle], [C.facilities, data.market.facilities],
  ];

  return (
    <section className="place-market" aria-label={C.title} data-place-section="market">
      <h2 className="place-detail-info-title">{C.title}</h2>
      <p className="place-market-name">{data.market.name}</p>
      <dl className="place-market-facts">
        {facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {attribution && <p className="place-market-source"><a href={attribution.url} target="_blank" rel="noreferrer">{attribution.name}</a>{' · '}{attribution.license}</p>}
      <div className="place-market-controls">
        <label htmlFor={searchId}>{C.search}</label>
        <input id={searchId} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setParcelKey(null); }} />
        <label className="place-market-outside"><input type="checkbox" checked={includeOutside} onChange={(event) => { setParcelKey(null); onOutside(event.target.checked); }} />{C.outside}</label>
      </div>
      <nav className="place-market-zones" aria-label={C.zones}>
        <button type="button" aria-pressed={zoneId == null} onClick={() => pickZone(null)}>{C.all}</button>
        {data.zones.map((zone, index) => <ZoneFilter key={zone.id ?? `${zone.name}-${index}`} zone={zone} selected={zoneId} onSelect={pickZone} color={color} lang={lang} />)}
      </nav>
      <div className="place-market-layout">
        <div className="place-market-map">
          {projection ? <div className="place-market-canvas" data-geometry={hasGeometry || undefined} role="group" aria-label={C.map}><svg viewBox="0 0 600 440" aria-hidden="true">
            {data.boundary && <polygon className="place-market-boundary" points={data.boundary.polygon.map((coordinate) => {
              const point = projection.project(coordinate);
              return `${point.x},${point.y}`;
            }).join(' ')} />}
            {paths.map((path) => {
              const points = path.geometry.map(projection.project);
              return <g key={path.id} style={{ '--market-path-color': pathColor(path.id) } as CSSProperties}>
                <polyline className="place-market-path" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
              </g>;
            })}
            {hasGeometry && (data.entrances ?? []).map((entrance) => {
              const point = projection.project([entrance.lat, entrance.lng]);
              return <g key={entrance.id} className="place-market-entrance" transform={`translate(${point.x} ${point.y})`}>
                <path d="M 0 -7 L 7 0 L 0 7 L -7 0 Z" />
                {entrance.label && <title>{entrance.label}</title>}
              </g>;
            })}
            <text x="28" y="30" className="place-market-direction">N ↑</text>
            {mapPoints.map((pin) => {
              const hit = pin.stores.some((store) => matchesMarketName(store, query));
              const reference = pin.stores.some((store) => store.pinKind === 'REFERENCE');
              const out = pin.stores.every((store) => store.membership === 'OUT');
              return <g key={pin.key} transform={`translate(${pin.x} ${pin.y})`}
                data-selected={parcel?.key === pin.key || undefined} className="place-market-pin" data-hit={hit || undefined} data-outside={out || undefined}
                style={{ '--market-zone-color': pathColor(pin.stores[0].pathId) ?? (out ? 'var(--ko-text-muted)' : color(pin.stores[0].zoneId)) } as CSSProperties}>
                {hit && <circle r="18" className="place-market-hit-ring" />}
                <circle r={hit || parcel?.key === pin.key ? 13 : 10} className="place-market-dot" strokeDasharray={reference ? '3 3' : undefined} />
                <text textAnchor="middle" dy="4">{pin.stores.length}</text>
                {hit && <text className="place-market-hit-label" textAnchor={pin.x < 150 ? 'start' : pin.x > 450 ? 'end' : 'middle'} y="-25">{pin.stores.filter((store) => matchesMarketName(store, query)).map((store) => store.name).join(', ')}</text>}
              </g>;
            })}
            {/* 골목 이름은 가게 점 위에 그려 가려지지 않게 하고, 같은 이름의 선이 여럿이면 가장 긴 선에 한 번만 단다 */}
            {[...paths.filter((path) => path.named && path.name).reduce((byName, path) => {
              const length = pathLength(path.geometry.map(projection.project));
              const kept = byName.get(path.name!);
              if (!kept || length > kept.length) byName.set(path.name!, { path, length });
              return byName;
            }, new Map<string, { path: (typeof paths)[number]; length: number }>()).values()].map(({ path }) => {
              const label = longestMarketSegmentMidpoint(path.geometry.map(projection.project));
              return label && <text key={path.id} className="place-market-path-label" x={label.x} y={label.y} textAnchor="middle">{path.name}</text>;
            })}
            <path d={`M 28 402 v 6 h ${projection.scaleBarLength} v -6`} className="place-market-scale" />
            <text x="28" y="430">{projection.scaleBarMetres} m</text>
          </svg>{mapPoints.map((pin) => <button key={pin.key} type="button" className="place-market-pin-button"
            style={{ left: `${pin.x / 6}%`, top: `${pin.y / 4.4}%` }}
            aria-label={`${C.parcel}: ${pin.stores.map((store) => store.name).join(', ')}`}
            aria-pressed={parcel?.key === pin.key} onClick={() => setParcelKey(pin.key)} />)}</div> : <p>{C.noCoordinates}</p>}
          {(data.attribution ?? []).map((credit, index) => <p key={index} className="place-market-source place-market-geometry-attribution">{credit}</p>)}
          <p className="place-market-note">{C.mapNote} {C.reference}</p>
        </div>
        <div className="place-market-panel">
          <h3>{parcel ? C.parcel : C.shops} ({listed.length})</h3>
          {parcel && <button type="button" onClick={() => setParcelKey(null)}>{C.reset}</button>}
          {searched && <p role="status">{found.length ? `${C.found}: ${found.length}` : `${C.none}: ${query.trim()}`}</p>}
          {ordered.length === 0 && <p>{C.empty}</p>}
          <ul className="place-market-shops">
            {ordered.map((store, index) => <li key={store.id ?? `${store.name}-${index}`} data-found={matchesMarketName(store, query) || undefined} data-outside={store.membership === 'OUT' || undefined}>
              <strong>{store.name}</strong>
              <div className="place-market-badges">
                {matchesMarketName(store, query) && <span>{C.found}</span>}
                {marketSourceBadges(store, lang).map((badge) => <span key={badge}>{badge}</span>)}
                {store.membership === 'OUT' && <span>{C.out}</span>}
                {store.membership === 'UNKNOWN' && <span>{C.unknown}</span>}
                {!hasMarketCoordinate(store) && <span>{C.noPin}</span>}
              </div>
              {store.items && <p>{store.items}</p>}
              <p>{[store.roadAddress || store.jibunAddress, store.buildingName, store.dong, formatMarketFloor(store.floor, lang), store.ho].filter(Boolean).join(' · ')}</p>
              {store.pinKind === 'REFERENCE' && <p>{[store.relativePosition, store.positionNote].filter(Boolean).join(' · ')}</p>}
            </li>)}
          </ul>
        </div>
      </div>
      {data.market.id != null && <MarketStewardApplication marketId={data.market.id} lang={lang} />}
    </section>
  );
}

function ZoneFilter({ zone, selected, onSelect, color, lang }: {
  zone: MarketZone; lang: PlaceLang; selected: number | null; onSelect: (id: number | null) => void; color: (id: number | null) => string;
}) {
  const label = [zone.name, zone.dong, formatMarketFloor(zone.floor, lang)].filter((value, index, values) => value && values.indexOf(value) === index).join(' · ');
  return <div className="place-market-zone" data-kind={zone.kind}>
    <button type="button" disabled={zone.id == null} aria-pressed={zone.id != null && selected === zone.id} onClick={() => onSelect(zone.id)}>
      <span className="place-market-zone-swatch" style={{ background: color(zone.id) }} />{label}
    </button>
    {zone.children.length > 0 && <div className="place-market-zone-children">{zone.children.map((child, index) => <ZoneFilter key={child.id ?? index} zone={child} selected={selected} onSelect={onSelect} color={color} lang={lang} />)}</div>}
  </div>;
}

function pathLength(points: { x: number; y: number }[]) {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}
