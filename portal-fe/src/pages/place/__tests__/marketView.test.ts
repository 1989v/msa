import { describe, expect, it } from 'vitest';
import type { MarketStore, MarketZone } from '../../../api/marketApi';
import { clusterByScreenDistance, formatMarketPrice, formatGoodPriceSummary, formatMarketFloor, groupMarketPins, longestMarketSegmentMidpoint, marketSourceBadges, matchesMarketName, matchesMarketStore, projectMarketPins, visibleMarketStores, zoneIds } from '../marketView';

const store = (overrides: Partial<MarketStore> = {}): MarketStore => ({
  id: 1, name: '유명 순대국', items: null, zoneId: 1, membership: 'IN', latitude: 37.5, longitude: 127,
  roadAddress: null, jibunAddress: null, buildingName: null, dong: null, floor: null, ho: null,
  categoryMajor: null, categoryMid: null, categorySub: null, sources: ['ONNURI'], pinKind: 'EXACT',
  manual: false, actorKind: null, relativePosition: null, positionNote: null, ...overrides,
});

describe('market display projection', () => {
  it('uses boundary bounds independently of stores, including when there are no shops', () => {
    const geometry = { boundary: { polygon: [[37.5, 127], [37.501, 127], [37.501, 127.001], [37.5, 127.001]] as [number, number][], source: 'OSM' as const } };
    const empty = projectMarketPins([], geometry)!;
    const distant = projectMarketPins(groupMarketPins([store({ latitude: 38 })]), geometry)!;
    expect(empty).not.toBeNull();
    expect(empty.project([37.5, 127])).toEqual(distant.project([37.5, 127]));
    expect(empty.scale100m).toBe(distant.scale100m);
    expect(empty.project([37.501, 127]).y).toBeCloseTo(48);
    expect(empty.project([37.5, 127]).y).toBeCloseTo(384);
  });

  it('extends a boundary viewport to pins within 300 m of its centre so nearby shops stay on the map', () => {
    const geometry = { boundary: { polygon: [[37.5, 127], [37.501, 127], [37.501, 127.001], [37.5, 127.001]] as [number, number][], source: 'OSM' as const } };
    const empty = projectMarketPins([], geometry)!;
    // 37.5020 is about 170 m north of the boundary centre: inside the margin, outside the polygon.
    const near = projectMarketPins(groupMarketPins([store({ latitude: 37.502 })]), geometry)!;
    const point = near.project([37.502, 127.0005]);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(near.scale100m).toBeLessThan(empty.scale100m);
    expect(empty.project([37.502, 127.0005]).y).toBeLessThan(0);
  });

  it('fits paths without a boundary and keeps null geometry on the legacy viewport', () => {
    const pins = groupMarketPins([store()]);
    const legacy = projectMarketPins(pins)!;
    const absent = projectMarketPins(pins, { boundary: null, paths: null, entrances: null })!;
    expect(absent.points).toEqual(legacy.points);
    expect(absent.scale100m).toBe(legacy.scale100m);
    const pathOnly = projectMarketPins([], { paths: [{ id: 1, name: null, named: false, source: 'MANUAL', geometry: [[37.5, 127], [37.501, 127]] }] })!;
    expect(pathOnly.project([37.501, 127]).y).toBeCloseTo(48);
  });

  it('places a single label halfway along the longest segment, ignoring zero-length segments', () => {
    expect(longestMarketSegmentMidpoint([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 20 }, { x: 4, y: 20 }])).toEqual({ x: 4, y: 10 });
    expect(longestMarketSegmentMidpoint([{ x: 4, y: 20 }])).toBeNull();
    expect(longestMarketSegmentMidpoint([{ x: 4, y: 20 }, { x: 4, y: 20 }])).toBeNull();
  });
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


describe('good-price formatting', () => {
  it.each([
    ['ko', 5000, 6000, '착한가격업소 2곳 · 5,000~6,000원'],
    ['en', 5000, 6000, 'Good-price shops 2 · ₩5,000–6,000'],
    ['ko', 5000, 5000, '착한가격업소 2곳 · 5,000원'],
    ['en', 5000, 5000, 'Good-price shops 2 · ₩5,000'],
    ['ko', null, null, '착한가격업소 2곳'],
    ['en', null, null, 'Good-price shops 2'],
  ] as const)('formats %s summary (%s, %s)', (lang, minPrice, maxPrice, expected) => {
    expect(formatGoodPriceSummary({ storeCount: 2, minPrice, maxPrice }, lang)).toBe(expected);
  });
  it('formats prices in both languages, including zero', () => {
    expect(formatMarketPrice(5000, 'ko')).toBe('5,000원');
    expect(formatMarketPrice(5000, 'en')).toBe('₩5,000');
    expect(formatMarketPrice(0, 'ko')).toBe('0원');
  });
});


describe('screen-distance market clusters', () => {
  const points = () => [
    { key: 'parcel-a', x: 10, y: 20, color: 'first', stores: [store({ id: 1 }), store({ id: 2 })] },
    { key: 'parcel-b', x: 30, y: 20, color: 'second', stores: [store({ id: 3 })] },
    { key: 'parcel-c', x: 110, y: 20, color: 'third', stores: [store({ id: 4 })] },
  ];
  it('merges parcels within 24 screen pixels, preserving every store, first color and inputs', () => {
    const input = points(); const before = JSON.stringify(input);
    const groups = clusterByScreenDistance(input, 1, 24);
    expect(groups).toHaveLength(2);
    expect(groups[0].stores.map((shop) => shop.id)).toEqual([1, 2, 3]);
    expect(groups[0].parcelKeys).toEqual(['parcel-a', 'parcel-b']);
    expect(groups[0].color).toBe('first');
    expect(JSON.stringify(input)).toBe(before);
  });
  it('splits a nearby group when zoom raises screen distance beyond 24 pixels', () => {
    expect(clusterByScreenDistance(points(), 1)).toHaveLength(2);
    expect(clusterByScreenDistance(points(), 2)).toHaveLength(3);
  });
  it('merges connected chains, includes the exact threshold and supports no points', () => {
    const input = points().map((point, index) => ({ ...point, x: index * 24 }));
    expect(clusterByScreenDistance(input, 1)).toHaveLength(1);
    expect(clusterByScreenDistance([], 1)).toEqual([]);
    expect(clusterByScreenDistance([input[0]], 8)[0].key).toBe('parcel-a');
  });
});

// WU-18: actual-coordinate guidance and viewport geometry.
describe('market user location', () => {
  it('uses the boundary centre, ignores a duplicate closing vertex and falls back to response market coordinates', async () => {
    const { marketLocationGuide } = await import('../marketView');
    const polygon: [number, number][] = [[37.49, 126.99], [37.51, 126.99], [37.51, 127.01], [37.49, 127.01], [37.49, 126.99]];
    const at = { latitude: 37.5, longitude: 127 };
    expect(marketLocationGuide(at, { latitude: 0, longitude: 0 }, polygon)!.distance).toBeCloseTo(0);
    expect(marketLocationGuide(at, at, [])!.inside).toBe(true);
    expect(marketLocationGuide(at, {}, [])).toBeNull();
  });
  it('treats polygon inclusion OR a centre distance under 100 metres as inside', async () => {
    const { marketLocationGuide } = await import('../marketView');
    const polygon: [number, number][] = [[37.49, 126.99], [37.51, 126.99], [37.51, 127.01], [37.49, 127.01]];
    expect(marketLocationGuide({ latitude: 37.509, longitude: 127 }, {}, polygon)!.inside).toBe(true);
    expect(marketLocationGuide({ latitude: 37.5, longitude: 127 }, { latitude: 37.5005, longitude: 127 }, [])!.inside).toBe(true);
    expect(marketLocationGuide({ latitude: 37.5, longitude: 127 }, { latitude: 37.502, longitude: 127 }, [])!.inside).toBe(false);
  });
  it('calculates an equirectangular distance in metres and all eight user-to-centre bearings', async () => {
    const { marketLocationGuide } = await import('../marketView');
    const metres = Math.PI * 6_371_008.8 / 180;
    const from = { latitude: 37.5, longitude: 127 };
    const directions = [[0, 1, '북'], [1, 1, '북동'], [1, 0, '동'], [1, -1, '남동'], [0, -1, '남'], [-1, -1, '남서'], [-1, 0, '서'], [-1, 1, '북서']] as const;
    for (const [east, north, direction] of directions) {
      const target = { latitude: from.latitude + north * 200 / metres, longitude: from.longitude + east * 200 / (metres * Math.cos(from.latitude * Math.PI / 180)) };
      const guide = marketLocationGuide(from, target, [])!;
      expect(guide.direction).toBe(direction);
      expect(guide.distance).toBeCloseTo(Math.hypot(east, north) * 200, 1);
    }
  });
  it('includes viewBox edges and clamps arrows to an inset edge along the user bearing', async () => {
    const { marketPositionInView } = await import('../marketView');
    const view = { x: 10, y: 20, w: 100, h: 80 };
    expect(marketPositionInView({ x: 10, y: 20 }, view).visible).toBe(true);
    const outside = marketPositionInView({ x: 500, y: 60 }, view, 5);
    expect(outside.visible).toBe(false);
    expect(outside.x).toBe(105);
    expect(outside.y).toBe(60);
    expect(outside.angle).toBe(90);
  });
});


describe('market store search fields and rank', () => {
  it('ranks exact field evidence without synonyms or category expansion', () => {
    const rows = [
      store({ id: 7, name: '비일치가게', categorySub: '김밥/만두/분식' }),
      store({ id: 6, name: '소분류집', categorySub: '떡볶이' }),
      store({ id: 5, name: '중분류집', categoryMid: '떡볶이' }),
      store({ id: 4, name: '대분류집', categoryMajor: '떡볶이' }),
      store({ id: 3, name: '메뉴집', goodPrice: { category: '분식', matchedBy: 'NAME', menus: [{ name: '떡 볶 이', price: 3000 }] } }),
      store({ id: 2, name: '품목집', items: '떡볶이, 튀김' }),
      store({ id: 1, name: '떡볶이집', items: '떡볶이' }),
    ];
    const matches = rows.flatMap((row) => { const match = matchesMarketStore(row, ' 떡 볶이 '); return match ? [{ id: row.id, ...match }] : []; })
      .sort((a, b) => a.rank - b.rank || a.id! - b.id!);
    expect(matches).toEqual([
      { id: 1, matchedBy: 'name', rank: 0 }, { id: 2, matchedBy: 'items', rank: 1 },
      { id: 3, matchedBy: 'menus', rank: 2 }, { id: 4, matchedBy: 'categories', rank: 3 },
      { id: 5, matchedBy: 'categories', rank: 3 }, { id: 6, matchedBy: 'categories', rank: 3 },
    ]);
    expect(rows.filter((row) => row.name.replace(/\s/gu, '').includes('떡볶이')).map((row) => row.id)).toEqual([1]);
    expect(matchesMarketStore(rows[0], '분식')).toEqual({ matchedBy: 'categories', rank: 3 });
    expect(matchesMarketStore(rows[0], '음식')).toBeNull();
  });
  it('normalizes NFKC, whitespace and case and keeps blank queries inactive', () => {
    expect(matchesMarketStore(store({ name: 'Ｃａｆｅ １' }), 'c A f e1')).toEqual({ matchedBy: 'name', rank: 0 });
    expect(matchesMarketStore(store({ items: 'ＡＢＣ' }), 'abc')).toEqual({ matchedBy: 'items', rank: 1 });
    expect(matchesMarketStore(store(), '　 ')).toBeNull();
  });
  it('keeps nearby OUT stores visible without changing membership', () => {
    const rows = [store(), store({ id: 2, membership: 'OUT', nearby: true }), store({ id: 3, membership: 'OUT' })];
    expect(visibleMarketStores(rows, false).map((row) => row.id)).toEqual([1, 2]);
    expect(rows[1].membership).toBe('OUT');
  });
});

describe('WU21 dictionary contract', () => {
  const dishes = [{ dish: '떡볶이', dishEn: 'tteokbokki', categorySub: '김밥/만두/분식' }];
  const related = store({ name: '가게', items: null, categorySub: '김밥/만두/분식' });
  it('expands only exact normalized dishes to exact subcategories at rank four', () => {
    expect(matchesMarketStore(related, '떡 볶 이', dishes)).toEqual({ matchedBy: 'related', rank: 4, relatedCategory: '김밥/만두/분식' });
    expect(matchesMarketStore(related, 'ＴＴＥＯＫＢＯＫＫＩ', dishes)?.rank).toBe(4);
    expect(matchesMarketStore(related, 'tteok', dishes)).toBeNull();
    expect(matchesMarketStore(store({ ...related, categorySub: '분식' }), 'tteokbokki', dishes)).toBeNull();
    expect(matchesMarketStore(related, 'tteokbokki')).toBeNull();
    expect(matchesMarketStore(store({ ...related, items: '떡볶이' }), '떡볶이', dishes)?.rank).toBe(1);
  });
  it('searches supplied English names, categories, items and TourAPI menus with legacy fallback', () => {
    expect(matchesMarketStore(store({ nameEn: 'Sunhuine' }), 'sun hui ne')?.rank).toBe(0);
    expect(matchesMarketStore(store({ itemsEn: 'Seafood' }), 'seafood')?.rank).toBe(1);
    expect(matchesMarketStore(store({ categoryEn: 'Snacks' }), 'snack')?.rank).toBe(3);
    expect(matchesMarketStore(store({ tourMenu: { firstMenu: '빈대떡', treatMenu: '육회', firstMenuEn: 'Mung bean pancake', treatMenuEn: 'Beef tartare', attraction: { id: 8, lang: 'en' } } }), 'beef tartare')?.rank).toBe(2);
    expect(matchesMarketStore(store(), '순대')?.rank).toBe(0);
  });
});
