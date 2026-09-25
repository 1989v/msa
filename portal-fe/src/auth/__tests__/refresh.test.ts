import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachRefreshRetry, refreshAccessToken, resetRefreshCooldown } from '../refresh';

/**
 * 토큰은 서버가 HttpOnly 쿠키로 든다(ADR-0101) — jsdom 은 HttpOnly 를 흉내내지 못하므로 서버 쪽 세션은
 * `serverSession` 변수로 둔다. JS 가 보는 것은 「로그인했다」 표시 쿠키뿐이다.
 */
const MARKER = 'portal_user_id';
let serverSession: 'expired' | 'fresh' = 'expired';

function setCookie(name: string, value: string | null) {
  document.cookie = value ? `${name}=${value}; Path=/` : `${name}=; Path=/; Max-Age=0`;
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

/** 첫 호출은 401, 갱신 뒤 재시도는 성공 — 만료된 세션의 실제 모양 */
function expiredThenValid() {
  const sentAuth: (string | undefined)[] = [];
  const instance = axios.create();
  instance.defaults.adapter = async (config) => {
    sentAuth.push(config.headers.Authorization as string | undefined);
    if (serverSession === 'expired') throw unauthorized(config as InternalAxiosRequestConfig);
    return ok(config as InternalAxiosRequestConfig);
  };
  attachRefreshRetry(instance);
  return { instance, sentAuth };
}

const refreshed = async () => {
  serverSession = 'fresh';
  return { data: { success: true, data: null, error: null } };
};

beforeEach(() => {
  serverSession = 'expired';
  setCookie(MARKER, '7');
  resetRefreshCooldown();
  vi.restoreAllMocks();
});

afterEach(() => {
  setCookie(MARKER, null);
});

describe('attachRefreshRetry', () => {
  it('401 이면 재발급하고 원 요청을 다시 보낸다 — 토큰은 헤더로 싣지 않는다(쿠키가 싣는다)', async () => {
    const post = vi.spyOn(axios, 'post').mockImplementation(refreshed);

    const { instance, sentAuth } = expiredThenValid();
    const res = await instance.get('/api/v1/wishlist?type=GAME');

    expect(res.data).toEqual({ ok: true });
    expect(sentAuth).toEqual([undefined, undefined]);
    // 본문 없이 부른다 — 리프레시 토큰은 쿠키로 실린다
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/refresh$/));
  });

  it('재발급은 동시 401 을 하나로 합친다 — 리프레시 토큰이 회전하므로 두 번 부르면 뒤가 죽는다', async () => {
    const post = vi.spyOn(axios, 'post').mockImplementation(refreshed);

    const { instance } = expiredThenValid();
    await Promise.all([instance.get('/api/v1/wishlist'), instance.get('/api/v1/wishlist/keys?type=GAME')]);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('재발급이 실패하면 거절하되 로그인 표시는 지우지 않는다 — 일시적 오류가 세션을 날리면 안 된다', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('network down'));

    const { instance } = expiredThenValid();
    await expect(instance.get('/api/v1/wishlist')).rejects.toThrow();
    expect(document.cookie).toContain(`${MARKER}=7`);
  });

  it('실패 직후에는 곧바로 다시 두드리지 않는다 — 죽은 세션이 위젯 수만큼 auth 를 때리면 안 된다', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValue(new Error('network down'));

    const { instance } = expiredThenValid();
    await expect(instance.get('/api/v1/wishlist')).rejects.toThrow();
    await expect(instance.get('/api/v1/wishlist/keys?type=GAME')).rejects.toThrow();
    await expect(instance.get('/api/v1/wishlist/collections')).rejects.toThrow();

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('다시 로그인하면 쿨다운이 즉시 풀린다', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('network down')).mockImplementation(refreshed);

    const { instance } = expiredThenValid();
    await expect(instance.get('/api/v1/wishlist')).rejects.toThrow();

    resetRefreshCooldown(); // 로그인 콜백이 부른다
    await expect(instance.get('/api/v1/wishlist')).resolves.toMatchObject({ data: { ok: true } });
  });
});

describe('refreshAccessToken', () => {
  it('로그인 표시가 없으면 부르지 않는다', async () => {
    setCookie(MARKER, null);
    const post = vi.spyOn(axios, 'post');

    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
