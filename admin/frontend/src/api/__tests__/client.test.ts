import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '@/api/client';

/** apiClient 의 전송만 바꿔 끼운다 — 인터셉터는 실제 것이 돈다 */
function respondWith(statuses: number[]) {
  const seen: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = async (config) => {
    seen.push(config);
    const status = statuses[seen.length - 1];
    const response = { status, statusText: '', headers: {}, config, data: { ok: true } };
    if (status >= 400) throw new AxiosError('fail', undefined, config, undefined, response);
    return response;
  };
  return seen;
}

describe('apiClient 인증', () => {
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    document.cookie = 'portal_user_id=42; path=/';
  });
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    document.cookie = 'portal_user_id=; path=/; max-age=0';
    vi.restoreAllMocks();
  });

  it('토큰 헤더를 만들지 않는다 — 세션은 HttpOnly 쿠키가 싣는다', async () => {
    const seen = respondWith([200]);

    await apiClient.get('/api/v1/anything');

    expect(seen[0].headers.Authorization).toBeUndefined();
  });

  it('401 이면 한 번 재발급하고 같은 요청을 다시 보낸다', async () => {
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { success: true } });
    const seen = respondWith([401, 200]);

    const res = await apiClient.get('/api/v1/anything');

    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledWith('/api/auth/refresh');
    expect(seen).toHaveLength(2);
  });

  it('재발급이 실패하면 다시 보내지 않고 거절한다', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { success: false } });
    const seen = respondWith([401, 200]);

    await expect(apiClient.get('/api/v1/anything')).rejects.toBeInstanceOf(AxiosError);
    expect(seen).toHaveLength(1);
  });
});
