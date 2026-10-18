import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { fetchMarket, fetchMarketContentIds, type MarketResponse } from '../../../api/marketApi';
import MarketPanelPreview from '../MarketPanelPreview';

vi.mock('../../../api/marketApi', () => ({ fetchMarket: vi.fn(), fetchMarketContentIds: vi.fn() }));
vi.mock('../MarketNaverMap', () => ({ default: () => <div data-testid="preview-map" /> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const store = (id: number, membership: 'IN' | 'OUT' | 'UNKNOWN') => ({ id, membership } as MarketResponse['stores'][number]);
function mount(contentId: string, lang: 'ko' | 'en' = 'ko') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><MemoryRouter>
    <MarketPanelPreview contentId={contentId} attractionId="34447" lang={lang} /><p>끝</p></MemoryRouter></QueryClientProvider>);
}

describe('market preview in the place search panel', () => {
  it('shows the map preview and a market map link with the shop count for a market', async () => {
    vi.mocked(fetchMarketContentIds).mockResolvedValue(['990539']);
    vi.mocked(fetchMarket).mockResolvedValue({ market: { name: '경주 중앙시장' }, zones: [], stores: [store(1, 'IN'), store(2, 'UNKNOWN'), store(3, 'OUT')] } as unknown as MarketResponse);
    mount('990539');
    expect(await screen.findByRole('link', { name: '시장 지도 보기 · 가게 2곳' })).toHaveAttribute('href', '/attractions/34447/market');
    expect(screen.getByTestId('preview-map')).toBeInTheDocument();
    expect(fetchMarket).toHaveBeenCalledWith('990539', false, 'ko');
  });
  it('renders nothing and never requests market data for a non-market attraction', async () => {
    vi.mocked(fetchMarketContentIds).mockResolvedValue(['990539']);
    mount('12345');
    await waitFor(() => expect(fetchMarketContentIds).toHaveBeenCalled());
    await screen.findByText('끝');
    expect(screen.queryByRole('region')).toBeNull();
    expect(fetchMarket).not.toHaveBeenCalled();
  });
});
