import type { MatchedBy, MarketDish, MarketEnglishFields, MarketMatchedBy, GoodPriceMenu, GoodPriceSummary, MarketCoordinate, MarketResponse, MarketStore, MarketZone } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';

export const normalizeMarketName = (value: string) => value.normalize('NFKC').replace(/[\s\p{Z}]+/gu, '').toLowerCase();
export type MarketStoreMatch = { matchedBy: 'name' | 'items' | 'menus' | 'categories' | 'related'; rank: number; relatedCategory?: string };
export function matchesMarketStore(store: MarketStore, query: string, dishes: MarketDish[] = []): MarketStoreMatch | null {
  const needle = normalizeMarketName(query);
  if (!needle) return null;
  const fields: Array<[MarketStoreMatch['matchedBy'], Array<string | null>]> = [
    ['name', [store.name, store.nameEn ?? null]], ['items', [store.items, store.itemsEn ?? null]],
    ['menus', [...(store.goodPrice?.menus.flatMap((menu) => [menu.name, menu.nameEn ?? null]) ?? []), store.tourMenu?.firstMenu ?? null, store.tourMenu?.treatMenu ?? null, store.tourMenu?.firstMenuEn ?? null, store.tourMenu?.treatMenuEn ?? null]],
    ['categories', [store.categoryMajor, store.categoryMid, store.categorySub, store.categoryEn ?? null]],
  ];
  for (const [rank, [matchedBy, values]] of fields.entries()) {
    if (values.some((value) => value != null && normalizeMarketName(value).includes(needle))) return { matchedBy, rank };
  }
  if (store.categorySub && dishes.some((dish) => dish.categorySub === store.categorySub
    && [dish.dish, dish.dishEn].some((value) => normalizeMarketName(value) === needle))) {
    return { matchedBy: 'related', rank: 4, relatedCategory: store.categorySub };
  }
  return null;
}
// Keep map highlighting and the result list on the same search contract.
export const matchesMarketName = (store: MarketStore, query: string, dishes: MarketDish[] = []) => matchesMarketStore(store, query, dishes) != null;

export function zoneIds(zone: MarketZone): number[] {
  return [...(zone.id == null ? [] : [zone.id]), ...zone.children.flatMap(zoneIds)];
}

export function visibleMarketStores(stores: MarketStore[], includeOutside: boolean, ids?: number[]) {
  return stores.filter((store) => (includeOutside || store.membership !== 'OUT' || store.nearby === true)
    && (ids == null || (store.zoneId != null && ids.includes(store.zoneId))));
}

export function marketSourceBadges(store: MarketStore, lang: PlaceLang): string[] {
  const en = lang === 'en';
  const badges = store.manual || store.sources.includes('MANUAL')
    ? [store.actorKind === 'STEWARD' ? (en ? 'Merchant association' : '상인회 제공') : (en ? 'Operator entry' : '운영자 입력')]
    : store.sources.includes('ONNURI')
      ? [en ? 'Onnuri merchant' : '가맹점', ...(store.sources.includes('SANGGA') ? [en ? 'Store data' : '상가정보'] : [])]
      : store.sources.includes('SANGGA') ? [en ? 'Not an Onnuri merchant · Store data' : '가맹점 아님 · 상가정보'] : [];
  const stewardBadge = en ? 'Merchant association' : '상인회 제공';
  if (store.actorKind === 'STEWARD' && !badges.includes(stewardBadge)) badges.push(stewardBadge);
  return [...badges, ...(store.pinKind === 'REFERENCE' ? [en ? 'Reference location' : '참고 위치'] : [])];
}

export function hasMarketCoordinate(store: MarketStore): store is MarketStore & { latitude: number; longitude: number } {
  return store.membership !== 'UNKNOWN' && store.latitude != null && store.longitude != null
    && Number.isFinite(store.latitude) && Number.isFinite(store.longitude)
    && Math.abs(store.latitude) <= 90 && Math.abs(store.longitude) <= 180;
}

/** A parcel OR an identical coordinate shares one pin. Missing coordinates stay in the list. */
export function groupMarketPins(stores: MarketStore[]) {
  type Pin = { key: string; latitude: number; longitude: number; stores: MarketStore[] };
  const groups = new Set<Pin>();
  const parcels = new Map<string, Pin>();
  const coordinates = new Map<string, Pin>();
  for (const store of stores.filter(hasMarketCoordinate)) {
    const coordinate = `${store.latitude},${store.longitude}`;
    const parcel = store.jibunAddress?.trim();
    const byParcel = parcel ? parcels.get(parcel) : undefined;
    const byCoordinate = coordinates.get(coordinate);
    const group = byParcel ?? byCoordinate ?? { key: parcel || coordinate, latitude: store.latitude, longitude: store.longitude, stores: [] };
    // A bridging row may link two groups already seen. Preserve one physical pin.
    if (byParcel && byCoordinate && byParcel !== byCoordinate) {
      group.stores.push(...byCoordinate.stores);
      groups.delete(byCoordinate);
      for (const [key, value] of parcels) if (value === byCoordinate) parcels.set(key, group);
      for (const [key, value] of coordinates) if (value === byCoordinate) coordinates.set(key, group);
    }
    group.stores.push(store);
    groups.add(group);
    if (parcel) parcels.set(parcel, group);
    coordinates.set(coordinate, group);
  }
  return [...groups];
}

