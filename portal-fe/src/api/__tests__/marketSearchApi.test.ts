import { afterEach, describe, expect, it, vi } from 'vitest';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ get }) } }));
import { fetchMarketContentIds, searchMarkets } from '../marketApi';
afterEach(() => get.mockReset());
describe('public market discovery API', () => {
  it('unwraps responses and sends trimmed bounded query, locale and paging', async () => {
    const data = { markets: [], stores: { items: [], total: 0 } };
    get.mockResolvedValue({ data: { data } });
    expect(await searchMarkets(` ${'가'.repeat(60)} `, 'en', -1, 100)).toBe(data);
    expect(get).toHaveBeenCalledWith('/api/v1/place/markets/search', { params: { q: '가'.repeat(50), lang: 'en', page: 0, size: 50 } });
  });
  it('sends empty queries for the market list and unwraps content IDs', async () => {
    get.mockResolvedValue({ data: { data: ['100'] } });
    await searchMarkets(' ');
    expect(get).toHaveBeenCalledWith('/api/v1/place/markets/search', { params: { q: '', lang: 'ko', page: 0, size: 20 } });
    expect(await fetchMarketContentIds()).toEqual(['100']);
    expect(get).toHaveBeenLastCalledWith('/api/v1/place/markets/content-ids');
  });
});
