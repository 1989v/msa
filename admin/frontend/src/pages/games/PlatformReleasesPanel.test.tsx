import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PlatformReleasesPanel, { normalizeRobloxPlaceId } from './PlatformReleasesPanel';
import { fetchPlatformReleases, putPlatformRelease } from '../../api/games';
vi.mock('../../api/games', () => ({ fetchPlatformReleases: vi.fn(), putPlatformRelease: vi.fn() }));
const initial = { platform: 'ROBLOX' as const, platformRef: '123', releaseStatus: 'BETA' as const, audience: 'PUBLIC' as const, url: 'https://www.roblox.com/games/123', visible: true };
const renderPanel = (playable = true) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PlatformReleasesPanel slug="alpha" playable={playable} /></QueryClientProvider>);
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchPlatformReleases).mockResolvedValue([]); vi.mocked(putPlatformRelease).mockResolvedValue(initial); });
describe('Roblox input', () => {
  it('preserves large IDs and accepts real game slug paths', () => {
    expect(normalizeRobloxPlaceId('12345678901234567890')).toBe('12345678901234567890');
    expect(normalizeRobloxPlaceId('https://www.roblox.com/games/123/My-Game')).toBe('123');
    expect(normalizeRobloxPlaceId('')).toBeNull();
  });
  it('rejects non-game URLs and credentials or tracking', () => {
    ['0', '01', 'http://www.roblox.com/games/123', 'https://www.roblox.com.evil.test/games/123', 'https://user@www.roblox.com/games/123', 'https://www.roblox.com/games/123?token=secret', 'https://www.roblox.com/games/123#token', 'https://create.roblox.com/dashboard', 'https://www.roblox.com/share?code=secret'].forEach((input) => expect(() => normalizeRobloxPlaceId(input)).toThrow());
  });
});
describe('platform edition management', () => {
  it('saves a canonical public beta separately from the web game', async () => {
    const user = userEvent.setup(); renderPanel();
    await user.type(await screen.findByLabelText('게임 주소 / 시작 Place ID'), 'https://www.roblox.com/games/123/My-Game');
    await user.selectOptions(screen.getByLabelText('출시 상태'), 'BETA');
    await user.selectOptions(screen.getByLabelText('접근 범위'), 'PUBLIC');
    expect(screen.getByText('일반 방문자에게 표시됨')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '플랫폼 버전 저장' }));
    await waitFor(() => expect(putPlatformRelease).toHaveBeenCalledWith('alpha', { platformRef: '123', releaseStatus: 'BETA', audience: 'PUBLIC' }));
  });
  it('can clear the ID in a draft and blocks an empty launched release', async () => {
    vi.mocked(fetchPlatformReleases).mockResolvedValue([initial]);
    const user = userEvent.setup(); renderPanel();
    await user.clear(await screen.findByLabelText('게임 주소 / 시작 Place ID'));
    expect(screen.getByRole('button', { name: '플랫폼 버전 저장' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('출시 상태'), 'DRAFT');
    await user.click(screen.getByRole('button', { name: '플랫폼 버전 저장' }));
    await waitFor(() => expect(putPlatformRelease).toHaveBeenCalledWith('alpha', { platformRef: null, releaseStatus: 'DRAFT', audience: 'PUBLIC' }));
  });
  it('keeps a non-playable parent hidden and reports save failures', async () => {
    vi.mocked(fetchPlatformReleases).mockResolvedValue([initial]);
    vi.mocked(putPlatformRelease).mockRejectedValue(new Error('failed'));
    const user = userEvent.setup(); renderPanel(false);
    await screen.findByLabelText('게임 주소 / 시작 Place ID');
    expect(screen.getByText('일반 방문자에게 표시되지 않음')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '플랫폼 버전 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장에 실패');
  });
});