const centreOf = (points: MarketCoordinate[]): MarketCoordinate =>
  [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
const distanceMetres = (a: MarketCoordinate, b: MarketCoordinate) => {
  const metresPerDegree = Math.PI * 6_371_008.8 / 180;
  return Math.hypot((b[1] - a[1]) * metresPerDegree * Math.cos((a[0] + b[0]) / 2 * Math.PI / 180), (b[0] - a[0]) * metresPerDegree);
};

/** Local equirectangular projection in metres; isotropic fit keeps the scale bar honest. */
export function projectMarketPins(pins: ReturnType<typeof groupMarketPins>, geometry?: Pick<MarketResponse, 'boundary' | 'paths' | 'entrances'>) {
  const boundary = geometry?.boundary?.polygon ?? [];
  const paths = geometry?.paths ?? [];
  const hasGeometry = boundary.length > 0 || paths.some((path) => path.geometry.length > 0);
  // The boundary anchors the viewport, and pins within 300 m of its centre extend it: a narrow OSM
  // polygon (망원 is 402×129 m) would otherwise drop the shops the nearby rule adds around it, while
  // a far-off pin must not stretch the map.
  const coordinates: MarketCoordinate[] = boundary.length ? [...boundary, ...pins
    .filter((pin) => distanceMetres([pin.latitude, pin.longitude], centreOf(boundary)) <= 300)
    .map((pin): MarketCoordinate => [pin.latitude, pin.longitude])] : [
    ...pins.map((pin): MarketCoordinate => [pin.latitude, pin.longitude]),
    ...(hasGeometry ? paths.flatMap((path) => path.geometry) : []),
    ...(hasGeometry ? (geometry?.entrances ?? []).map((entry): MarketCoordinate => [entry.lat, entry.lng]) : []),
  ];
  if (coordinates.length === 0) return null;
  const latitude = coordinates.reduce((sum, point) => sum + point[0], 0) / coordinates.length;
  const longitude = coordinates[0][1];
  const metresPerDegree = Math.PI * 6_371_008.8 / 180;
  const local = ([lat, lng]: MarketCoordinate) => ({
    x: (lng - longitude) * metresPerDegree * Math.cos(latitude * Math.PI / 180),
    y: -(lat - latitude) * metresPerDegree,
  });
  const bounds = coordinates.map(local);
  const minX = Math.min(...bounds.map((p) => p.x));
  const maxX = Math.max(...bounds.map((p) => p.x));
  const minY = Math.min(...bounds.map((p) => p.y));
  const maxY = Math.max(...bounds.map((p) => p.y));
  const width = maxX - minX;
  const height = maxY - minY;
  // Reserve only the pin/label margin and the north arrow / scale bar strips.
  const scale = width === 0 && height === 0 ? 1
    : Math.min(width === 0 ? Infinity : 544 / width, height === 0 ? Infinity : 336 / height);
  // Use a smaller, truthfully labelled distance when 100 m exceeds the map.
  const scaleBarMetres = 100 / 10 ** Math.max(0, Math.ceil(Math.log10(scale * 100 / 544)));
  const project = (coordinate: MarketCoordinate) => {
    const p = local(coordinate);
    return { x: 300 + (p.x - (minX + maxX) / 2) * scale,
      y: 216 + (p.y - (minY + maxY) / 2) * scale };
  };
  return { scale100m: scale * 100, scaleBarMetres, scaleBarLength: scale * scaleBarMetres,
    project, points: pins.map((pin) => ({ ...pin, ...project([pin.latitude, pin.longitude]) })) };
}

/** Normalize known floor formats while retaining unfamiliar source values. */
export function formatMarketFloor(value: string | number | null, lang: PlaceLang): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const basement = /^(?:B\s*(\d+)|지하\s*(\d+)\s*층?|-\s*(\d+))$/iu.exec(raw);
  if (basement) {
    const floor = Number(basement[1] ?? basement[2] ?? basement[3]);
    return lang === 'en' ? `B${floor}` : `지하 ${floor}층`;
  }
  const above = /^(\d+)\s*(?:층|F)?$/iu.exec(raw);
  return above ? (lang === 'en' ? `${Number(above[1])}F` : `${Number(above[1])}층`) : raw;
}

