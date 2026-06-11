import { useCallback, useState } from 'react';
import {
  getRefreshToken,
  getUserId,
  isLoggedIn as isLoggedInRaw,
  login as storeLogin,
  logout as clearAuth,
} from './auth';
import { logoutApi } from '../api/shopApi';

/**
 * useAuth — 로그인 상태를 React state 로 노출하는 얇은 훅.
 *
 * 토큰 보관은 src/auth/auth.ts(localStorage), 서버 세션 무효화는 shopApi.logoutApi.
 */
export function useAuth() {
  const [loggedIn, setLoggedIn] = useState<boolean>(isLoggedInRaw());

  const login = useCallback((accessToken: string, refreshToken: string, memberId: string | number) => {
    storeLogin(accessToken, refreshToken, memberId);
    setLoggedIn(true);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch {
        // 서버 로그아웃 실패해도 로컬 토큰은 제거
      }
    }
    clearAuth();
    setLoggedIn(false);
  }, []);

  return { isLoggedIn: loggedIn, userId: getUserId(), login, logout };
}
