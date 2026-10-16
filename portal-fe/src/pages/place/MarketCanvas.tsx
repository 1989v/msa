import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { MarketResponse, MarketStore } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { clusterByScreenDistance, formatGoodPriceMenu, formatMarketFloor, marketSourceBadges, matchesMarketName, longestMarketSegmentMidpoint, projectMarketPins } from './marketView';

import MarketLocate from './MarketLocate';
import { marketPositionInView, type MarketUserPosition } from './marketView';

type Projection = NonNullable<ReturnType<typeof projectMarketPins>>;
type ViewBox = { x: number; y: number; w: number; h: number };
const INITIAL: ViewBox = { x: 0, y: 0, w: 600, h: 440 };
const floorNumber = (value: MarketStore['floor']) => {
  const raw = String(value ?? '');
  const number = Number(raw.match(/\d+/u)?.[0] ?? 0);
  return /^(?:B|지하|-)/iu.test(raw) ? -number : number;
};
const natural = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '', 'ko', { numeric: true });
function orderStores(stores: MarketStore[]) {
  return [...stores].sort((a, b) => natural(a.buildingName, b.buildingName) || natural(a.dong, b.dong)
    || floorNumber(a.floor) - floorNumber(b.floor) || natural(a.ho, b.ho) || natural(a.name, b.name));
}

