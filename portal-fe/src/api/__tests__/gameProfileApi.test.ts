import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalSession, getUserId, notifyAuthChanged } from '../../auth/auth';
import { resetRefreshCooldown } from '../../auth/refresh';
import { gameHttp } from '../gameApi';
import { fetchGameProfile, updateGameProfile } from '../gameProfileApi';

const originalAdapter = gameHttp.defaults.adapter;
function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('unauthorized', 'ERR_BAD_REQUEST', config, null, {
    status: 401, statusText: 'Unauthorized', data: null, headers: {}, config,
  } as AxiosResponse);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// HttpOnly tokens are server-owned; only the non-secret member marker is visible.
function signIn(memberId: string) {
  document.cookie = `portal_user_id=${memberId}; Path=/`;
  notifyAuthChanged();
}
beforeEach(() => { signIn('member-a'); resetRefreshCooldown(); });
afterEach(() => { gameHttp.defaults.adapter = originalAdapter; clearLocalSession(); vi.restoreAllMocks(); });

describe('game profile auth retries through the real shared client', () => {
  it('never retries account A nickname PUT as account B after a delayed 401', async () => {
    const started = deferred<InternalAxiosRequestConfig>();
    const failed = deferred<void>();
    const sent: string[] = [];
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { success: true, data: null },
    });
    gameHttp.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBeUndefined();
      sent.push(getUserId()!);
      started.resolve(config);
      await failed.promise;
      throw unauthorized(config);
    };
    const put = updateGameProfile('Account A nickname');
    const rejection = expect(put).rejects.toMatchObject({ response: { status: 401 } });
    const initial = await started.promise;
    expect(JSON.parse(initial.data)).toEqual({ nickname: 'Account A nickname' });
    signIn('member-b');
    failed.resolve();
    await rejection;
    expect(sent).toEqual(['member-a']);
    expect(refresh).not.toHaveBeenCalled();
    expect(getUserId()).toBe('member-b');
  });

  it('leaves read-only profile refresh retries enabled', async () => {
    const sent: string[] = [];
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { success: true, data: null },
    });
    gameHttp.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBeUndefined();
      sent.push(getUserId()!);
      if (sent.length === 1) throw unauthorized(config);
      return { status: 200, statusText: 'OK', headers: {}, config, data: { success: true, data: null } };
    };
    await expect(fetchGameProfile()).resolves.toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(['member-a', 'member-a']);
  });
});


describe('expired nickname mutation recovery', () => {
  it('refreshes the same session but requires another explicit PUT', async () => {
    let fresh = false;
    const sent: string[] = [];
    const refresh = vi.spyOn(axios, 'post').mockImplementation(async () => {
      fresh = true;
      return { data: { success: true, data: null } };
    });
    gameHttp.defaults.adapter = async (config) => {
      sent.push(getUserId()!);
      if (!fresh) throw unauthorized(config);
      return { status: 200, statusText: 'OK', headers: {}, config, data: {
        success: true, data: { playerId: 'player-a', nickname: 'Alice' },
      } };
    };
    await expect(updateGameProfile('Alice')).rejects.toThrow('다시 저장');
    expect(sent).toEqual(['member-a']);
    expect(refresh).toHaveBeenCalledTimes(1);
    await expect(updateGameProfile('Alice')).resolves.toMatchObject({ nickname: 'Alice' });
    expect(sent).toEqual(['member-a', 'member-a']);
  });

  it('does not replay or accept a session changed during credential refresh', async () => {
    const started = deferred<void>();
    const finish = deferred<void>();
    let puts = 0;
    vi.spyOn(axios, 'post').mockImplementation(async () => {
      started.resolve();
      await finish.promise;
      return { data: { success: true, data: null } };
    });
    gameHttp.defaults.adapter = async (config) => { puts++; throw unauthorized(config); };
    const put = updateGameProfile('Alice');
    const rejection = expect(put).rejects.toThrow('계정이 변경');
    await started.promise;
    signIn('member-b');
    finish.resolve();
    await rejection;
    expect(puts).toBe(1);
  });
});
