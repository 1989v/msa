import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachRefreshRetry, refreshAccessToken } from '../refresh';

const ACCESS = 'portal_access_token';
const REFRESH = 'portal_refresh_token';

function setCookie(name: string, value: string | null) {
  document.cookie = value ? `${name}=${value}; Path=/` : `${name}=; Path=/; Max-Age=0`;
}

function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('unauthorized', 'ERR_BAD_REQUEST', config, null, {
    status: 401,
    statusText: 'Unauthorized',
    data: null,
    headers: {},
    config,
  } as AxiosResponse);
}

function ok(config: InternalAxiosRequestConfig): AxiosResponse {
  return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
}

/** 첫 호출은 401, 재시도는 성공 — 만료된 액세스 토큰의 실제 모양 */
function expiredThenValid() {
  const sentTokens: (string | undefined)[] = [];
  const instance = axios.create();
  instance.interceptors.request.use((config) => {
    const token = readCookie(ACCESS);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  instance.defaults.adapter = async (config) => {
    sentTokens.push(config.headers.Authorization as string | undefined);
    if (readCookie(ACCESS) === 'expired') throw unauthorized(config as InternalAxiosRequestConfig);
    return ok(config as InternalAxiosRequestConfig);
  };
  attachRefreshRetry(instance);
  return { instance, sentTokens };
}

/** 테스트마다 다른 리프레시 토큰 — 실패 쿨다운이 토큰별이라 값이 겹치면 서로 간섭한다 */
let seq = 0;
let refreshToken = '';

beforeEach(() => {
  refreshToken = `refresh-${++seq}`;
  setCookie(ACCESS, 'expired');
  setCookie(REFRESH, refreshToken);
  vi.restoreAllMocks();
});

afterEach(() => {
  setCookie(ACCESS, null);
  setCookie(REFRESH, null);
});

describe('attachRefreshRetry', () => {
  it('401 이면 토큰을 재발급하고 원 요청을 새 토큰으로 재시도한다', async () => {
    vi.spyOn(axios, 'post').mockImplementation(async () => {
      setCookie(ACCESS, 'fresh');
      return { data: { success: true, data: { accessToken: 'fresh', refreshToken: 'refresh-2' } } };
    });

    const { instance, sentTokens } = expiredThenValid();
    const res = await instance.get('/api/v1/wishlist?type=GAME');

    expect(res.data).toEqual({ ok: true });
    expect(sentTokens).toEqual(['Bearer expired', 'Bearer fresh']);
  });

  it('재발급은 동시 401 을 하나로 합친다 — 리프레시 토큰이 회전하므로 두 번 부르면 뒤가 죽는다', async () => {
    const post = vi.spyOn(axios, 'post').mockImplementation(async () => {
      setCookie(ACCESS, 'fresh');
      return { data: { success: true, data: { accessToken: 'fresh', refreshToken: 'refresh-2' } } };
    });

    const { instance } = expiredThenValid();
    await Promise.all([instance.get('/api/v1/wishlist'), instance.get('/api/v1/wishlist/keys?type=GAME')]);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('재발급이 실패하면 거절하되 세션 쿠키는 지우지 않는다 — 일시적 오류가 세션을 날리면 안 된다', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('network down'));

    const { instance } = expiredThenValid();
    await expect(instance.get('/api/v1/wishlist')).rejects.toThrow();
    expect(readCookie(REFRESH)).toBe(refreshToken);
  });

  it('실패한 토큰으로는 곧바로 다시 두드리지 않는다 — 죽은 세션이 위젯 수만큼 auth 를 때리면 안 된다', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValue(new Error('network down'));

    const { instance } = expiredThenValid();
    await expect(instance.get('/api/v1/wishlist')).rejects.toThrow();
    await expect(instance.get('/api/v1/wishlist/keys?type=GAME')).rejects.toThrow();
    await expect(instance.get('/api/v1/wishlist/collections')).rejects.toThrow();

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('다시 로그인해 토큰이 바뀌면 쿨다운이 즉시 풀린다', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('network down')).mockImplementation(async () => {
      setCookie(ACCESS, 'fresh');
      return { data: { success: true, data: { accessToken: 'fresh', refreshToken: 're-login-2' } } };
    });

    const { instance } = expiredThenValid();
    await expect(instance.get('/api/v1/wishlist')).rejects.toThrow();

    setCookie(REFRESH, 're-login-1'); // 재로그인 — 새 리프레시 토큰
    await expect(instance.get('/api/v1/wishlist')).resolves.toMatchObject({ data: { ok: true } });
  });
});

describe('refreshAccessToken', () => {
  it('리프레시 토큰이 없으면 부르지 않는다', async () => {
    setCookie(REFRESH, null);
    const post = vi.spyOn(axios, 'post');

    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
