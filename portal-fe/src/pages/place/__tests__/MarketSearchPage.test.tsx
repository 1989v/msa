import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ComponentProps } from 'react';
import type MarketNaverMap from '../MarketNaverMap';
import { searchMarkets, searchMarketStores, fetchMarket, type MarketSearchResult } from '../../../api/marketApi';
import MarketSearchPage from '../MarketSearchPage';

vi.mock('../../../api/marketApi', () => ({ searchMarkets: vi.fn(), searchMarketStores: vi.fn(), fetchMarket: vi.fn() }));
vi.mock('../../../components/Footer', () => ({ default: () => null }));
let mapProps: ComponentProps<typeof MarketNaverMap> | null = null;
vi.mock('../MarketNaverMap', () => ({ default: (props: ComponentProps<typeof MarketNaverMap>) => { mapProps = props; return <div data-testid="market-map" />; } }));
vi.mock('../../../hooks/useHeritageSurface', () => ({ useHeritageSurface: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); mapProps = null; });
// The route id is the attraction id (per language), never the TourAPI contentId.
const market = { contentId: '100', name: '광명시장', region: '경기 광명', marketType: 'STREET', storeCount: 153, attraction: { id: 7, lang: 'ko' as const } };
const result: MarketSearchResult = { query: '', markets: [market], stores: { items: [], total: 0, page: 0, size: 20 } };
function Address() { const location = useLocation(); return <span data-testid="address">{location.pathname}{location.search}</span>; }
function mount(entry = '/markets') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><MemoryRouter initialEntries={[entry]}><MarketSearchPage /><Address /></MemoryRouter></QueryClientProvider>);
}

describe('market shop discovery', () => {
  it('lists markets and counts for an empty query with links to their market sections', async () => {
    vi.mocked(searchMarkets).mockResolvedValue(result);
    mount();
    expect(await screen.findByRole('link', { name: /광명시장/ })).toHaveAttribute('href', '/attractions/7/market');
    expect(screen.getByText(/153 가게/)).toBeInTheDocument();
    expect(searchMarkets).toHaveBeenCalledWith('', 'ko', 0);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://place.1989v.com/markets');
  });

  it.each(['/markets', '/en/markets'])('renders shops, goods, category and alley with encoded deep links on %s', async (entry) => {
    const q = '순대 & 국밥';
    vi.mocked(searchMarkets).mockResolvedValue({ ...result, stores: { ...result.stores, total: 1, items: [{ storeId: 1, name: '유명순대국', items: '순대', category: '음식점', marketContentId: '100', marketName: '광명시장', zoneName: '시장 골목', latitude: null, longitude: null, attraction: { id: entry.startsWith('/en') ? 8 : 7, lang: entry.startsWith('/en') ? 'en' : 'ko' } }] } });
    mount(`${entry}?q=${encodeURIComponent(q)}`);
    const prefix = entry.startsWith('/en') ? '/en' : '';
    expect(await screen.findByRole('link', { name: /유명순대국/ })).toHaveAttribute('href', `${prefix}/attractions/${prefix ? 8 : 7}/market?marketQuery=${encodeURIComponent(q)}`);
    // A market with only a Korean page links there from the English search too.
    expect(screen.getByRole('link', { name: /광명시장 경기/ })).toHaveAttribute('href', `/attractions/7/market?marketQuery=${encodeURIComponent(q)}`);
    expect(screen.getByText('순대 · 음식점')).toBeInTheDocument();
    expect(screen.getByText('광명시장 · 시장 골목')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue(q);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `https://place.1989v.com${entry}`);
    if (prefix) expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('trims a submitted query while leaving the URL unchanged', async () => {
    vi.mocked(searchMarkets).mockResolvedValue(result);
    mount();
    await screen.findByRole('link', { name: /광명시장/ });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  순대  ' } });
    fireEvent.click(screen.getByRole('button', { name: '찾기' }));
    await waitFor(() => expect(searchMarkets).toHaveBeenLastCalledWith('순대', 'ko', 0));
    expect(screen.getByTestId('address')).toHaveTextContent('/markets');
    expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '50');
  });

  it('does not link a market that has no attraction page', async () => {
    vi.mocked(searchMarkets).mockResolvedValue({ ...result, markets: [{ ...market, attraction: null }] });
    mount();
    expect(await screen.findByText('광명시장')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /광명시장/ })).toBeNull();
  });

  it('shows a useful empty state', async () => {
    vi.mocked(searchMarkets).mockResolvedValue({ ...result, markets: [] });
    mount();
    expect(await screen.findByText('검색 결과가 없습니다.')).toHaveAttribute('role', 'status');
  });
  it('shows an error independently of the navigation', async () => {
    vi.mocked(searchMarkets).mockRejectedValue(new Error('offline'));
    mount('/en/markets');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load markets. Please try again in a moment.');
    expect(screen.getByRole('link', { name: '← Explore Korea' })).toHaveAttribute('href', '/en');
  });
  it('advances shop pages and resets to page zero for a new query', async () => {
    vi.mocked(searchMarkets).mockResolvedValue({ ...result, stores: { ...result.stores, total: 21 } });
    mount('/markets?q=국밥');
    fireEvent.click(await screen.findByRole('button', { name: '다음' }));
    await waitFor(() => expect(searchMarkets).toHaveBeenLastCalledWith('국밥', 'ko', 1));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '순대' } });
    fireEvent.click(screen.getByRole('button', { name: '찾기' }));
    await waitFor(() => expect(searchMarkets).toHaveBeenLastCalledWith('순대', 'ko', 0));
  });
});