export default function MarketCanvas({ data, lang, projection, points, hasGeometry, query, selectedKey, onSelect, color, pathColor, userPosition, focusStoreId }: {
  data: MarketResponse; lang: PlaceLang; projection: Projection; points: Projection['points']; hasGeometry: boolean;
  query: string; selectedKey: string | null; onSelect: (key: string | null) => void;
  userPosition?: MarketUserPosition | null;
  focusStoreId?: number | null;
  color: (id: number | null) => string; pathColor: (id: number | null | undefined) => string | undefined;
}) {
  const en = lang === 'en';
  const marketKey = data.market.id ?? data.market.name;
  const [measurement, setMeasurement] = useState<{ marketKey: typeof marketKey; position: MarketUserPosition } | null>(null);
  const visitor = userPosition === undefined ? (measurement?.marketKey === marketKey ? measurement.position : null) : userPosition;
  const [view, setView] = useState(INITIAL);
  const [pixelsPerUnit, setPixelsPerUnit] = useState(1);
  const [page, setPage] = useState({ key: '', count: 50 });
  const [appliedFocus, setAppliedFocus] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const focusedRowRef = useRef<HTMLLIElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const lastTouch = useRef(0);
  const tap = useRef({ time: 0, x: 0, y: 0 });
  const zoom = 600 / view.w;
  const screenScale = pixelsPerUnit * zoom;
  const paths = data.paths ?? [];
  const visitorPoint = visitor ? projection.project([visitor.latitude, visitor.longitude]) : null;
  const visitorView = visitorPoint ? marketPositionInView(visitorPoint, view, 20 / screenScale) : null;
  const clusters = clusterByScreenDistance(points.map((point) => ({ ...point,
    pinColor: pathColor(point.stores[0].pathId) ?? (point.stores.every((store) => store.membership === 'OUT')
      ? 'var(--ko-text-muted)' : color(point.stores[0].zoneId)),
  })), screenScale, 24);
  // Keep selection stable when a zoom splits the selected screen group.
  const selected = clusters.find((cluster) => cluster.key === selectedKey || cluster.parcelKeys.includes(selectedKey ?? ''));
  const selectedKeys: string[] = selectedKey?.startsWith('cluster:') ? JSON.parse(selectedKey.slice(8)) : [];
  const selectedStores = selected?.stores ?? points.filter((point) => selectedKeys.includes(point.key)).flatMap((point) => point.stores);
  const ordered = orderStores(selectedStores);
  const focusedIndex = focusStoreId == null ? -1 : ordered.findIndex((store) => store.id === focusStoreId);
  const limit = ordered.length > 200 ? Math.max(page.key === selectedKey ? page.count : 50,
    focusedIndex < 0 ? 0 : Math.ceil((focusedIndex + 1) / 50) * 50) : ordered.length;
  const focusPoint = focusStoreId == null ? undefined : points.find((point) => point.stores.some((store) => store.id === focusStoreId));
  // Resolve the group at the requested zoom, rather than the pre-focus screen grouping.
  const focusKey = focusPoint && clusterByScreenDistance(points, pixelsPerUnit * 4, 24)
    .find((cluster) => cluster.parcelKeys.includes(focusPoint.key))?.key;
  const focusX = focusPoint?.x;
  const focusY = focusPoint?.y;
  const focusRequest = focusStoreId == null || focusKey == null ? null : JSON.stringify([focusStoreId, focusKey, focusX, focusY]);
  // Adjust local view state when a new request arrives; subsequent pans remain free.
  if (appliedFocus !== focusRequest) {
    setAppliedFocus(focusRequest);
    if (focusRequest != null && focusX != null && focusY != null) setView({ x: focusX - 75, y: focusY - 55, w: 150, h: 110 });
  }
  useEffect(() => {
    if (focusStoreId != null && focusKey != null) onSelect(focusKey);
  }, [focusStoreId, focusKey, onSelect]);
  useEffect(() => {
    if (focusStoreId != null) focusedRowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [focusStoreId, selectedKey, limit]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const resize = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width && rect.height) setPixelsPerUnit(Math.min(rect.width / 600, rect.height / 440));
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(svg);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, []);

  const location = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 440;
    const fit = Math.min(width / 600, height / 440);
    return { x: (clientX - rect.left - (width - 600 * fit) / 2) / fit,
      y: (clientY - rect.top - (height - 440 * fit) / 2) / fit };
  }, []);
  const zoomAt = useCallback((factor: number, anchor = { x: 300, y: 220 }) => setView((current) => {
    const nextZoom = Math.min(8, Math.max(1, 600 / current.w * factor));
    const w = 600 / nextZoom;
    const h = 440 / nextZoom;
    return { x: current.x + anchor.x / 600 * (current.w - w), y: current.y + anchor.y / 440 * (current.h - h), w, h };
  }), []);
  // The buttons have no cursor: zoom around the selected group, else the shop-weighted centre of the
  // pins. The view centre is often empty ground between clusters and would zoom into nothing.
  const buttonAnchor = () => {
    const target = selected ? { x: selected.x, y: selected.y, n: 1 } : points.reduce((sum, point) => ({
      x: sum.x + point.x * point.stores.length, y: sum.y + point.y * point.stores.length, n: sum.n + point.stores.length,
    }), { x: 0, y: 0, n: 0 });
    if (target.n === 0) return { x: 300, y: 220 };
    return { x: Math.min(600, Math.max(0, (target.x / target.n - view.x) * 600 / view.w)),
      y: Math.min(440, Math.max(0, (target.y / target.n - view.y) * 440 / view.h)) };
  };
  // Native non-passive wheel handling prevents the document scrolling during map zoom.
  useEffect(() => {
    const svg = svgRef.current!;
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoomAt(Math.exp(-event.deltaY * 0.002), location(event.clientX, event.clientY)); };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [location, zoomAt]);
  const select = (key: string) => { if (!dragged.current) onSelect(key); };
  const labels = [...paths.filter((path) => path.named && path.name).reduce((kept, path) => {
    const projected = path.geometry.map(projection.project);
    const length = projected.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - projected[index].x, point.y - projected[index].y), 0);
    if (!kept.has(path.name!) || length > kept.get(path.name!)!.length) kept.set(path.name!, { path, length });
    return kept;
  }, new Map<string, { path: (typeof paths)[number]; length: number }>()).values()];
  return <div className="place-market-canvas-layout">
    <div className="place-market-canvas" data-geometry={hasGeometry || undefined} role="group" aria-label={en ? 'Shop location map' : '가게 위치 지도'}>
      <div className="place-market-zoom" aria-label={en ? 'Map controls' : '지도 조작'}>
        <button type="button" aria-label={en ? 'Zoom in' : '확대'} disabled={zoom >= 8} onClick={() => zoomAt(2, buttonAnchor())}>+</button>
        <button type="button" aria-label={en ? 'Zoom out' : '축소'} disabled={zoom <= 1} onClick={() => zoomAt(0.5, buttonAnchor())}>−</button>
        <button type="button" onClick={() => setView(INITIAL)}>{en ? 'Show whole map' : '전체 보기'}</button>
      </div>
      <MarketLocate key={marketKey} data={data} lang={lang} onPosition={(position) => setMeasurement({ marketKey, position })} />
      <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        onDoubleClick={(event) => { if (event.detail !== 0 && Date.now() - lastTouch.current > 500) zoomAt(2, location(event.clientX, event.clientY)); }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (pointers.current.size === 0) dragged.current = false;
          pointers.current.set(event.pointerId, location(event.clientX, event.clientY));
          // Capture on the interactive group itself so native clicks still reach the pin.
          const captureTarget = (event.target as Element).closest('[role="button"]') ?? event.currentTarget;
          captureTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) return;
          const next = location(event.clientX, event.clientY);
          const before = [...pointers.current.values()];
          pointers.current.set(event.pointerId, next);
          const after = [...pointers.current.values()];
          if (Math.hypot(next.x - previous.x, next.y - previous.y) > 2) dragged.current = true;
          if (before.length === 2) {
            const distance = (pair: typeof before) => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
            const oldDistance = distance(before);
            if (oldDistance > 0) zoomAt(distance(after) / oldDistance, { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 });
            setView((current) => ({ ...current, x: current.x - ((after[0].x + after[1].x) - (before[0].x + before[1].x)) / 2 * current.w / 600,
              y: current.y - ((after[0].y + after[1].y) - (before[0].y + before[1].y)) / 2 * current.h / 440 }));
          } else if (before.length === 1) setView((current) => ({ ...current, x: current.x - (next.x - previous.x) * current.w / 600, y: current.y - (next.y - previous.y) * current.h / 440 }));
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          if (event.pointerType === 'touch') lastTouch.current = Date.now();
          if (event.pointerType === 'touch' && !dragged.current && pointers.current.size === 0) {
            const now = Date.now();
            if (now - tap.current.time < 300 && Math.hypot(event.clientX - tap.current.x, event.clientY - tap.current.y) < 24) {
              zoomAt(2, location(event.clientX, event.clientY)); tap.current.time = 0;
            } else tap.current = { time: now, x: event.clientX, y: event.clientY };
          }
        }}
        onPointerCancel={(event) => { pointers.current.delete(event.pointerId); dragged.current = true; }}>
        {data.boundary && <polygon className="place-market-boundary" vectorEffect="non-scaling-stroke" points={data.boundary.polygon.map(projection.project).map((point) => `${point.x},${point.y}`).join(' ')} />}
        {paths.map((path) => <g key={path.id} style={{ '--market-path-color': pathColor(path.id) } as CSSProperties}>
          <polyline className="place-market-path" vectorEffect="non-scaling-stroke" points={path.geometry.map(projection.project).map((point) => `${point.x},${point.y}`).join(' ')} />
        </g>)}
        {hasGeometry && (data.entrances ?? []).map((entrance) => {
          const point = projection.project([entrance.lat, entrance.lng]);
          return <g key={entrance.id} className="place-market-entrance" transform={`translate(${point.x} ${point.y}) scale(${1 / screenScale})`}>
            <path d="M 0 -7 L 7 0 L 0 7 L -7 0 Z" />{entrance.label && <title>{entrance.label}</title>}
          </g>;
        })}
        {clusters.map((pin) => {
          const hit = pin.stores.some((store) => matchesMarketName(store, query));
          const active = selectedKey === pin.key || pin.parcelKeys.some((key) => selectedKeys.includes(key))
            || pin.parcelKeys.includes(selectedKey ?? '');
          return <g key={pin.key} role="button" tabIndex={0} className="place-market-pin" data-selected={active || undefined}
            data-hit={hit || undefined} data-outside={pin.stores.every((store) => store.membership === 'OUT') || undefined}
            transform={`translate(${pin.x} ${pin.y}) scale(${1 / screenScale})`}
            style={{ '--market-zone-color': pin.pinColor } as CSSProperties}
            aria-label={`${en ? 'Shops on this parcel' : '같은 필지 가게'}: ${pin.stores.map((store) => store.name).join(', ')}`}
            aria-pressed={active} onClick={() => select(pin.key)} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(pin.key); }
            }}>
            <circle r="22" className="place-market-pin-hit-area" />
            {hit && <circle r="18" className="place-market-hit-ring" />}
            <circle r={hit || active ? 13 : 10} className="place-market-dot" strokeDasharray={pin.stores.some((store) => store.pinKind === 'REFERENCE') ? '3 3' : undefined} />
            <text textAnchor="middle" dy="4">{pin.stores.length}</text>
            {hit && <text className="place-market-hit-label" textAnchor={pin.x < 150 ? 'start' : pin.x > 450 ? 'end' : 'middle'} y="-25">{pin.stores.filter((store) => matchesMarketName(store, query)).map((store) => store.name).join(', ')}</text>}
          </g>;
        })}
        {labels.map(({ path }) => {
          const label = longestMarketSegmentMidpoint(path.geometry.map(projection.project));
          return label && <text key={path.id} className="place-market-path-label" transform={`translate(${label.x} ${label.y}) scale(${1 / screenScale})`} textAnchor="middle">{path.name}</text>;
        })}
        {visitor && visitorPoint && visitorView && <g className="place-market-user" role="img" aria-label={en ? 'Your location' : '내 위치'}>
          {visitorView.visible ? <>
            <circle className="place-market-user-accuracy" cx={visitorPoint.x} cy={visitorPoint.y} r={visitor.accuracy * projection.scale100m / 100} vectorEffect="non-scaling-stroke" />
            <circle className="place-market-user-dot" cx={visitorPoint.x} cy={visitorPoint.y} r={7 / screenScale} vectorEffect="non-scaling-stroke" />
          </> : <g className="place-market-user-edge" transform={`translate(${visitorView.x} ${visitorView.y}) scale(${1 / screenScale}) rotate(${visitorView.angle})`}>
            <path d="M 0 -12 L 9 9 L 0 5 L -9 9 Z" />
            <title>{en ? 'Your location is outside the map view' : '내 위치가 지도 화면 밖에 있습니다'}</title>
          </g>}
        </g>}
        <g transform={`translate(${view.x} ${view.y}) scale(${1 / screenScale})`} className="place-market-map-decoration">
          <text x="28" y="30" className="place-market-direction">N ↑</text>
        </g>
        <g transform={`translate(${view.x} ${view.y + view.h}) scale(${1 / screenScale})`} className="place-market-map-decoration">
          <path d={`M 28 -38 v 6 h ${projection.scaleBarLength * pixelsPerUnit} v -6`} className="place-market-scale" />
          <text x="28" y="-10">{Number((projection.scaleBarMetres / zoom).toPrecision(3))} m</text>
        </g>
      </svg>
    </div>
    {selectedKey != null && <section className="place-market-cluster-sheet" aria-label={en ? 'Selected shops' : '선택한 가게'}>
      <h3>{en ? 'Shops on this parcel' : '같은 필지 가게'} ({ordered.length})</h3>
      <button type="button" onClick={() => onSelect(null)}>{en ? 'Show all shops' : '전체 가게 보기'}</button>
      <ul className="place-market-shops">{ordered.slice(0, limit).map((store, index) => <li key={store.id ?? index} ref={focusStoreId != null && store.id === focusStoreId ? focusedRowRef : undefined}
        data-selected={focusStoreId != null && store.id === focusStoreId || undefined}
        style={focusStoreId != null && store.id === focusStoreId ? { outline: '2px solid var(--ko-accent-text)', outlineOffset: '-2px' } : undefined}
        data-found={matchesMarketName(store, query) || undefined}>
        <strong>{store.name}</strong>
        <div className="place-market-badges">
          {store.goodPrice && <span>{en ? 'Good price' : '착한가격'}</span>}
          {matchesMarketName(store, query) && <span>{en ? 'Found shop' : '찾은 가게'}</span>}
          {marketSourceBadges(store, lang).map((badge) => <span key={badge}>{badge}</span>)}
          {store.membership === 'OUT' && <span>{en ? 'Outside market' : '시장 밖'}</span>}
        </div>
        {store.goodPrice && store.goodPrice.menus.length > 0 && <p>{store.goodPrice.menus.map((menu) => formatGoodPriceMenu(menu, lang)).join(' · ')}</p>}
        {store.items && <p>{store.items}</p>}
        <p>{[store.roadAddress || store.jibunAddress, store.buildingName, store.dong, formatMarketFloor(store.floor, lang), store.ho].filter(Boolean).join(' · ')}</p>
        {store.pinKind === 'REFERENCE' && <p>{[store.relativePosition, store.positionNote].filter(Boolean).join(' · ')}</p>}
      </li>)}</ul>
      {limit < ordered.length && <button type="button" onClick={() => setPage({ key: selectedKey, count: limit + 50 })}>{en ? 'Show more' : '더 보기'}</button>}
    </section>}
  </div>;
}
