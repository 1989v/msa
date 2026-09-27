import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { apiClient, LOGIN_PATH } from '@/api/client';
import { endSession, getSessionUserId } from '@/lib/session';

/**
 * - `checking`: 역할 조회 중
 * - `admin`: ROLE_ADMIN
 * - `forbidden`: 로그인했지만 관리자가 아니다
 * - `anonymous`: 세션이 없거나 만료됐다
 * - `error`: 조회가 네트워크·서버 오류로 실패했다 — 로그인 화면으로 보내지 않는다
 */
export type AuthStatus = 'checking' | 'admin' | 'forbidden' | 'anonymous' | 'error';

/**
 * 관리자 여부는 서버에 묻는다 — 토큰이 HttpOnly 라 역할을 JS 에서 볼 수 없다(ADR-0101).
 * `/api/auth/roles/{id}` 는 게이트웨이가 ROLE_ADMIN 만 통과시키므로 200 이 곧 관리자다.
 */
async function fetchStatus(userId: string | null): Promise<AuthStatus> {
  if (!userId) return 'anonymous';
  try {
    await apiClient.get(`/api/auth/roles/${userId}`);
    return 'admin';
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (status === 403) return 'forbidden';
    if (status === 401) return 'anonymous';
    throw e;
  }
}

export function useAuth() {
  const userId = getSessionUserId();
  const query = useQuery({
    queryKey: ['auth-status', userId],
    queryFn: () => fetchStatus(userId),
    retry: false,
    staleTime: Infinity,
  });

  const status: AuthStatus = query.isPending ? 'checking' : query.isError ? 'error' : query.data;

  const logout = useCallback(async () => {
    await endSession();
    window.location.href = LOGIN_PATH;
  }, []);

  return { status, userId, logout };
}
