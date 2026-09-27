import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/api/client';

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', undefined, config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: null,
  });
}

function setUserCookie(value: string | null) {
  document.cookie = value
    ? `portal_user_id=${value}; path=/`
    : 'portal_user_id=; path=/; max-age=0';
}

function renderAuth() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

/** 서명은 검증하지 않으므로(게이트웨이 몫) payload 만 맞으면 된다. */
function makeToken(userId: string): string {
  return `header.${btoa(JSON.stringify({ userId, roles: ['ROLE_ADMIN'] }))}.signature`;
}

describe('useAuth', () => {
  beforeEach(() => setUserCookie(null));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('표시 쿠키가 없으면 역할을 묻지 않고 미인증이다', async () => {
    const get = vi.spyOn(apiClient, 'get');

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(get).not.toHaveBeenCalled();
  });

  it('역할 조회가 200 이면 관리자다 — 내 id 로 묻는다', async () => {
    setUserCookie('42');
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} });

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.status).toBe('admin'));
    expect(get).toHaveBeenCalledWith('/api/auth/roles/42');
    expect(result.current.userId).toBe('42');
  });

  it('403 이면 로그인했지만 관리자가 아니다', async () => {
    setUserCookie('42');
    vi.spyOn(apiClient, 'get').mockRejectedValue(httpError(403));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.status).toBe('forbidden'));
  });

  it('401 이면 세션이 끝난 것이다', async () => {
    setUserCookie('42');
    vi.spyOn(apiClient, 'get').mockRejectedValue(httpError(401));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
  });

  it('서버 오류는 로그인 화면으로 보내지 않고 오류로 둔다', async () => {
    setUserCookie('42');
    vi.spyOn(apiClient, 'get').mockRejectedValue(httpError(502));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('개발용 토큰은 DEV 에서만 쓰이고 운영 빌드에서는 무시된다', async () => {
    vi.stubEnv('VITE_DEV_ADMIN_TOKEN', makeToken('7'));
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} });

    vi.stubEnv('DEV', false);
    const prod = renderAuth();
    await waitFor(() => expect(prod.result.current.status).toBe('anonymous'));
    expect(get).not.toHaveBeenCalled();

    vi.stubEnv('DEV', true);
    const dev = renderAuth();
    await waitFor(() => expect(dev.result.current.status).toBe('admin'));
    expect(get).toHaveBeenCalledWith('/api/auth/roles/7');
  });
});
