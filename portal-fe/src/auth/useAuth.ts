import { useCallback, useState } from 'react';
import { clearLocalSession, getUserId, isLoggedIn as isLoggedInRaw } from './auth';
import { resetRefreshCooldown } from './refresh';
import { logoutApi } from '../api/shopApi';

/**
 * useAuth — 로그인 상태를 React state 로 노출하는 얇은 훅.
 *
 * 토큰은 서버가 HttpOnly 쿠키로 들고 있다(ADR-0101). 로그인은 응답이 쿠키를 걸고 나면 끝이고,
 * 로그아웃은 서버가 쿠키를 지운다 — JS 는 표시 쿠키와 옛 흔적만 정리한다.
 */
export function useAuth() {
  const [loggedIn, setLoggedIn] = useState<boolean>(isLoggedInRaw());

  /** 로그인 응답이 쿠키를 건 뒤 부른다 */
  const login = useCallback(() => {
    resetRefreshCooldown();
    setLoggedIn(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // 서버 로그아웃이 실패해도 이 화면의 흔적은 지운다
    }
    clearLocalSession();
    setLoggedIn(false);
  }, []);

  return { isLoggedIn: loggedIn, userId: getUserId(), login, logout };
}
