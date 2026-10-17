import type { MarketCoordinate, MarketResponse, MarketStore } from '../../api/marketApi';
import { clusterByScreenDistance, groupMarketPins, hasMarketCoordinate, marketDisplayName } from './marketView';

import { majorityMarketStoreType, marketStoreTypeColor } from './marketStoreType';

export type MarketBounds = { north: number; south: number; east: number; west: number };
export type OverlaySelection = { storeId?: number | null; searchStoreIds?: number[]; selectedKey?: string | null };
type Position = { latitude: number; longitude: number };
type Shape = { key: string; coordinates: MarketCoordinate[]; color: string; strokeWeight: number; strokeOpacity: number };
export type OverlayMarker = Position & { key: string; selectionKey?: string; storeIds: (number | null)[]; text: string; title: string; color: string; strokeColor: string; strokeWeight: number; size: number; fontSize: string; labelOffset: { x: number; y: number }; iconPath: string; textColor: string; highlighted: boolean; searchMatch: boolean; label: boolean };
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
/** 화면 안 가게가 이보다 많으면 줌 19 이상이어도 묶음을 유지한다 — 남대문은 줌 19 한 화면에 790곳이 들어온다. */
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
  const polygon = data.boundary?.polygon.length ? data.boundary.polygon : hull(all.filter((s) => s.membership === 'IN').map(coordinate));
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
  const marker = (key: string, latitude: number, longitude: number, members: MarketStore[], selectionKey: string, text: string, label: boolean): OverlayMarker => {
    const highlighted = members.some((s) => selection.searchStoreIds?.includes(s.id!) || selection.storeId != null && selection.storeId === s.id) || selection.selectedKey === selectionKey;
    const color = members.every((s) => s.membership === 'OUT') ? muted : marketStoreTypeColor(majorityMarketStoreType(members));
    const size = label ? 12 : members.length < 10 ? 20 : members.length < 100 ? 26 : 32;
    const fontSize = `var(--ko-text-${label || size === 32 ? 'base' : size === 20 ? 'xs' : 'sm'})`;
    return { key, latitude, longitude, selectionKey, storeIds: members.map((s) => s.id), text, title: members.map((s) => marketDisplayName(s, lang)).join(', '), color, strokeColor: highlighted ? 'var(--ko-accent-text)' : 'var(--ko-surface-0)', strokeWeight: highlighted ? 3 : 2, size, fontSize, iconPath: circlePath(size), labelOffset: { x: 0, y: 0 }, highlighted, searchMatch: members.some((s) => selection.searchStoreIds?.includes(s.id!)), textColor: label ? highlighted ? 'var(--ko-accent-text)' : color : 'var(--ko-surface-0)', label };
  };
  const visibleStores = stores.filter((s) => inside(s, bounds));
  if (zoom <= 16 && centre) model.markers.push({ key: 'market-name', ...centre, storeIds: [], text: `${data.market.name} · ${data.stores.length}`, title: data.market.name, color: muted, strokeColor: 'var(--ko-surface-0)', strokeWeight: 2, size: 32, fontSize: 'var(--ko-text-base)', iconPath: circlePath(32), labelOffset: { x: 0, y: 20 }, textColor: muted, highlighted: false, searchMatch: false, label: true });
  else if (zoom >= 19 && visibleStores.length <= INDIVIDUAL_LIMIT) model.markers = visibleStores.map((s, index) => marker(`store:${s.id ?? index}`, s.latitude, s.longitude, [s], parcelFor(s).key, marketDisplayName(s, lang), true));
  else {
    const visible = groupMarketPins(visibleStores).map((p) => ({ ...p, ...screen([p.latitude, p.longitude], zoom) }));
    model.markers = clusterByScreenDistance(visible, 1, 24).map((p) => marker(`pin:${p.key}`, p.latitude, p.longitude, p.stores, p.key, String(p.stores.length), false));
  }
  const focused = stores.find((s) => selection.storeId != null && s.id === selection.storeId);
  if (focused) model.focus = { latitude: focused.latitude, longitude: focused.longitude, selectionKey: parcelFor(focused).key, zoom: 19 };
  if (userPosition) model.userPosition = { ...userPosition, text: lang === 'en' ? 'Your location' : '내 위치', color: 'var(--ko-accent-primary)', fillOpacity: .15, strokeWeight: 1, size: 12, iconPath: circlePath(12), strokeColor: 'var(--ko-surface-0)' };
  // Deterministic screen-space label boxes keep coincident individual pins' names readable.
  // The adapters consume pixel offsets; they never decide which names to show or group.
  const boxes: { x: number; y: number; width: number }[] = [];
  for (const marker of model.markers.filter((m) => m.label)) {
    const point = screen([marker.latitude, marker.longitude], zoom);
    const width = Math.max(32, [...marker.text].length * 14 + 16);
    let y = 20;
    while (boxes.some((b) => Math.abs(point.x - b.x) < (width + b.width) / 2 && Math.abs(point.y + y - b.y) < 24)) y += 24;
    marker.labelOffset = { x: 0, y };
    boxes.push({ x: point.x, y: point.y + y, width });
  }
  return model;
}