it.each(['/markets', '/en/markets'])('shows a good-price badge and only the first menu in %s search results', async (entry) => {
  vi.mocked(searchMarkets).mockResolvedValue({ ...result, stores: { ...result.stores, total: 2, items: [
    { storeId: 1, name: '칼국수집', items: null, category: '한식', marketContentId: '100', marketName: '광명시장', zoneName: null, latitude: null, longitude: null, attraction: null,
      goodPrice: { category: '한식', menus: [{ name: '칼국수', price: 5000 }, { name: '수제비', price: 6000 }] } },
    { storeId: 2, name: '가격 미상', items: null, category: null, marketContentId: '100', marketName: '광명시장', zoneName: null, latitude: null, longitude: null, attraction: null,
      goodPrice: { category: '한식', menus: [{ name: '백반', price: null }] } },
  ] } });
  mount(`${entry}?q=국수`);
  expect(await screen.findAllByText(entry.startsWith('/en') ? 'Good price' : '착한가격')).toHaveLength(2);
  expect(screen.getByText(entry.startsWith('/en') ? '칼국수 ₩5,000' : '칼국수 5,000원')).toBeInTheDocument();
  expect(screen.getByText('백반')).toBeInTheDocument();
  expect(screen.queryByText(/수제비/)).not.toBeInTheDocument();
});

it('shows match evidence, related category distinction and English fields from search', async () => {
  vi.mocked(searchMarkets).mockResolvedValue({ ...result, stores: { ...result.stores, total: 1, items: [
    { storeId: 1, name: '가게', nameEn: 'Gage', items: '품목', itemsEn: 'Snacks', category: '분식', categoryEn: 'Snack shop',
      matchedBy: 'RELATED_CATEGORY', relatedCategory: '김밥/만두/분식', marketContentId: '100', marketName: '광명시장', zoneName: null, latitude: null, longitude: null, attraction: null },
  ] } });
  mount('/en/markets?q=tteokbokki');
  expect(await screen.findByText('Gage · 가게')).toBeInTheDocument();
  expect(screen.getByText('Snacks · Snack shop')).toBeInTheDocument();
  expect(screen.getByText('Related category · 김밥/만두/분식')).toHaveAttribute('data-related', 'true');
  expect(screen.queryByText(/Signature menu/)).not.toBeInTheDocument();
});

