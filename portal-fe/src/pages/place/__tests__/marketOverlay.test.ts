import { describe, expect, it } from 'vitest';
import type { MarketResponse, MarketStore } from '../../../api/marketApi';
import { buildMarketOverlay, marketFitZoom } from '../marketOverlay';
const shop = (id: number, lat: number | null, lng: number | null, extra: Partial<MarketStore> = {}): MarketStore => ({ id, name: `Shop ${id}`, latitude: lat, longitude: lng, zoneId: 1, membership: 'IN', items: null, roadAddress: null, jibunAddress: null, buildingName: null, dong: null, floor: null, ho: null, categoryMajor: '음식', categoryMid: '한식', categorySub: null, sources: [], pinKind: 'EXACT', manual: false, actorKind: null, relativePosition: null, positionNote: null, ...extra });
export const overlayData: MarketResponse = { market: { name: 'Market', marketType: 'STREET', sourceMarketType: null, storeCountRaw: null, openingCycle: null, facilities: null, attribution: null }, zones: [{ id: 1, parentId: null, kind: 'ROAD', name: 'Alley', dong: null, floor: null, children: [] }], stores: [shop(1, 37.5, 127), shop(2, 37.50001, 127.00001), shop(3, 37.5001, 127), shop(4, null, null), shop(5, 37.52, 127.02, { membership: 'OUT', nearby: true })], paths: [{ id: 1, name: 'Alley', named: true, source: 'OSM', geometry: [[37.5, 127], [37.501, 127]] }, { id: 2, name: 'Alley', named: true, source: 'OSM', geometry: [[37.5, 127], [37.502, 127]] }] };
const bounds = { north: 37.501, south: 37.499, west: 126.999, east: 127.001 };
describe('market overlay model', () => {
  it('opens at the zoom where the market outline fits the box, never below the zoom that draws alleys and shops', () => {
    const spread = (dLat: number, dLng: number) => ({ ...overlayData, stores: [shop(1, 37.5, 127), shop(2, 37.5 + dLat, 127), shop(3, 37.5, 127 + dLng), shop(4, 37.5 + dLat, 127 + dLng)] });
    expect(marketFitZoom(spread(.001, .002), 640, 360)).toBe(18);
    expect(marketFitZoom(spread(.00005, .00005), 640, 360)).toBe(19);
    expect(marketFitZoom(spread(.01, .01), 640, 360)).toBe(17);
    // OUT 가게는 윤곽에 넣지 않는다 — 시장 밖 한 곳 때문에 시장이 작아지지 않게
    expect(marketFitZoom({ ...spread(.001, .002), stores: [...spread(.001, .002).stores, shop(9, 37.6, 127.1, { membership: 'OUT' })] }, 640, 360)).toBe(18);
  });
  it('uses one market marker at 16, parcel clusters at 17 and named one-shop pins at 19', () => {
    const low = buildMarketOverlay({ data: overlayData, zoom: 16, bounds });
    expect(low.markers).toHaveLength(1); expect(low.markers[0].labelText).toBe('Market · 5');
    expect(buildMarketOverlay({ data: overlayData, zoom: 17, bounds }).markers).toHaveLength(1);
    // 1·2번은 화면에서 1m 남짓 떨어져 한 핀(2곳)으로, 3번은 이름표를 단 혼자 핀으로
    const high = buildMarketOverlay({ data: overlayData, zoom: 19, bounds, selection: { searchStoreIds: [2] } });
    expect(high.markers.map(m => [m.storeIds, m.text, m.labelText])).toEqual([[[1, 2], '2', undefined], [[3], '', 'Shop 3']]);
    expect(high.markers[0]).toMatchObject({ strokeColor: 'var(--ko-accent-primary)', strokeWeight: 4, highlighted: true, searchMatch: true });
  });
  it('counts only groups of two or more, numbers lone pins and name labels from the list ordinals, and leaves other pins blank', () => {
    const stores = [shop(1, 37.5, 127), shop(2, 37.5, 127), shop(3, 37.51, 127.01), shop(4, 37.49, 126.99)];
    const grouped = buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 17 });
    expect(grouped.markers.map(marker => marker.text).sort()).toEqual(['', '', '2']);
    const numbered = buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 17, selection: { numbers: new Map([[3, 1], [1, 2]]) } });
    expect(numbered.markers.find(marker => marker.storeIds.includes(3))!.text).toBe('1');
    expect(numbered.markers.find(marker => marker.storeIds.includes(1))!.text).toBe('2');
    expect(numbered.markers.find(marker => marker.storeIds.includes(4))!.text).toBe('');
    const named = buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 19, selection: { numbers: new Map([[3, 1]]) } });
    expect(named.markers.map(marker => [marker.text, marker.labelText ?? null]).sort()).toEqual([['', 'Shop 4'], ['1', 'Shop 3'], ['2', null]]);
  });
  it('keeps the list ordinal in the circle and the market\'s own stall number in the name label, never in the same place', () => {
    const stores = [shop(1, 37.5, 127, { storeNo: '5-21호' }), shop(3, 37.51, 127.01)];
    const named = buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 19, selection: { numbers: new Map([[1, 1], [3, 2]]) } });
    expect(named.markers.map(marker => [marker.text, marker.labelText])).toEqual([['1', 'Shop 1 5-21호'], ['2', 'Shop 3']]);
    // 순번이 있는 이름 핀은 숫자가 보이게 원을 키우고, 없으면 작은 점이다
    expect(named.markers.map(marker => marker.size)).toEqual([20, 20]);
    expect(buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 19 }).markers.map(marker => [marker.size, marker.text])).toEqual([[12, ''], [12, '']]);
  });
  it('derives drawing-only hulls from IN coordinates without changing classification or response', () => {
    const before = JSON.stringify(overlayData); const model = buildMarketOverlay({ data: overlayData, zoom: 19 });
    expect(model.marketPolygon!).toMatchObject({ key: 'market', fillOpacity: .12, strokeWeight: 1.5 });
    expect(model.marketPolygon!.coordinates).toHaveLength(3); expect(model).not.toHaveProperty('zonePolygons');
    expect(model.markers).toHaveLength(3); expect(model.markers[2].color).toBe('var(--ko-text-muted)'); expect(JSON.stringify(overlayData)).toBe(before);
  });
  it('keeps supplied boundaries, filters requested stores and excludes absent coordinates', () => {
    const data = { ...overlayData, boundary: { source: 'OSM' as const, polygon: [[37, 126], [38, 126], [38, 128]] as [number, number][] } };
    const model = buildMarketOverlay({ data, zoom: 19, bounds, storeIds: [1, 2, 3, 4] });
    expect(model.marketPolygon!.coordinates).toBe(data.boundary.polygon); expect(model).not.toHaveProperty('zonePolygons');
    expect(model.markers.map((m) => m.storeIds)).toEqual([[1, 2], [3]]);
  });
  it('labels each alley name only once at the longest path midpoint starting at 18', () => {
    expect(buildMarketOverlay({ data: overlayData, zoom: 17 }).labels).toHaveLength(0);
    const model = buildMarketOverlay({ data: overlayData, zoom: 18 });
    expect(model.alleys).toHaveLength(2); expect(model.labels).toHaveLength(1); expect(model.labels[0]).toMatchObject({ longitude: 127, text: 'Alley' }); expect(model.labels[0].latitude).toBeCloseTo(37.501, 8);
    expect(model.alleys[0]).toMatchObject({ color: 'var(--ko-text-muted)', strokeOpacity: .65, strokeWeight: 1.5 });
    expect(model.labels[0].color).toBe('var(--ko-text-muted)');
  });
  it('groups shops at one spot into a count pin at every zoom instead of stacking their names over the map', () => {
    const data = { ...overlayData, stores: [1, 2, 3].map((id) => shop(id, 37.5, 127)) };
    for (const zoom of [19, 20, 21]) {
      const model = buildMarketOverlay({ data, zoom, userPosition: { latitude: 37.5, longitude: 127, accuracy: 12 } });
      expect(model.markers.map((marker) => [marker.storeIds, marker.text, marker.label])).toEqual([[[1, 2, 3], '3', false]]);
      expect(model.userPosition).toMatchObject({ latitude: 37.5, longitude: 127, accuracy: 12 });
    }
  });
  it('drops a name label that would overlap another instead of pushing it down, so labels never pile up', () => {
    // 줌 19 에서 가로 30px 씩 떨어진 가게 — 핀은 따로지만 이름표(가로 100px 남짓)는 서로 겹친다
    const stores = [0, 1, 2, 3].map((i) => shop(i + 1, 37.5, 127 + i * 0.00016, { name: `가게이름${i + 1}` }));
    const model = buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 19 });
    expect(model.markers).toHaveLength(4);
    const labelled = model.markers.filter((marker) => marker.label);
    expect(labelled.length).toBeGreaterThan(0); expect(labelled.length).toBeLessThan(4);
    expect(new Set(model.markers.map((marker) => marker.labelOffset.y))).toEqual(new Set([20, 0]));
    expect(model.markers.filter((marker) => !marker.label).every((marker) => marker.labelText === undefined)).toBe(true);
  });
  it('keeps clusters at 19 while more than 150 shops are on screen', () => {
    const stores = Array.from({ length: 160 }, (_, i) => shop(i + 1, 37.5 + (i % 16) * 0.00005, 127 + Math.floor(i / 16) * 0.00005));
    const dense = buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 19, bounds });
    expect(dense.markers.every((marker) => !marker.label)).toBe(true);
    expect(dense.markers.reduce((count, marker) => count + marker.storeIds.length, 0)).toBe(160);
    const sparse = buildMarketOverlay({ data: { ...overlayData, stores: stores.slice(0, 150) }, zoom: 19, bounds });
    expect(sparse.markers.some((marker) => marker.label)).toBe(true);
    expect(sparse.markers.reduce((count, marker) => count + marker.storeIds.length, 0)).toBe(150);
  });
});

