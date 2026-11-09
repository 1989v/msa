import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameEditDialog } from '../GamesPage';
import * as api from '@/api/games';

vi.mock('@/api/games', async () => ({
  ...await vi.importActual<typeof api>('@/api/games'),
  fetchAdminGame: vi.fn(), fetchGameTags: vi.fn(), fetchPlatformReleases: vi.fn(), fetchAdminGames: vi.fn(), fetchCollections: vi.fn(),
  updateGameMetadata: vi.fn(), updateGameTags: vi.fn(), putPlatformRelease: vi.fn(), updateCollection: vi.fn(),
}));
afterEach(cleanup);
it('keeps real collection controls independent from the unified game form', async () => {
  const game: api.AdminGameDetail = { id: 1, slug: 'alpha', title: 'Alpha', titleEn: '', description: '', descriptionEn: '', thumbnailUrl: '/a.png', genre: 'ARCADE', status: 'PUBLISHED', tags: [], entryUrl: '/alpha', coverUrl: null, engineType: 'HTML5', loadType: 'IFRAME', orientation: 'LANDSCAPE', supportsMobile: true, developerName: 'dev', sdkIntegrated: false, releasedAt: null, contentUpdatedAt: null, playCount: 0, ratingAvg: 0, ratingCount: 0 };
  const collection: api.AdminCollection = { slug: 'featured', title: '추천', type: 'MANUAL', tagSlug: null, displayOrder: 0, active: true, gameIds: [] };
  vi.mocked(api.fetchAdminGame).mockResolvedValue(game);
  vi.mocked(api.fetchGameTags).mockResolvedValue([]);
  vi.mocked(api.fetchPlatformReleases).mockResolvedValue([]);
  vi.mocked(api.fetchAdminGames).mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 200 });
  vi.mocked(api.fetchCollections).mockResolvedValue([collection]);
  vi.mocked(api.updateCollection).mockResolvedValue({ ...collection, title: '추천 수정' });
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GameEditDialog slug="alpha" onClose={vi.fn()} /></QueryClientProvider>);
  await user.type(await screen.findByLabelText('제목 (ko)'), ' edited');
  await screen.findByLabelText('게임 주소 / 시작 Place ID');
  await user.click(await screen.findByRole('button', { name: '추천 featured' }));
  const title = screen.getByLabelText('제목', { exact: true });
  await user.type(title, ' 수정');
  expect(title.closest('form')).toBeNull();
  const collectionSave = screen.getAllByRole('button', { name: /^저장$/ }).find((button) => !button.hasAttribute('form'))!;
  await user.click(collectionSave);
  await waitFor(() => expect(api.updateCollection).toHaveBeenCalledWith('featured', { title: '추천 수정', displayOrder: 0, gameIds: [] }));
  expect(api.updateGameMetadata).not.toHaveBeenCalled();
  expect(api.putPlatformRelease).not.toHaveBeenCalled();
  expect(screen.getByLabelText('제목 (ko)')).toHaveValue('Alpha edited');
});
