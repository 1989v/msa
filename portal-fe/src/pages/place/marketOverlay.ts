import type { MarketCoordinate, MarketResponse, MarketStore } from '../../api/marketApi';
import { clusterByScreenDistance, groupMarketPins, hasMarketCoordinate, marketDisplayName } from './marketView';

import { majorityMarketStoreType, marketStoreTypeColor } from './marketStoreType';

export type MarketBounds = { north: number; south: number; east: number; west: number };
/** `numbers` are the list ordinals (store id → 1-based) the page assigns to search results or the selected parcel. */
export type OverlaySelection = { storeId?: number | null; searchStoreIds?: number[]; selectedKey?: string | null; numbers?: ReadonlyMap<number, number> };
type Position = { latitude: number; longitude: number };
type Shape = { key: string; coordinates: MarketCoordinate[]; color: string; strokeWeight: number; strokeOpacity: number };
/** `text` 는 원 안 글자(가게 수·목록 순번), `labelText` 는 원 옆 이름표(이름과 시장이 붙인 번호) — 둘을 한 칸에 섞지 않는다. */
export type OverlayMarker = Position & { key: string; selectionKey?: string; storeIds: (number | null)[]; text: string; labelText?: string; labelColor?: string; title: string; color: string; strokeColor: string; strokeWeight: number; size: number; fontSize: string; labelOffset: { x: number; y: number }; iconPath: string; textColor: string; highlighted: boolean; searchMatch: boolean; label: boolean };
export type MarketOverlay = {
  centre: Position | null;
  marketPolygon: (Shape & { fillOpacity: number }) | null;
  alleys: Shape[];
  markers: OverlayMarker[];
  labels: (Position & { key: string; text: string; color: string })[];
  userPosition: (Position & { accuracy: number; text: string; color: string; fillOpacity: number; strokeWeight: number; size: number; iconPath: string; strokeColor: string }) | null;
  focus: (Position & { selectionKey: string; zoom: number }) | null;
};
const circlePath = (size: number) => { const r = size / 2; return `M ${-r},0 a ${r},${r} 0 1,0 ${size},0 a ${r},${r} 0 1,0 ${-size},0`; };
const muted = 'var(--ko-text-muted)';
const position = ([latitude, longitude]: MarketCoordinate): Position => ({ latitude, longitude });
const coordinate = (store: MarketStore & Position): MarketCoordinate => [store.latitude, store.longitude];
const centreOf = (points: MarketCoordinate[]): Position | null => points.length ? position([
  (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2,
  (Math.min(...points.map((p) => p[1])) + Math.max(...points.map((p) => p[1]))) / 2,
]) : null;
/** Monotone chain; duplicates and collinear input cannot produce a polygon. */
function hull(points: MarketCoordinate[]): MarketCoordinate[] {
  const sorted = [...new Map(points.map((p) => [p.join(','), p])).values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (sorted.length < 3) return [];
  const cross = (a: MarketCoordinate, b: MarketCoordinate, c: MarketCoordinate) => (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
  const half = (list: MarketCoordinate[]) => { const result: MarketCoordinate[] = []; for (const point of list) { while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop(); result.push(point); } return result.slice(0, -1); };
  const result = [...half(sorted), ...half([...sorted].reverse())];
  return result.length >= 3 ? result : [];
}
function screen([lat, lng]: MarketCoordinate, zoom: number) {
  const sin = Math.sin(Math.min(85.05112878, Math.max(-85.05112878, lat)) * Math.PI / 180);
  const scale = 256 * 2 ** zoom;
  return { x: (lng + 180) / 360 * scale, y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}
/** 이 줌부터 골목·가게를 그린다 — 아래에서는 시장 이름 핀 하나만 둔다. */
export const MARKET_DETAIL_ZOOM = 17;
/** Drawn outline: the boundary, else the hull of IN stores. */
const outlineOf = (data: MarketResponse, all: (MarketStore & Position)[]) => data.boundary?.polygon.length ? data.boundary.polygon : hull(all.filter((s) => s.membership === 'IN').map(coordinate));
/** 시장 윤곽이 상자에 들어오는 줌 — 들어가서 바로 시장이 크게 보이게. 골목·가게가 보이는 줌 아래로는 내리지 않는다. */
export function marketFitZoom(data: MarketResponse, width: number, height: number): number {
  const all = data.stores.filter(hasMarketCoordinate);
  const outline = outlineOf(data, all);
  const points = outline.length ? outline : all.filter((s) => s.membership === 'IN').map(coordinate);
  if (points.length < 2 || width < 1 || height < 1) return MARKET_DETAIL_ZOOM;
  const world = points.map((p) => screen(p, 0));
  const span = (axis: 'x' | 'y') => Math.max(...world.map((p) => p[axis])) - Math.min(...world.map((p) => p[axis]));
  // 가장자리에 여백 20% — 윤곽이 화면 끝에 붙지 않게
  const fit = Math.floor(Math.log2(Math.min(width * .8 / span('x'), height * .8 / span('y'))));
  return Math.max(MARKET_DETAIL_ZOOM, Math.min(19, fit));
}
/** 화면 안 가게가 이보다 많으면 줌 19 이상이어도 이름표를 달지 않는다 — 남대문은 줌 19 한 화면에 790곳이 들어온다. */
const INDIVIDUAL_LIMIT = 150;
const inside = (store: Position, bounds?: MarketBounds) => !bounds || (store.latitude >= bounds.south && store.latitude <= bounds.north && (bounds.west <= bounds.east ? store.longitude >= bounds.west && store.longitude <= bounds.east : store.longitude >= bounds.west || store.longitude <= bounds.east));

/** SDK/DOM-free drawing policy. Membership comes from the response only: the derived hull
 * is a drawing artifact and must NEVER feed back into IN classification or store filtering. */
export function buildMarketOverlay({ data, zoom, bounds, selection = {}, lang = 'ko', userPosition, storeIds }: {
  data: MarketResponse; zoom: number; bounds?: MarketBounds; selection?: OverlaySelection; lang?: 'ko' | 'en';
  userPosition?: (Position & { accuracy: number }) | null; storeIds?: (number | null)[];
}): MarketOverlay {
  const paths = data.paths ?? [];
  const all = data.stores.filter(hasMarketCoordinate);
  const polygon = outlineOf(data, all);
  const centre = centreOf(polygon.length ? polygon : all.length ? all.map(coordinate) : paths.flatMap((p) => p.geometry).concat((data.entrances ?? []).map((e) => [e.lat, e.lng])));
  const model: MarketOverlay = { centre, marketPolygon: null, alleys: [], markers: [], labels: [], userPosition: null, focus: null };
  if (polygon.length >= 3) model.marketPolygon = { key: 'market', coordinates: polygon, color: muted, fillOpacity: .12, strokeWeight: 1.5, strokeOpacity: 1 };
  const names = new Map<string, { length: number; midpoint: Position }>();
  for (const path of paths) {
    if (path.geometry.length < 2) continue;
    model.alleys.push({ key: `path:${path.id}`, coordinates: path.geometry, color: muted, strokeWeight: 1.5, strokeOpacity: .65 });
    if (zoom < 18 || !path.named || !path.name) continue;
    const pixels = path.geometry.map((p) => screen(p, 18));
    const lengths = pixels.slice(1).map((p, i) => Math.hypot(p.x - pixels[i].x, p.y - pixels[i].y));
    const length = lengths.reduce((sum, n) => sum + n, 0); let remaining = length / 2; let midpoint = position(path.geometry[0]);
    for (let i = 0; i < lengths.length; i++) { if (remaining <= lengths[i]) { const t = lengths[i] ? remaining / lengths[i] : 0; midpoint = position([path.geometry[i][0] + (path.geometry[i + 1][0] - path.geometry[i][0]) * t, path.geometry[i][1] + (path.geometry[i + 1][1] - path.geometry[i][1]) * t]); break; } remaining -= lengths[i]; }
    if (length > (names.get(path.name)?.length ?? -1)) names.set(path.name, { length, midpoint });
  }
  model.labels = [...names].map(([text, { midpoint }]) => ({ key: `label:${text}`, text, ...midpoint, color: muted }));
  const stores = all.filter((s) => storeIds == null || storeIds.includes(s.id));
  const parcels = groupMarketPins(stores); const parcelFor = (store: MarketStore) => parcels.find((p) => p.stores.includes(store))!;
  // 원 안 숫자는 두 가지뿐이다 — 2곳 이상 묶음이면 가게 수, 1곳이면 목록 순번(검색·선택 중일 때). 시장이 붙인 가게 번호는 이름표에만 쓴다.
  const numberOf = (store: MarketStore) => store.id == null ? undefined : selection.numbers?.get(store.id);
  const marker = (key: string, latitude: number, longitude: number, members: MarketStore[], selectionKey: string, label: boolean): OverlayMarker => {
    const highlighted = members.some((s) => selection.searchStoreIds?.includes(s.id!) || selection.storeId != null && selection.storeId === s.id) || selection.selectedKey === selectionKey;
    const color = members.every((s) => s.membership === 'OUT') ? muted : marketStoreTypeColor(majorityMarketStoreType(members));
    const number = members.length === 1 ? numberOf(members[0]) : undefined;
    const size = label && number == null ? 12 : members.length < 10 ? 20 : members.length < 100 ? 26 : 32;
    const fontSize = `var(--ko-text-${size === 32 ? 'base' : size <= 20 ? 'xs' : 'sm'})`;
    const text = members.length >= 2 ? String(members.length) : number != null ? String(number) : '';
    const labelText = label ? [marketDisplayName(members[0], lang), members[0].storeNo].filter(Boolean).join(' ') : undefined;
    return { key, latitude, longitude, selectionKey, storeIds: members.map((s) => s.id), text, labelText, title: members.map((s) => marketDisplayName(s, lang)).join(', '), color, strokeColor: highlighted ? 'var(--ko-accent-primary)' : 'var(--ko-surface-0)', strokeWeight: highlighted ? 4 : 2, size, fontSize, iconPath: circlePath(size), labelOffset: { x: 0, y: label ? size / 2 + 14 : 0 }, highlighted, searchMatch: members.some((s) => selection.searchStoreIds?.includes(s.id!)), textColor: 'var(--ko-surface-0)', labelColor: label ? highlighted ? 'var(--ko-accent-text)' : color : undefined, label };
  };
  const visibleStores = stores.filter((s) => inside(s, bounds));
  if (zoom < MARKET_DETAIL_ZOOM && centre) model.markers.push({ key: 'market-name', ...centre, storeIds: [], text: '', labelText: `${data.market.name} · ${data.stores.length}`, title: data.market.name, color: muted, strokeColor: 'var(--ko-surface-0)', strokeWeight: 2, size: 32, fontSize: 'var(--ko-text-base)', iconPath: circlePath(32), labelOffset: { x: 0, y: 20 }, textColor: 'var(--ko-surface-0)', labelColor: muted, highlighted: false, searchMatch: false, label: true });
  else {
    // 같은 건물(필지)·화면에서 겹치는 가게는 줌과 관계없이 한 핀으로 묶는다. 이름표는 줌 19 이상에서 1곳짜리 핀에만,
    // 다른 이름표와 겹치지 않을 때만 단다 — 겹친 이름을 아래로 쌓으면 이름이 지도를 덮어 지도를 끌 수 없게 된다.
    const named = zoom >= 19 && visibleStores.length <= INDIVIDUAL_LIMIT;
    const visible = groupMarketPins(visibleStores).map((p) => ({ ...p, ...screen([p.latitude, p.longitude], zoom) }));
    const boxes: { x: number; y: number; width: number }[] = [];
    model.markers = clusterByScreenDistance(visible, 1, 24).map((p) => {
      let pin = marker(`pin:${p.key}`, p.latitude, p.longitude, p.stores, p.key, named && p.stores.length === 1);
      if (pin.label) {
        const box = { x: p.x, y: p.y + pin.labelOffset.y, width: Math.max(32, [...pin.labelText!].length * 14 + 16) };
        if (boxes.some((b) => Math.abs(box.x - b.x) < (box.width + b.width) / 2 && Math.abs(box.y - b.y) < 24)) pin = marker(`pin:${p.key}`, p.latitude, p.longitude, p.stores, p.key, false);
        else boxes.push(box);
      }
      return pin;
    });
  }
  const focused = stores.find((s) => selection.storeId != null && s.id === selection.storeId);
  if (focused) model.focus = { latitude: focused.latitude, longitude: focused.longitude, selectionKey: parcelFor(focused).key, zoom: 19 };
  if (userPosition) model.userPosition = { ...userPosition, text: lang === 'en' ? 'Your location' : '내 위치', color: 'var(--ko-accent-primary)', fillOpacity: .15, strokeWeight: 1, size: 12, iconPath: circlePath(12), strokeColor: 'var(--ko-surface-0)' };
  return model;
}