/** One label per named path, centered on its longest projected segment. */
export function longestMarketSegmentMidpoint(points: { x: number; y: number }[]) {
  let longest = 0;
  let midpoint: { x: number; y: number } | null = null;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > longest) {
      longest = length;
      midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return midpoint;
}

export function formatMarketPrice(price: number, lang: PlaceLang): string {
  const amount = price.toLocaleString('ko-KR');
  return lang === 'en' ? `₩${amount}` : `${amount}원`;
}

export function formatGoodPriceMenu(menu: GoodPriceMenu, lang: PlaceLang): string {
  const name = lang === 'en' ? menu.nameEn || menu.name : menu.name;
  return menu.price == null ? name : `${name} ${formatMarketPrice(menu.price, lang)}`;
}

export function formatGoodPriceSummary(summary: Pick<GoodPriceSummary, 'storeCount' | 'minPrice' | 'maxPrice'>, lang: PlaceLang): string {
  const { storeCount, minPrice, maxPrice } = summary;
  const label = lang === 'en' ? `Good-price shops ${storeCount}` : `착한가격업소 ${storeCount}곳`;
  const min = minPrice ?? maxPrice;
  const max = maxPrice ?? minPrice;
  if (min == null || max == null) return label;
  const price = min === max ? formatMarketPrice(min, lang)
    : lang === 'en' ? `${formatMarketPrice(min, lang)}–${formatMarketPrice(max, lang).replace(/^₩/u, '')}`
      : `${formatMarketPrice(min, lang).replace(/원$/u, '')}~${formatMarketPrice(max, lang)}`;
  return `${label} · ${price}`;
}

/**
 * Screen-distance groups around leaders. The largest parcel in a crowd becomes a group and takes
 * every parcel within the radius of it; a parcel farther from every leader starts its own group.
 * Groups therefore stay about one radius wide. Chaining parcels transitively instead folded a
 * whole market of touching parcels (망원 at zoom 1: 152 shops) into a single bubble.
 * Inputs and store arrays are never mutated.
 */
export function clusterByScreenDistance<T extends { key: string; x: number; y: number; stores: MarketStore[] }>(
  points: T[], scale: number, radius = 24,
): (T & { parcelKeys: string[] })[] {
  const groups: (T & { parcelKeys: string[] })[] = [];
  const ordered = points.map((point, index) => ({ point, index }))
    .sort((a, b) => b.point.stores.length - a.point.stores.length || a.index - b.index);
  for (const { point } of ordered) {
    const leader = groups.find((group) => Math.hypot(group.x - point.x, group.y - point.y) * scale <= radius);
    if (leader) { leader.stores.push(...point.stores); leader.parcelKeys.push(point.key); }
    else groups.push({ ...point, stores: [...point.stores], parcelKeys: [point.key] });
  }
  return groups.map((group) => ({ ...group,
    key: group.parcelKeys.length === 1 ? group.key : `cluster:${JSON.stringify(group.parcelKeys)}`,
  }));
}

export type MarketUserPosition = { latitude: number; longitude: number; accuracy: number; timestamp: number };
/** Optional response fields: older public market responses do not expose a centre. */
type MarketCentre = { latitude?: number | null; longitude?: number | null };

/** Local equirectangular metres and eight-way bearing, from the visitor towards the market. */
export function marketLocationGuide(user: Pick<MarketUserPosition, 'latitude' | 'longitude'>, market: MarketCentre, polygon: MarketCoordinate[] = [], lang: PlaceLang = 'ko') {
  const vertices = polygon.length > 1 && polygon[0][0] === polygon.at(-1)![0] && polygon[0][1] === polygon.at(-1)![1]
    ? polygon.slice(0, -1) : polygon;
  const centre = vertices.length >= 3 ? {
    latitude: (Math.min(...vertices.map(([lat]) => lat)) + Math.max(...vertices.map(([lat]) => lat))) / 2,
    longitude: (Math.min(...vertices.map(([, lng]) => lng)) + Math.max(...vertices.map(([, lng]) => lng))) / 2,
  } : market;
  if (centre.latitude == null || centre.longitude == null || !Number.isFinite(centre.latitude) || !Number.isFinite(centre.longitude)) return null;
  const metresPerDegree = Math.PI * 6_371_008.8 / 180;
  const east = (centre.longitude - user.longitude) * metresPerDegree * Math.cos((centre.latitude + user.latitude) / 2 * Math.PI / 180);
  const north = (centre.latitude - user.latitude) * metresPerDegree;
  const distance = Math.hypot(east, north);
  let inPolygon = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [yi, xi] = vertices[i]; const [yj, xj] = vertices[j];
    const cross = (user.longitude - xi) * (yj - yi) - (user.latitude - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-12 && user.longitude >= Math.min(xi, xj) && user.longitude <= Math.max(xi, xj)
      && user.latitude >= Math.min(yi, yj) && user.latitude <= Math.max(yi, yj)) { inPolygon = true; break; }
    if ((yi > user.latitude) !== (yj > user.latitude) && user.longitude < (xj - xi) * (user.latitude - yi) / (yj - yi) + xi) inPolygon = !inPolygon;
  }
  const index = Math.round(((Math.atan2(east, north) * 180 / Math.PI + 360) % 360) / 45) % 8;
  const directions = lang === 'en' ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] : ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return { distance, direction: directions[index], inside: inPolygon || distance <= 100 };
}

