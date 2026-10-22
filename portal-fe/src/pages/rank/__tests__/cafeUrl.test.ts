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
