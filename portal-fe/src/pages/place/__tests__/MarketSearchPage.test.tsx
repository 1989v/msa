import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { searchMarkets, type MarketSearchResult } from '../../../api/marketApi';
import MarketSearchPage from '../MarketSearchPage';

vi.mock('../../../api/marketApi', () => ({ searchMarkets: vi.fn() }));
vi.mock('../../../components/Footer', () => ({ default: () => null }));
vi.mock('../../../hooks/useHeritageSurface', () => ({ useHeritageSurface: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const market = { contentId: '100', name: '광명시장', region: '경기 광명', marketType: 'STREET', storeCount: 153 };
const result: MarketSearchResult = { query: '', markets: [market], stores: { items: [], total: 0, page: 0, size: 20 } };
function Address() { const location = useLocation(); return <span data-testid="address">{location.pathname}{location.search}</span>; }
function mount(entry = '/markets') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><MemoryRouter initialEntries={[entry]}><MarketSearchPage /><Address /></MemoryRouter></QueryClientProvider>);
}

describe('market shop discovery', () => {
  it('lists markets and counts for an empty query with links to their market sections', async () => {
    vi.mocked(searchMarkets).mockResolvedValue(result);
    mount();
    expect(await screen.findByRole('link', { name: /광명시장/ })).toHaveAttribute('href', '/attractions/100#market');
    expect(screen.getByText(/153 가게/)).toBeInTheDocument();
    expect(searchMarkets).toHaveBeenCalledWith('', 'ko', 0);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://place.1989v.com/markets');
  });

  it.each(['/markets', '/en/markets'])('renders shops, goods, category and alley with encoded deep links on %s', async (entry) => {
    const q = '순대 & 국밥';
    vi.mocked(searchMarkets).mockResolvedValue({ ...result, stores: { ...result.stores, total: 1, items: [{ storeId: 1, name: '유명순대국', items: '순대', category: '음식점', marketContentId: '100', marketName: '광명시장', zoneName: '시장 골목', latitude: null, longitude: null }] } });
    mount(`${entry}?q=${encodeURIComponent(q)}`);
    const prefix = entry.startsWith('/en') ? '/en' : '';
    expect(await screen.findByRole('link', { name: /유명순대국/ })).toHaveAttribute('href', `${prefix}/attractions/100?marketQuery=${encodeURIComponent(q)}#market`);
    expect(screen.getByRole('link', { name: /광명시장 경기/ })).toHaveAttribute('href', `${prefix}/attractions/100?marketQuery=${encodeURIComponent(q)}#market`);
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
    expect(searchMarkets).toHaveBeenLastCalledWith('순대', 'ko', 0);
    expect(screen.getByTestId('address')).toHaveTextContent('/markets');
    expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '50');
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
    expect(searchMarkets).toHaveBeenLastCalledWith('국밥', 'ko', 1);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '순대' } });
    fireEvent.click(screen.getByRole('button', { name: '찾기' }));
    expect(searchMarkets).toHaveBeenLastCalledWith('순대', 'ko', 0);
  });
});
