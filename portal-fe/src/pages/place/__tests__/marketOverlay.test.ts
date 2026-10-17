import { describe, expect, it } from 'vitest';
import type { MarketResponse, MarketStore } from '../../../api/marketApi';
import { buildMarketOverlay } from '../marketOverlay';
const shop = (id: number, lat: number | null, lng: number | null, extra: Partial<MarketStore> = {}): MarketStore => ({ id, name: `Shop ${id}`, latitude: lat, longitude: lng, zoneId: 1, membership: 'IN', items: null, roadAddress: null, jibunAddress: null, buildingName: null, dong: null, floor: null, ho: null, categoryMajor: null, categoryMid: null, categorySub: null, sources: [], pinKind: 'EXACT', manual: false, actorKind: null, relativePosition: null, positionNote: null, ...extra });
export const overlayData: MarketResponse = { market: { name: 'Market', marketType: 'STREET', sourceMarketType: null, storeCountRaw: null, openingCycle: null, facilities: null, attribution: null }, zones: [{ id: 1, parentId: null, kind: 'ROAD', name: 'Alley', dong: null, floor: null, children: [] }], stores: [shop(1, 37.5, 127), shop(2, 37.50001, 127.00001), shop(3, 37.5001, 127), shop(4, null, null), shop(5, 37.52, 127.02, { membership: 'OUT', nearby: true })], paths: [{ id: 1, name: 'Alley', named: true, source: 'OSM', geometry: [[37.5, 127], [37.501, 127]] }, { id: 2, name: 'Alley', named: true, source: 'OSM', geometry: [[37.5, 127], [37.502, 127]] }] };
const bounds = { north: 37.501, south: 37.499, west: 126.999, east: 127.001 };
describe('market overlay model', () => {
  it('uses one market marker at 16, parcel clusters at 17 and individual named shops at 19', () => {
    const low = buildMarketOverlay({ data: overlayData, zoom: 16, bounds });
    expect(low.markers).toHaveLength(1); expect(low.markers[0].text).toBe('Market · 5');
    expect(buildMarketOverlay({ data: overlayData, zoom: 17, bounds }).markers).toHaveLength(1);
    const high = buildMarketOverlay({ data: overlayData, zoom: 19, bounds, selection: { searchStoreIds: [2] } });
    expect(high.markers).toHaveLength(3); expect(high.markers[1].text).toBe('Shop 2'); expect(high.markers[1].strokeColor).toBe('var(--ko-accent-text)'); expect(high.markers[1]).toMatchObject({ highlighted: true, searchMatch: true });
  });
  it('derives drawing-only hulls from IN coordinates without changing classification or response', () => {
    const before = JSON.stringify(overlayData); const model = buildMarketOverlay({ data: overlayData, zoom: 19 });
    expect(model.marketPolygon!).toMatchObject({ key: 'market', fillOpacity: .12, strokeWeight: 1.5 });
    expect(model.marketPolygon!.coordinates).toHaveLength(3); expect(model.zonePolygons[0].color).toBe('var(--market-zone-1)');
    expect(model.markers).toHaveLength(4); expect(model.markers[3].color).toBe('var(--ko-text-muted)'); expect(JSON.stringify(overlayData)).toBe(before);
  });
  it('keeps supplied boundaries, highlights selected zones, filters markers and excludes absent coordinates', () => {
    const data = { ...overlayData, boundary: { source: 'OSM' as const, polygon: [[37, 126], [38, 126], [38, 128]] as [number, number][] } };
    const model = buildMarketOverlay({ data, zoom: 19, bounds, selection: { zoneId: 1 } });
    expect(model.marketPolygon!.coordinates).toBe(data.boundary.polygon); expect(model.zonePolygons[0]).toMatchObject({ fillOpacity: .24, selected: true });
    expect(model.markers.map((m) => m.storeIds)).toEqual([[1], [2], [3]]);
  });
  it('labels each alley name only once at the longest path midpoint starting at 18', () => {
    expect(buildMarketOverlay({ data: overlayData, zoom: 17 }).labels).toHaveLength(0);
    const model = buildMarketOverlay({ data: overlayData, zoom: 18 });
    expect(model.alleys).toHaveLength(2); expect(model.labels).toHaveLength(1); expect(model.labels[0]).toMatchObject({ longitude: 127, text: 'Alley' }); expect(model.labels[0].latitude).toBeCloseTo(37.501, 8);
    expect(model.alleys[0].strokeWeight).toBeLessThan(3);
  });
  it('keeps all coincident individual pins and gives every name a distinct collision-free offset', () => {
    const data = { ...overlayData, stores: [1, 2, 3].map((id) => shop(id, 37.5, 127)) };
    const model = buildMarketOverlay({ data, zoom: 19, userPosition: { latitude: 37.5, longitude: 127, accuracy: 12 } });
    expect(model.markers.map((marker) => marker.text)).toEqual(['Shop 1', 'Shop 2', 'Shop 3']);
    expect(model.markers.map((marker) => marker.labelOffset.y)).toEqual([20, 44, 68]);
    expect(model.userPosition).toMatchObject({ latitude: 37.5, longitude: 127, accuracy: 12 });
  });
  it('keeps clusters at 19 while more than 150 shops are on screen', () => {
    const stores = Array.from({ length: 160 }, (_, i) => shop(i + 1, 37.5 + (i % 16) * 0.00005, 127 + Math.floor(i / 16) * 0.00005));
    const dense = buildMarketOverlay({ data: { ...overlayData, stores }, zoom: 19, bounds });
    expect(dense.markers.every((marker) => !marker.label)).toBe(true);
    expect(dense.markers.reduce((count, marker) => count + marker.storeIds.length, 0)).toBe(160);
    const sparse = buildMarketOverlay({ data: { ...overlayData, stores: stores.slice(0, 150) }, zoom: 19, bounds });
    expect(sparse.markers).toHaveLength(150); expect(sparse.markers.every((marker) => marker.label)).toBe(true);
  });
});
