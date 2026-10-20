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
