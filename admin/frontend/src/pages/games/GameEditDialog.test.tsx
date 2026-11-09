import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameEditDialog } from '../GamesPage';
import * as api from '@/api/games';

vi.mock('@/api/games', async () => ({
  ...await vi.importActual<typeof api>('@/api/games'),
  fetchAdminGame: vi.fn(), fetchGameTags: vi.fn(), fetchPlatformReleases: vi.fn(),
  updateGameMetadata: vi.fn(), updateGameTags: vi.fn(), putPlatformRelease: vi.fn(),
}));
// Collection editing has its own API and existing regression suite.
vi.mock('./CollectionsPanel', () => ({ CollectionsPanel: () => <div>독립 컬렉션 편집</div> }));
const release: api.PlatformRelease = { platform: 'ROBLOX', platformRef: '123', releaseStatus: 'BETA', audience: 'PUBLIC', url: 'https://www.roblox.com/games/123', visible: true };
const detail: api.AdminGameDetail = {
  id: 1, slug: 'alpha', title: 'Alpha', titleEn: 'Alpha', description: '게임', descriptionEn: '',
  thumbnailUrl: '/alpha.png', genre: 'ARCADE', status: 'PUBLISHED', tags: ['arcade'], entryUrl: '/games/alpha',
  coverUrl: null, engineType: 'HTML5', loadType: 'IFRAME', orientation: 'LANDSCAPE', supportsMobile: true, developerName: 'dev', sdkIntegrated: false, releasedAt: null, contentUpdatedAt: null, playCount: 0, ratingAvg: 0, ratingCount: 0,
};
const close = vi.fn();
const saveButton = () => screen.getByRole('button', { name: /^저장$/ });
const open = async (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  render(<QueryClientProvider client={client}><GameEditDialog slug="alpha" onClose={close} /></QueryClientProvider>);
  await screen.findByLabelText('제목 (ko)');
};
const editPlatform = async () => {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('게임 주소 / 시작 Place ID'), 'https://www.roblox.com/games/123/My-Game');
  await user.selectOptions(screen.getByLabelText('출시 상태'), 'BETA');
  await user.selectOptions(screen.getByLabelText('접근 범위'), 'PUBLIC');
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.fetchAdminGame).mockResolvedValue(detail);
  vi.mocked(api.fetchGameTags).mockResolvedValue([{ slug: 'arcade', name: '아케이드' }, { slug: 'new', name: '새 태그' }]);
  vi.mocked(api.fetchPlatformReleases).mockResolvedValue([]);
  vi.mocked(api.updateGameMetadata).mockResolvedValue(detail);
  vi.mocked(api.updateGameTags).mockResolvedValue(detail);
  vi.mocked(api.putPlatformRelease).mockResolvedValue(release);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('unified game save', () => {
  it('saves changed metadata, tags and normalized platform once and shows server state', async () => {
    const user = userEvent.setup(); await open();
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByRole('button', { name: '플랫폼 버전 저장' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited');
    await user.click(screen.getByLabelText('새 태그'));
    await editPlatform();
    expect(screen.getByText('저장된 공개 상태: 일반 방문자에게 표시되지 않음')).toBeInTheDocument();
    expect(screen.getByText('입력 미리보기 (아직 저장되지 않음): 공개 예정')).toBeInTheDocument();
    await user.click(saveButton());
    await screen.findByText('변경사항을 저장했습니다.');
    expect(api.updateGameMetadata).toHaveBeenCalledWith('alpha', expect.objectContaining({ title: 'Alpha edited' }));
    expect(api.updateGameTags).toHaveBeenCalledWith('alpha', ['arcade', 'new']);
    expect(api.putPlatformRelease).toHaveBeenCalledWith('alpha', { platformRef: '123', releaseStatus: 'BETA', audience: 'PUBLIC' });
    expect(screen.getByText('저장된 공개 상태: 일반 방문자에게 표시됨')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    expect(saveButton()).toBeDisabled();
  });

  it('keeps all input and actual visibility after platform failure, retrying only failed section', async () => {
    vi.mocked(api.putPlatformRelease).mockRejectedValueOnce(new Error('failed')).mockResolvedValue(release);
    const user = userEvent.setup(); await open();
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited'); await editPlatform();
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Roblox 플랫폼 버전 저장에 실패');
    expect(screen.getByLabelText('제목 (ko)')).toHaveValue('Alpha edited');
    expect(screen.getByLabelText('게임 주소 / 시작 Place ID')).toHaveValue('https://www.roblox.com/games/123/My-Game');
    expect(screen.getByText('저장된 공개 상태: 일반 방문자에게 표시되지 않음')).toBeInTheDocument();
    await user.click(saveButton()); await screen.findByText('변경사항을 저장했습니다.');
    expect(api.updateGameMetadata).toHaveBeenCalledTimes(1);
    expect(api.putPlatformRelease).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();
  });

  it('retries only metadata when platform and tags already saved', async () => {
    vi.mocked(api.updateGameMetadata).mockRejectedValueOnce(new Error('failed')).mockResolvedValue(detail);
    const user = userEvent.setup(); await open();
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited');
    await user.click(screen.getByLabelText('새 태그')); await editPlatform();
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('기본 정보 저장에 실패');
    expect(screen.getByText('저장된 공개 상태: 일반 방문자에게 표시됨')).toBeInTheDocument();
    await user.click(saveButton()); await screen.findByText('변경사항을 저장했습니다.');
    expect(api.updateGameMetadata).toHaveBeenCalledTimes(2);
    expect(api.putPlatformRelease).toHaveBeenCalledTimes(1);
    expect(api.updateGameTags).toHaveBeenCalledTimes(1);
  });

  it('retries failed tags without resending successful metadata or platform', async () => {
    vi.mocked(api.updateGameTags).mockRejectedValueOnce(new Error('failed')).mockResolvedValue(detail);
    const user = userEvent.setup(); await open();
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited');
    await user.click(screen.getByLabelText('새 태그')); await editPlatform();
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('태그 저장에 실패');
    expect(screen.getByLabelText('새 태그')).toBeChecked();
    await user.click(saveButton()); await screen.findByText('변경사항을 저장했습니다.');
    expect(api.updateGameMetadata).toHaveBeenCalledTimes(1);
    expect(api.putPlatformRelease).toHaveBeenCalledTimes(1);
    expect(api.updateGameTags).toHaveBeenCalledTimes(2);
  });

  it('does not let an older in-flight GET replace the successful platform snapshot', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup(); await open(client); await editPlatform();
    let staleGet!: (value: api.PlatformRelease[]) => void;
    vi.mocked(api.fetchPlatformReleases).mockReturnValueOnce(new Promise((resolve) => { staleGet = resolve; }));
    void client.invalidateQueries({ queryKey: ['admin-game-platform-releases', 'alpha'] });
    await waitFor(() => expect(api.fetchPlatformReleases).toHaveBeenCalledTimes(2));
    await user.click(saveButton()); await screen.findByText('변경사항을 저장했습니다.');
    await act(async () => { staleGet([]); });
    await waitFor(() => expect(client.getQueryData(['admin-game-platform-releases', 'alpha'])).toEqual([release]));
    expect(screen.getByText('저장된 공개 상태: 일반 방문자에게 표시됨')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(api.putPlatformRelease).toHaveBeenCalledTimes(1);
  });

  it('does not create an untouched blank platform release', async () => {
    const user = userEvent.setup(); await open();
    await screen.findByLabelText('게임 주소 / 시작 Place ID');
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited');
    await user.click(saveButton()); await screen.findByText('변경사항을 저장했습니다.');
    expect(api.putPlatformRelease).not.toHaveBeenCalled();
    expect(api.updateGameTags).not.toHaveBeenCalled();
  });

  it('blocks invalid and empty launched platform input without saving metadata', async () => {
    const user = userEvent.setup(); await open();
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited');
    await user.selectOptions(await screen.findByLabelText('출시 상태'), 'BETA');
    expect(saveButton()).toBeDisabled();
    await user.type(screen.getByLabelText('게임 주소 / 시작 Place ID'), 'https://www.roblox.com/games/123?token=secret');
    expect(saveButton()).toBeDisabled();
    fireEvent.submit(document.getElementById('game-edit-form')!);
    expect(api.updateGameMetadata).not.toHaveBeenCalled();
    expect(api.putPlatformRelease).not.toHaveBeenCalled();
  });

  it('can clear a published platform ID only after switching to draft', async () => {
    vi.mocked(api.fetchPlatformReleases).mockResolvedValue([release]);
    vi.mocked(api.putPlatformRelease).mockResolvedValue({ ...release, platformRef: null, releaseStatus: 'DRAFT', url: null, visible: false });
    const user = userEvent.setup(); await open();
    await user.clear(await screen.findByLabelText('게임 주소 / 시작 Place ID'));
    expect(saveButton()).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('출시 상태'), 'DRAFT');
    await user.click(saveButton()); await screen.findByText('변경사항을 저장했습니다.');
    expect(api.putPlatformRelease).toHaveBeenCalledWith('alpha', { platformRef: null, releaseStatus: 'DRAFT', audience: 'PUBLIC' });
  });

  it('keeps saved public status separate from a hidden draft preview', async () => {
    vi.mocked(api.fetchPlatformReleases).mockResolvedValue([release]);
    const user = userEvent.setup(); await open();
    await user.selectOptions(await screen.findByLabelText('접근 범위'), 'INVITE_ONLY');
    expect(screen.getByText('저장된 공개 상태: 일반 방문자에게 표시됨')).toBeInTheDocument();
    expect(screen.getByText('입력 미리보기 (아직 저장되지 않음): 비공개')).toBeInTheDocument();
  });

  it('blocks complete save during load or error, retries loading without losing metadata', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(api.fetchPlatformReleases).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const user = userEvent.setup(); await open();
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited');
    expect(screen.getByText('플랫폼 버전 불러오는 중...')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    reject(new Error('offline'));
    await screen.findByRole('alert');
    expect(saveButton()).toBeDisabled();
    expect(api.updateGameMetadata).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await screen.findByLabelText('게임 주소 / 시작 Place ID');
    expect(screen.getByLabelText('제목 (ko)')).toHaveValue('Alpha edited');
    expect(saveButton()).toBeEnabled();
  });

  it('confirms dirty X, Escape, backdrop and footer close, but not clean close', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup(); await open();
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0]);
    expect(close).toHaveBeenCalledTimes(1); expect(confirm).not.toHaveBeenCalled(); close.mockClear();
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited');
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]);
    await user.keyboard('{Escape}');
    fireEvent.click(dialog.previousElementSibling!);
    await user.click(within(dialog).getAllByRole('button', { name: '닫기' })[1]);
    expect(confirm).toHaveBeenCalledTimes(4); expect(close).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); await user.keyboard('{Escape}'); expect(close).toHaveBeenCalledTimes(1);
  });

  it('handles Escape when opening leaves focus on the outside trigger', async () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const user = userEvent.setup();
    try {
      await open();
      expect(document.activeElement).toBe(trigger);
      await user.keyboard('{Escape}');
      expect(close).toHaveBeenCalledTimes(1);
    } finally { trigger.remove(); }
  });

  it('blocks input, duplicate submit and all close paths while saving', async () => {
    let finish!: (value: api.AdminGameDetail) => void;
    vi.mocked(api.updateGameMetadata).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup(); await open(); await screen.findByLabelText('게임 주소 / 시작 Place ID');
    await user.type(screen.getByLabelText('제목 (ko)'), ' edited'); await user.click(saveButton());
    await waitFor(() => expect(api.updateGameMetadata).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('제목 (ko)')).toBeDisabled();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]);
    await user.keyboard('{Escape}'); fireEvent.click(dialog.previousElementSibling!);
    fireEvent.submit(document.getElementById('game-edit-form')!);
    expect(api.updateGameMetadata).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
    finish(detail); await screen.findByText('변경사항을 저장했습니다.');
  });
});