it.each([[1, 20, 'xs'], [9, 20, 'xs'], [10, 26, 'sm'], [99, 26, 'sm'], [100, 32, 'base']] as const)('sizes %s-shop clusters to %spx with matching paths and font', (count, size, font) => {
  const stores = Array.from({ length: count }, (_, index) => shop(index, 37.5, 127));
  const model = buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 17 });
  expect(model.markers).toHaveLength(1); expect(model.markers[0]).toMatchObject({ size, fontSize: `var(--ko-text-${font})` });
  expect(model.markers[0].iconPath).toContain(`a ${size / 2},${size / 2}`);
});
it('colors clusters by majority with stable ties and all OUT muted regardless of nearby', () => {
  const cafe = { categoryMajor: '음식', categoryMid: '비알코올' };
  const stores = [shop(1, 37.5, 127, cafe), shop(2, 37.5, 127), shop(3, 37.5, 127)];
  const draw = (rows: MarketStore[]) => buildMarketOverlay({ data: { ...overlayData, stores: rows }, zoom: 17 }).markers[0];
  expect(draw(stores).color).toBe('var(--market-type-1)'); expect(draw(stores.slice(0, 2)).color).toBe('var(--market-type-1)');
  expect(draw([stores[1], stores[0], shop(4, 37.5, 127, cafe)]).color).toBe('var(--market-type-3)');
  expect(draw(stores.map(store => ({ ...store, membership: 'OUT', nearby: true }))).color).toBe('var(--ko-text-muted)');
  const apart = stores.map((store, index) => ({ ...store, longitude: 127 + index * 0.001 }));
  expect(buildMarketOverlay({ data: { ...overlayData, stores: apart }, zoom: 19 }).markers.every(marker => marker.size === 12 && marker.label)).toBe(true);
});
