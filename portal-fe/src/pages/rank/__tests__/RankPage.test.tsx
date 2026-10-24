import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RankPage from '../RankPage';
import * as api from '../../../api/rankingApi';
vi.mock('../../../api/rankingApi', () => ({ fetchGasAreas: vi.fn(), fetchRankingBoards: vi.fn(), fetchCafeBrands: vi.fn() }));
vi.mock('../../../components/ThemeToggle', () => ({ default: () => <span>테마</span> }));
vi.mock('../../../components/shell/AppInstallMenu', () => ({ default: () => null }));
vi.mock('../../../components/Footer', () => ({ default: () => <footer>출처 안내</footer> }));
vi.mock('../../../hooks/useHeritageSurface', () => ({ useHeritageSurface: () => {} }));
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><RankPage /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.mocked(api.fetchGasAreas).mockResolvedValue([]);
  vi.mocked(api.fetchRankingBoards).mockResolvedValue([]);
  vi.mocked(api.fetchCafeBrands).mockResolvedValue(['a', 'b', 'c'].map(brandSlug => ({ brandSlug, brandName: brandSlug, count: 1, checkedAt: '2026-10-24', sourceUrls: [] })));
});
it('shows the cafe comparison as a card with a drink image instead of an empty-service notice', async () => {
  setup();
  const card = await screen.findByRole('link', { name: /카페 성분 비교/ });
  expect(card.getAttribute('href')).toBe('/cafe');
  expect(card.querySelector('img')?.getAttribute('src')).toBe('/cafe/drinks/cafe-latte.webp');
  expect(await screen.findByText('카페 3곳')).toBeTruthy();
  expect(screen.queryByText(/준비 중/)).toBeNull();
  expect(screen.queryByLabelText(/지역/)).toBeNull();
});
