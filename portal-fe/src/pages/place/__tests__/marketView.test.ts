import { describe, expect, it } from 'vitest';
import type { MarketStore, MarketZone } from '../../../api/marketApi';
import { formatMarketFloor, groupMarketPins, marketSourceBadges, matchesMarketName, projectMarketPins, visibleMarketStores, zoneIds } from '../marketView';

const store = (overrides: Partial<MarketStore> = {}): MarketStore => ({
  id: 1, name: '유명 순대국', items: null, zoneId: 1, membership: 'IN', latitude: 37.5, longitude: 127,
  roadAddress: null, jibunAddress: null, buildingName: null, dong: null, floor: null, ho: null,
  categoryMajor: null, categoryMid: null, categorySub: null, sources: ['ONNURI'], pinKind: 'EXACT',
  manual: false, actorKind: null, relativePosition: null, positionNote: null, ...overrides,
});

describe('market display projection', () => {
  it('labels STEWARD manual entries and source-store overrides', () => {
    expect(marketSourceBadges(store({ actorKind: 'STEWARD' }), 'ko')).toEqual(['가맹점', '상인회 제공']);
    expect(marketSourceBadges(store({ actorKind: 'STEWARD', manual: true, sources: ['MANUAL'] }), 'ko')).toEqual(['상인회 제공']);
    expect(marketSourceBadges(store({ actorKind: 'STEWARD' }), 'en')).toContain('Merchant association');
  });
  it('groups the same parcel or coordinate, and omits unknown and missing coordinates', () => {
    const rows = [store({ jibunAddress: '서울 1' }), store({ id: 2, jibunAddress: '서울 1', longitude: 127.001 }),
      store({ id: 3 }), store({ id: 4, latitude: null }), store({ id: 5, membership: 'UNKNOWN' }),
      store({ id: 6, latitude: Number.NaN })];
    const pins = groupMarketPins(rows);
    expect(pins).toHaveLength(1);
    expect(pins[0].stores.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it('ignores whitespace and case, matches part of the name, and leaves empty queries inactive', () => {
    expect(matchesMarketName(store(), ' 유 명순 대 ')).toBe(true);
    expect(matchesMarketName(store({ name: 'Cafe 한지' }), ' C A F E ')).toBe(true);
    expect(matchesMarketName(store(), '홍두깨')).toBe(false);
    expect(matchesMarketName(store(), '  ')).toBe(false);
  });

  it('merges existing groups when a parcel and coordinate bridge connects them', () => {
    const pins = groupMarketPins([store({ jibunAddress: 'A' }), store({ id: 2, jibunAddress: 'B', longitude: 127.01 }),
      store({ id: 3, jibunAddress: 'A', longitude: 127.01 })]);
    expect(pins).toHaveLength(1);
    expect(pins[0].stores).toHaveLength(3);
  });

  it('keeps sources distinct from manual actors and reference location', () => {
    expect(marketSourceBadges(store({ sources: ['ONNURI', 'SANGGA'] }), 'ko')).toEqual(['가맹점', '상가정보']);
    expect(marketSourceBadges(store({ sources: ['SANGGA'] }), 'ko')).toEqual(['가맹점 아님 · 상가정보']);
    expect(marketSourceBadges(store({ manual: true, actorKind: 'ADMIN', pinKind: 'REFERENCE' }), 'ko')).toEqual(['운영자 입력', '참고 위치']);
    expect(marketSourceBadges(store({ sources: ['MANUAL'], actorKind: 'STEWARD' }), 'en')).toEqual(['Merchant association']);
  });

  it('hides OUT by default, keeps UNKNOWN in the list, and includes child floors when filtering a building', () => {
    const floor: MarketZone = { id: 2, parentId: 1, kind: 'FLOOR', name: '1층', dong: null, floor: '1', children: [] };
    const building: MarketZone = { ...floor, id: 1, parentId: null, kind: 'BUILDING', name: '본관', children: [floor] };
    const rows = [store(), store({ id: 2, zoneId: 2, membership: 'UNKNOWN' }), store({ id: 3, membership: 'OUT' }), store({ id: 4, zoneId: null })];
    expect(visibleMarketStores(rows, false).map((row) => row.id)).toEqual([1, 2, 4]);
    expect(visibleMarketStores(rows, true, zoneIds(building)).map((row) => row.id)).toEqual([1, 2, 3]);
    expect(visibleMarketStores(rows, false, zoneIds(floor)).map((row) => row.id)).toEqual([2]);
  });

  it.each([
    ['1', '1층', '1F'], [1, '1층', '1F'], ['B1', '지하 1층', 'B1'],
    ['지하 2층', '지하 2층', 'B2'], ['-3', '지하 3층', 'B3'],
    ['2층', '2층', '2F'], ['3F', '3층', '3F'], ['옥상', '옥상', '옥상'],
    ['', null, null], [null, null, null],
  ])('formats floor %s without inventing unfamiliar source values', (raw, ko, en) => {
    expect(formatMarketFloor(raw, 'ko')).toBe(ko);
    expect(formatMarketFloor(raw, 'en')).toBe(en);
  });

  it('fills the available long axis for even a tiny market, with exterior pins inside the margins', () => {
    const projected = projectMarketPins(groupMarketPins([
      store({ longitude: 127 }), store({ id: 2, longitude: 127.0001 }),
      store({ id: 3, longitude: 126.9999, membership: 'OUT' }),
    ]))!;
    const xs = projected.points.map((pin) => pin.x);
    expect(Math.min(...xs)).toBeCloseTo(28, 6);
    expect(Math.max(...xs)).toBeCloseTo(572, 6);
    expect(projected.points.every((pin) => pin.y >= 48 && pin.y <= 384)).toBe(true);
    expect(projected.scaleBarLength).toBeLessThanOrEqual(544);
    expect(projected.scaleBarLength / projected.scale100m).toBeCloseTo(projected.scaleBarMetres / 100, 6);
    expect(projected.scaleBarMetres).toBeLessThan(100);
  });

  it('corrects longitude by latitude and uses one metre scale for both axes', () => {
    const metresPerDegree = Math.PI * 6_371_008.8 / 180;
    const latitude = 37.5;
    const north = 30 / metresPerDegree;
    const east = 30 / (metresPerDegree * Math.cos(latitude * Math.PI / 180));
    const projected = projectMarketPins(groupMarketPins([
      store({ latitude: latitude - north }), store({ id: 2, latitude: latitude + north }),
      store({ id: 3, longitude: 127 + east }),
    ]))!;
    expect(Math.abs(projected.points[1].y - projected.points[0].y)).toBeCloseTo(projected.scale100m * 0.6, 6);
    expect(Math.abs(projected.points[2].x - projected.points[0].x)).toBeCloseTo(projected.scale100m * 0.3, 6);
    expect(Math.min(...projected.points.map((pin) => pin.y))).toBeCloseTo(48, 6);
    expect(Math.max(...projected.points.map((pin) => pin.y))).toBeCloseTo(384, 6);
  });

  it('fits every point and draws 100 metres at the same projection scale', () => {
    const metresPerDegree = Math.PI * 6_371_008.8 / 180;
    const projected = projectMarketPins(groupMarketPins([store(), store({ id: 2, latitude: 37.5 + 100 / metresPerDegree })]));
    expect(projected).not.toBeNull();
    expect(Math.abs(projected!.points[1].y - projected!.points[0].y)).toBeCloseTo(projected!.scale100m, 6);
    expect(projected!.points.every((point) => point.x >= 28 && point.x <= 572 && point.y >= 48 && point.y <= 384)).toBe(true);
    expect(projectMarketPins([])).toBeNull();
    expect(projectMarketPins(groupMarketPins([store()]))!.scale100m).toBeGreaterThan(0);
  });
});
