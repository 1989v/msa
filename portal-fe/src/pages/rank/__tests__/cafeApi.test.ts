import { afterEach, expect, it, vi } from 'vitest';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ get }) } }));
import { fetchCafeDrinks } from '../../../api/rankingApi';
import { readCafeFilters } from '../cafeUrl';

afterEach(() => get.mockReset());
it.each([
  ['coffee', ['아메리카노', '에스프레소', '콜드브루'], null],
  ['blended', ['스무디·프라페'], null],
  ['decaf', [], 'decaf'],
])('sends expanded %s API filters without UI category metadata', async (slug, groups, caffeine) => {
  get.mockResolvedValue({ data: { data: { content: [], totalElements: 0 } } });
  await fetchCafeDrinks(readCafeFilters(new URLSearchParams(`category=${slug}&maxSugar=10`)));
  const params = get.mock.calls[0][1].params as URLSearchParams;
  expect(params.has('category')).toBe(false);
  expect(params.getAll('group')).toEqual(groups);
  expect(params.get('caffeine')).toBe(caffeine);
  expect(params.get('maxSugar')).toBe('10');
});