/** Clip only the offscreen indicator; the real location and accuracy retain the map projection. */
export function marketPositionInView(point: { x: number; y: number }, view: { x: number; y: number; w: number; h: number }, inset = 16) {
  const visible = point.x >= view.x && point.x <= view.x + view.w && point.y >= view.y && point.y <= view.y + view.h;
  const dx = point.x - (view.x + view.w / 2); const dy = point.y - (view.y + view.h / 2);
  const ratio = Math.min((Math.max(0, view.w / 2 - inset)) / Math.abs(dx || Number.MIN_VALUE),
    (Math.max(0, view.h / 2 - inset)) / Math.abs(dy || Number.MIN_VALUE));
  return { visible, x: visible ? point.x : view.x + view.w / 2 + dx * ratio,
    y: visible ? point.y : view.y + view.h / 2 + dy * ratio, angle: Math.atan2(dx, -dy) * 180 / Math.PI };
}

export function marketDisplayName(store: MarketEnglishFields & { name: string }, lang: PlaceLang) {
  return lang === 'en' && store.nameEn ? `${store.nameEn} · ${store.name}` : store.name;
}

export function marketMatchLabel(field: MarketMatchedBy | undefined, category: string | null | undefined, lang: PlaceLang) {
  if (!field) return null;
  if (field === 'RELATED_CATEGORY') return `${lang === 'en' ? 'Related category' : '관련 업종'}${category ? ` · ${category}` : ''}`;
  return (lang === 'en' ? { NAME: 'Name match', ITEMS: 'Item match', MENU: 'Menu match', CATEGORY: 'Category match', DISH: 'Food match', ROMAN: 'Romanized match' }
    : { NAME: '이름에 맞음', ITEMS: '품목에 맞음', MENU: '메뉴에 맞음', CATEGORY: '업종에 맞음', DISH: '음식', ROMAN: '로마자' })[field];
}

export function sectionMatchLabel(match: MarketStoreMatch | MatchedBy | null, lang: PlaceLang) {
  if (!match) return null;
  if (typeof match === 'string') return marketMatchLabel(match, null, lang);
  const fields = { name: 'NAME', items: 'ITEMS', menus: 'MENU', categories: 'CATEGORY', related: 'RELATED_CATEGORY' } as const;
  return marketMatchLabel(fields[match.matchedBy], match.relatedCategory, lang);
}


/** Shared chip ordering for the detail section and the dedicated map. */
export function marketZones(data: MarketResponse, includeOutside: boolean, selectedId: number | null) {
  const flatten = (zones: MarketZone[]): MarketZone[] => zones.flatMap(zone => [zone, ...flatten(zone.children)]);
  const zones = flatten(data.zones);
  const stores = visibleMarketStores(data.stores, includeOutside);
  const countZone = (zone: MarketZone) => { const ids = zoneIds(zone); return stores.filter(store => store.zoneId != null && ids.includes(store.zoneId)).length; };
  const name = normalizeMarketName(data.market.name);
  const priority = (zone: MarketZone) => zone.kind === 'ROAD' && name.length > 0 && normalizeMarketName(zone.name).includes(name);
  const sortedZones = [...zones].sort((a,b) => Number(priority(b)) - Number(priority(a)) || countZone(b) - countZone(a) || a.name.localeCompare(b.name, 'ko', { numeric: true }));
  const defaultZones = sortedZones.filter(zone => zone.kind !== 'ROAD' || countZone(zone) > 0).slice(0, 8);
  const collapsedZones = sortedZones.filter(zone => defaultZones.includes(zone) || (zone.id != null && zone.id === selectedId));
  return { zones, sortedZones, collapsedZones, countZone, hiddenZoneCount: sortedZones.length - collapsedZones.length };
}