it('uses one engine request for market and shop rows and fetches only the mapped market', async () => {
  vi.mocked(searchMarketStores).mockResolvedValue({ items: [{ storeId: 4, contentId: '100', matchedBy: 'NAME', score: 4,
    name: '국수집', nameEn: 'Noodle shop', address: '서울 중구 시장길 1', marketName: '광명시장', goodPrice: true, goodPriceMenus: ['칼국수', '수제비'],
    attraction: { id: 8, lang: 'en' } }], total: 1, markets: [{ contentId: '100', marketName: '광명시장', region: '경기 광명', marketType: 'STREET', count: 12, attraction: { id: 7, lang: 'ko' } }] });
  mount('/en/markets?q=noodle');
  expect(await screen.findByText('Noodle shop · 국수집')).toBeInTheDocument();
  expect(screen.getByText('광명시장 · 서울 중구 시장길 1')).toBeInTheDocument();
  expect(screen.getByText('칼국수')).toBeInTheDocument();
  expect(screen.queryByText('수제비')).not.toBeInTheDocument();
  expect(screen.getByText(/12 shops/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Noodle shop/ })).toHaveAttribute('href', '/en/attractions/8/market?marketQuery=noodle');
  expect(searchMarketStores).toHaveBeenCalledOnce();
  expect(searchMarketStores).toHaveBeenCalledWith('noodle', { lang: 'en', page: 0, size: 20 });
  expect(searchMarkets).not.toHaveBeenCalled();
  // 행마다가 아니라 옆 지도에 띄운 첫 시장 하나만 받는다.
  await waitFor(() => expect(fetchMarket).toHaveBeenCalledOnce());
  expect(fetchMarket).toHaveBeenCalledWith('100', false, 'en');
});
it.each([null, { items: [], total: 0, markets: [] }])('falls back for unavailable or empty engine results %j', async engine => {
  vi.mocked(searchMarketStores).mockResolvedValue(engine);
  vi.mocked(searchMarkets).mockResolvedValue(result);
  mount('/markets?q=국수');
  expect(await screen.findByText('광명시장')).toBeInTheDocument();
  expect(searchMarketStores).toHaveBeenCalledOnce();
  expect(searchMarkets).toHaveBeenCalledWith('국수', 'ko', 0);
  await waitFor(() => expect(fetchMarket).toHaveBeenCalledOnce());
  expect(fetchMarket).toHaveBeenCalledWith('100', false, 'ko');
});

it('shows the first market beside search results and switches the map on a plain click', async () => {
  const other = { ...market, contentId: '200', name: '통인시장', attraction: { id: 9, lang: 'ko' as const } };
  vi.mocked(searchMarketStores).mockResolvedValue(null);
  vi.mocked(searchMarkets).mockResolvedValue({ ...result, markets: [market, other], stores: { ...result.stores, total: 1, items: [{ storeId: 5, name: '기름떡볶이', items: null, category: '분식', marketContentId: '200', marketName: '통인시장', zoneName: null, latitude: null, longitude: null, attraction: { id: 9, lang: 'ko' } }] } });
  vi.mocked(fetchMarket).mockImplementation(async contentId => ({ market: { name: contentId === '200' ? '통인시장' : '광명시장', marketType: 'STREET' }, zones: [], stores: [] }) as never);
  mount('/markets?q=떡볶이');
  expect(await screen.findByRole('region', { name: '광명시장 지도' })).toBeInTheDocument();
  await waitFor(() => expect(mapProps?.contentId).toBe('100'));
  expect(screen.getByRole('link', { name: '지도 크게 보기' })).toHaveAttribute('href', `/attractions/7/market?marketQuery=${encodeURIComponent('떡볶이')}`);

  fireEvent.click(screen.getByRole('link', { name: /기름떡볶이/ }));
  expect(screen.getByTestId('address')).toHaveTextContent('/markets?q=떡볶이');
  expect(await screen.findByRole('region', { name: '통인시장 지도' })).toBeInTheDocument();
  await waitFor(() => expect(mapProps?.contentId).toBe('200'));
  expect(mapProps?.selection).toMatchObject({ storeId: 5, searchStoreIds: [5] });
  expect(screen.getByRole('link', { name: /기름떡볶이/ })).toHaveAttribute('aria-current', 'true');
  act(() => mapProps?.onOpenStore?.(5));
  expect(screen.getByTestId('address')).toHaveTextContent('/attractions/9/market?store=5');
});

it('opens the full map when the result already on the map is clicked again', async () => {
  vi.mocked(searchMarketStores).mockResolvedValue(null);
  vi.mocked(searchMarkets).mockResolvedValue(result);
  vi.mocked(fetchMarket).mockResolvedValue({ market: { name: '광명시장', marketType: 'STREET' }, zones: [], stores: [] } as never);
  mount('/markets?q=광명');
  const link = await screen.findByRole('link', { name: /광명시장 경기/ });
  expect(link).toHaveAttribute('aria-current', 'true');
  fireEvent.click(link);
  expect(screen.getByTestId('address')).toHaveTextContent(`/attractions/7/market?marketQuery=${encodeURIComponent('광명')}`);
});
