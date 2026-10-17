import { afterEach, describe, expect, it, vi } from 'vitest';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ get }) } }));
import { fetchMarketContentIds, fetchMarketDishes, searchMarkets, searchMarketStores } from '../marketApi';
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


it('fetches the shared backend food dictionary without embedding a frontend mapping', async () => {
  const dishes = [{ dish: '떡볶이', categorySub: '김밥/만두/분식', dishEn: 'tteokbokki' }];
  get.mockResolvedValue({ data: { data: dishes } });
  expect(await fetchMarketDishes()).toEqual(dishes);
  expect(get).toHaveBeenCalledWith('/api/v1/place/markets/dishes');
});

describe('market-store engine API', () => {
  it.each(['', '<html>gateway</html>', {}, { data: null }, { data: { items: [{}], total: 1, markets: [] } }, { success: false, data: { items: [], total: 0, markets: [] } }, { error: { code: 'ERROR', message: 'offline' }, data: { items: [], total: 0, markets: [] } }])('falls back for invalid envelopes %j', async body => {
    get.mockResolvedValue({ data: body });
    expect(await searchMarketStores('국밥', { lang: 'ko' })).toBeNull();
  });
  it('returns null on errors and unwraps valid results', async () => {
    get.mockRejectedValueOnce(new Error('offline'));
    expect(await searchMarketStores('국밥', { lang: 'ko' })).toBeNull();
    const data = { items: [{ storeId: 2, contentId: '100', matchedBy: 'DISH', score: 4 }], total: 1, markets: [{ contentId: '100', marketName: '시장', count: 1 }] };
    get.mockResolvedValue({ data: { data } });
    expect(await searchMarketStores(' 국밥 ', { contentId: '100', lang: 'en', page: 0, size: 200 })).toEqual(data);
    expect(get).toHaveBeenLastCalledWith('/api/v1/search/market-stores', { params: { q: '국밥', contentId: '100', lang: 'en', page: 0, size: 200 } });
  });
});

it('accepts nullable metadata and server matched-clause arrays', async () => {
  const data = { items: [{ storeId: 2, contentId: '100', matchedBy: ['NAME', 'DISH'], score: 4, name: '가게', nameEn: null,
    address: '시장길', goodPrice: true, goodPriceMenus: ['국수'], sources: ['ONNURI'], attraction: { id: 7, lang: 'ko' } }],
    total: 1, markets: [{ contentId: '100', marketName: '시장', count: 1, region: null, marketNameEn: null, marketType: 'STREET', attraction: null }] };
  get.mockResolvedValue({ data: { data } });
  expect((await searchMarketStores('가게', { lang: 'ko' }))?.items[0]).toMatchObject({ name: '가게', matchedBy: 'NAME', goodPriceMenus: ['국수'] });
});
it.each([{ goodPrice: 'yes' }, { goodPriceMenus: [5000] }, { attraction: { id: 7, lang: 'ja' } }, { address: 7 }, { sources: 'ONNURI' }])('rejects invalid new display fields %j', async bad => {
  get.mockResolvedValue({ data: { data: { items: [{ storeId: 2, contentId: '100', matchedBy: 'NAME', score: 4, ...bad }], total: 1, markets: [] } } });
  expect(await searchMarketStores('가게', { lang: 'ko' })).toBeNull();
});
