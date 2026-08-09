import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { TOKEN_KEY } from '@/api/client';

/** 서명은 검증하지 않으므로(게이트웨이 몫) payload 만 맞으면 된다. */
function makeToken(roles: string[], secondsFromNow: number): string {
  const payload = {
    userId: '42',
    roles,
    type: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + secondsFromNow,
  };
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe('useAuth', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it('토큰이 없으면 미인증이다 — 우회 경로가 남아 있지 않다', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('ROLE_ADMIN 토큰이면 관리자로 인증된다', () => {
    localStorage.setItem(TOKEN_KEY, makeToken(['ROLE_USER', 'ROLE_ADMIN'], 3600));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.user?.userId).toBe('42');
  });

  it('ROLE_ADMIN 이 없으면 인증은 되지만 관리자는 아니다', () => {
    localStorage.setItem(TOKEN_KEY, makeToken(['ROLE_USER'], 3600));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('만료된 토큰은 폐기하고 미인증으로 되돌린다', () => {
    localStorage.setItem(TOKEN_KEY, makeToken(['ROLE_ADMIN'], -10));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('형식이 깨진 토큰도 미인증으로 처리한다', () => {
    localStorage.setItem(TOKEN_KEY, 'not-a-jwt');

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('login 은 토큰을 저장하고 logout 은 완전히 비운다', () => {
    const { result } = renderHook(() => useAuth());

    act(() => result.current.login(makeToken(['ROLE_ADMIN'], 3600)));
    expect(result.current.isAdmin).toBe(true);
    expect(localStorage.getItem(TOKEN_KEY)).not.toBeNull();

    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('개발용 토큰은 DEV 에서만 쓰이고 운영 빌드에서는 무시된다', async () => {
    const devToken = makeToken(['ROLE_ADMIN'], 3600);
    vi.stubEnv('VITE_DEV_ADMIN_TOKEN', devToken);

    vi.stubEnv('PROD', true);
    vi.stubEnv('DEV', false);
    const prod = renderHook(() => useAuth());
    expect(prod.result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();

    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);
    const dev = renderHook(() => useAuth());
    expect(dev.result.current.isAdmin).toBe(true);
  });
});
