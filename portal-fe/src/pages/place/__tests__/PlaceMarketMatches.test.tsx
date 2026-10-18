import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { searchMarkets, type MarketSearchResult } from '../../../api/marketApi';
import PlaceMarketMatches from '../PlaceMarketMatches';

vi.mock('../../../api/marketApi', () => ({ searchMarkets: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const market = (contentId: string, name: string, attraction: { id: number; lang: 'ko' | 'en' } | null) => ({ contentId, name, region: '경북 경주', marketType: 'STREET', storeCount: 765, attraction });
const result = (markets: MarketSearchResult['markets']): MarketSearchResult => ({ query: '', markets, stores: { items: [], total: 0, page: 0, size: 5 } });
function mount(keyword: string, lang: 'ko' | 'en' = 'ko') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><MemoryRouter>
    <PlaceMarketMatches keyword={keyword} lang={lang} /><p>끝</p></MemoryRouter></QueryClientProvider>);
}

describe('markets above place search results', () => {
  it('lists name-matched markets nationwide with links to their market maps', async () => {
    vi.mocked(searchMarkets).mockResolvedValue(result([market('990539', '경주 중앙시장', { id: 34447, lang: 'ko' }), market('1', '시장 행 없음', null)]));
    mount('경주 중앙시장');
    expect(await screen.findByRole('navigation', { name: '찾은 시장' })).toHaveTextContent('시장 1곳');
    expect(screen.getByRole('link', { name: /경주 중앙시장/ })).toHaveAttribute('href', '/attractions/34447/market');
    expect(screen.getByText('경북 경주 · 가게 765곳')).toBeInTheDocument();
    expect(searchMarkets).toHaveBeenCalledWith('경주 중앙시장', 'ko', 0, 5);
  });
  it('shows nothing when no market name matches', async () => {
    vi.mocked(searchMarkets).mockResolvedValue(result([]));
    mount('경복궁');
    await waitFor(() => expect(searchMarkets).toHaveBeenCalled()); await screen.findByText('끝');
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
