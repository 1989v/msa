import type { MarketCoordinate, MarketResponse, MarketStore, MarketZone } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';

export const normalizeMarketName = (value: string) => value.replace(/\s+/gu, '').toLocaleLowerCase();
export const matchesMarketName = (store: MarketStore, query: string) => {
  const needle = normalizeMarketName(query);
  return needle.length > 0 && normalizeMarketName(store.name).includes(needle);
};

export function zoneIds(zone: MarketZone): number[] {
  return [...(zone.id == null ? [] : [zone.id]), ...zone.children.flatMap(zoneIds)];
}

export function visibleMarketStores(stores: MarketStore[], includeOutside: boolean, ids?: number[]) {
  return stores.filter((store) => (includeOutside || store.membership !== 'OUT')
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

/** Local equirectangular projection in metres; isotropic fit keeps the scale bar honest. */
export function projectMarketPins(pins: ReturnType<typeof groupMarketPins>, geometry?: Pick<MarketResponse, 'boundary' | 'paths' | 'entrances'>) {
  const boundary = geometry?.boundary?.polygon ?? [];
  const paths = geometry?.paths ?? [];
  const hasGeometry = boundary.length > 0 || paths.some((path) => path.geometry.length > 0);
  // A boundary fixes the viewport even when the shop/zone filters change.
  const coordinates: MarketCoordinate[] = boundary.length ? boundary : [
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
