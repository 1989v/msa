import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/gameProfileApi', () => ({ fetchGameProfile: vi.fn(), updateGameProfile: vi.fn() }));
vi.mock('../../auth/auth', () => ({ getUserId: vi.fn(() => null) }));
import { fetchGameProfile, updateGameProfile } from '../../api/gameProfileApi';
import { getUserId } from '../../auth/auth';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('server game profile ownership', () => {
  beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); vi.mocked(getUserId).mockReturnValue(null); });

  it('separates an unset profile from a failed server read, ignoring old nickname cache', async () => {
    localStorage.setItem('game_nickname', '임의이름');
    vi.mocked(fetchGameProfile).mockResolvedValue(null);
    const store = await import('../profileStore');
    const { result } = renderHook(() => store.useGameProfile());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.profile).toBeNull();
    vi.mocked(fetchGameProfile).mockRejectedValue(new Error('offline'));
    await act(() => store.refreshGameProfile());
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('offline');
  });

  it('discards a delayed guest response after switching to a member', async () => {
    const guest = deferred<{ playerId: string; nickname: string }>();
    vi.mocked(fetchGameProfile).mockReturnValueOnce(guest.promise).mockResolvedValueOnce(null);
    const store = await import('../profileStore');
    const { result } = renderHook(() => store.useGameProfile());
    vi.mocked(getUserId).mockReturnValue('42');
    await act(() => store.refreshGameProfile());
    await act(async () => guest.resolve({ playerId: 'guest-id', nickname: '게스트' }));
    expect(result.current.owner).toBe('member:42');
    expect(result.current.profile).toBeNull();
    expect(result.current.status).toBe('ready');
  });

  it('rejects a save response from the previous account without broadcasting it', async () => {
    vi.mocked(fetchGameProfile).mockResolvedValue(null);
    const update = deferred<{ playerId: string; nickname: string }>();
    vi.mocked(updateGameProfile).mockReturnValue(update.promise);
    const store = await import('../profileStore');
    await store.refreshGameProfile();
    const save = store.saveGameProfile('저장할이름');
    const rejection = expect(save).rejects.toThrow('계정이 변경');
    vi.mocked(getUserId).mockReturnValue('42');
    await store.refreshGameProfile();
    update.resolve({ playerId: 'guest-id', nickname: '저장할이름' });
    await rejection;
  });
  it('a cross-tab refresh supersedes an older same-owner read', async () => {
    const old = deferred<{ playerId: string; nickname: string }>();
    vi.mocked(fetchGameProfile).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ playerId: 'guest-id', nickname: '새이름' });
    const store = await import('../profileStore');
    const { result } = renderHook(() => store.useGameProfile());
    await act(() => store.refreshGameProfile(true));
    await act(async () => old.resolve({ playerId: 'guest-id', nickname: '이전이름' }));
    expect(result.current.profile?.nickname).toBe('새이름');
  });

  it('a focus refresh does not invalidate a same-owner save', async () => {
    vi.mocked(fetchGameProfile).mockResolvedValue(null);
    const update = deferred<{ playerId: string; nickname: string }>();
    vi.mocked(updateGameProfile).mockReturnValue(update.promise);
    const store = await import('../profileStore');
    await store.refreshGameProfile();
    const save = store.saveGameProfile('새이름');
    await store.refreshGameProfile(true);
    update.resolve({ playerId: 'guest-id', nickname: '새이름' });
    await expect(save).resolves.toEqual({ playerId: 'guest-id', nickname: '새이름' });
  });

  it('an older GET cannot overwrite a successful save, even when focus refreshes during it', async () => {
    vi.mocked(fetchGameProfile).mockResolvedValueOnce({ playerId: 'guest-id', nickname: '이전이름' });
    const store = await import('../profileStore');
    const { result } = renderHook(() => store.useGameProfile());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const oldRead = deferred<{ playerId: string; nickname: string }>();
    vi.mocked(fetchGameProfile).mockReturnValueOnce(oldRead.promise);
    let read!: Promise<void>;
    act(() => { read = store.refreshGameProfile(true); });
    const update = deferred<{ playerId: string; nickname: string }>();
    vi.mocked(updateGameProfile).mockReturnValueOnce(update.promise);
    let save!: ReturnType<typeof store.saveGameProfile>;
    act(() => { save = store.saveGameProfile('새이름'); });
    await act(() => store.refreshGameProfile(true));
    await act(async () => {
      update.resolve({ playerId: 'guest-id', nickname: '새이름' });
      await expect(save).resolves.toEqual({ playerId: 'guest-id', nickname: '새이름' });
      oldRead.resolve({ playerId: 'guest-id', nickname: '이전이름' });
      await read;
    });
    expect(fetchGameProfile).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
    expect(result.current.profile?.nickname).toBe('새이름');
  });

});
