import { describe, expect, it } from 'vitest';
import { readCafeFilters, writeCafeFilters } from '../cafeUrl';
describe('cafe comparison URL state', () => {
  it('restores shared query, comparison group and repeated brands', () => {
    const filters = readCafeFilters(new URLSearchParams('q=아메리카노&group=AMERICANO&brand=a&brand=b&temperature=ICE&page=2'));
    expect(filters).toMatchObject({ q: '아메리카노', group: 'AMERICANO', brand: ['a', 'b'], temperature: 'ICE', page: 2 });
    expect(readCafeFilters(writeCafeFilters(filters))).toEqual(filters);
  });
  it('bounds malformed page, size and numeric filters', () => {
    expect(readCafeFilters(new URLSearchParams('page=-1&size=999&maxSugar=NaN&sort=bad'))).toMatchObject({ page: 0, size: 200, maxSugar: undefined, sort: 'sugar' });
  });
});

it('round-trips basis, repeated caffeine states, page and legacy zero/decaf aliases', () => {
  const filters = readCafeFilters(new URLSearchParams('basis=100ml&caffeineStatus=ZERO&caffeineStatus=DECAF&page=3&size=20'));
  expect(filters).toMatchObject({ basis: '100ml', caffeineStatus: ['ZERO', 'DECAF'], page: 3, size: 20 });
  expect(readCafeFilters(writeCafeFilters(filters))).toEqual(filters);
  expect(readCafeFilters(new URLSearchParams('caffeine=zero')).caffeine).toBe('zero');
  expect(readCafeFilters(new URLSearchParams('caffeine=decaf')).caffeine).toBe('decaf');
  expect(readCafeFilters(new URLSearchParams('sort=sugarPer100ml')).basis).toBe('100ml');
  expect(readCafeFilters(new URLSearchParams()).size).toBe(20);
});


it('round trips calorie caps and exact source size labels and rejects nonfinite bounds', () => {
  const filters = readCafeFilters(new URLSearchParams('maxKcal=200&sizeLabel=Tall%28톨%29'));
  expect(filters).toMatchObject({ maxKcal: 200, sizeLabel: 'Tall(톨)' });
  expect(readCafeFilters(writeCafeFilters(filters))).toMatchObject({ maxKcal: 200, sizeLabel: 'Tall(톨)' });
  expect(readCafeFilters(new URLSearchParams('maxKcal=NaN')).maxKcal).toBeUndefined();
});

it('preserves multiple source groups as repeated URL parameters and keeps single-group links compatible', () => {
  const filters = readCafeFilters(new URLSearchParams('group=아메리카노&group=콜드브루'));
  expect(filters.group).toEqual(['아메리카노', '콜드브루']);
  expect(writeCafeFilters(filters).getAll('group')).toEqual(['아메리카노', '콜드브루']);
  expect(readCafeFilters(new URLSearchParams('group=라떼')).group).toBe('라떼');
});

it.each([
  ['coffee', ['아메리카노', '에스프레소', '콜드브루']],
  ['coffee-latte', ['라떼', '바닐라라떼', '카라멜마끼아또', '카페모카', '카푸치노']],
  ['non-coffee', ['말차·녹차라떼', '고구마라떼', '초코', '밀크티', '우유·요거트']],
  ['tea', ['티']], ['ade', ['에이드', '탄산음료']], ['blended', ['스무디·프라페']], ['juice', ['주스']], ['etc', ['기타']],
])('expands category %s to exact source groups with no implicit name query', (slug, groups) => {
  const filters = readCafeFilters(new URLSearchParams(`category=${slug}&maxSugar=10`));
  expect(filters.group).toEqual(groups);
  expect(filters.q).toBeUndefined();
  const params = writeCafeFilters(filters);
  expect(params.getAll('category')).toEqual([slug]);
  expect(params.has('group')).toBe(false);
  expect(readCafeFilters(params)).toEqual(filters);
});

it('handles decaf, all, unknown categories and explicit legacy group precedence', () => {
  const decaf = readCafeFilters(new URLSearchParams('category=decaf&group=티'));
  expect(decaf).toMatchObject({ caffeine: 'decaf', group: undefined });
  expect(writeCafeFilters(decaf).has('caffeine')).toBe(false);
  expect(readCafeFilters(new URLSearchParams('category=all&group=티')).group).toBeUndefined();
  expect(readCafeFilters(new URLSearchParams('category=unknown&group=티')).group).toBe('티');
  expect(readCafeFilters(new URLSearchParams('category=tea&group=주스')).group).toEqual(['티']);
  expect(writeCafeFilters({ ...decaf, caffeine: undefined }).has('category')).toBe(false);
  expect(writeCafeFilters({ ...readCafeFilters(new URLSearchParams('category=coffee')), group: undefined }).has('category')).toBe(false);
});

it('shares multiple selected brands and decaf without losing query, basis or temperature', () => {
  const filters = readCafeFilters(new URLSearchParams('q=바닐라+라떼&brand=a&brand=b&caffeine=decaf&basis=100ml&temperature=HOT'));
  const params = writeCafeFilters(filters);
  expect(params.getAll('brand')).toEqual(['a', 'b']);
  expect(readCafeFilters(params)).toMatchObject({ q: '바닐라 라떼', brand: ['a', 'b'], caffeine: 'decaf', basis: '100ml', temperature: 'HOT' });
  expect(writeCafeFilters({ ...filters, brand: [] }).has('brand')).toBe(false);
});
