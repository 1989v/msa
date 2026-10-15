import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchMarketContentIds } from '../../../api/marketApi';
import MarketMapBadge from '../MarketMapBadge';
vi.mock('../../../api/marketApi', () => ({ fetchMarketContentIds: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><p>기존 관광지</p><MarketMapBadge contentId="100" lang="ko" /><MarketMapBadge contentId="200" lang="en" /><MarketMapBadge contentId="300" lang="ko" /></QueryClientProvider>);
  return client;
}
describe('market map badges', () => {
  it('uses one shared one-hour request and only marks returned content IDs', async () => {
    vi.mocked(fetchMarketContentIds).mockResolvedValue(['100', '200']);
    const client = mount();
    expect(await screen.findByText('시장 지도')).toBeInTheDocument();
    expect(await screen.findByText('Market map')).toBeInTheDocument();
    expect(screen.getAllByText('시장 지도')).toHaveLength(1);
    expect(fetchMarketContentIds).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().find({ queryKey: ['market-content-ids'] })?.options).toMatchObject({ staleTime: 3_600_000 });
  });
  it('degrades to ordinary attractions when the content ID endpoint fails', async () => {
    vi.mocked(fetchMarketContentIds).mockRejectedValue(new Error('offline'));
    const client = mount();
    await waitFor(() => expect(client.getQueryState(['market-content-ids'])?.status).toBe('error'));
    expect(screen.queryByText('시장 지도')).not.toBeInTheDocument();
    expect(screen.queryByText('Market map')).not.toBeInTheDocument();
    expect(screen.getByText('기존 관광지')).toBeInTheDocument();
  });
});
