/**
 * 통합 셸 인증 컨텍스트 (ADR-0058 R3 FE 통합).
 *
 * 기존 useAuth(localStorage 토큰 상태 훅)를 Context 로 승격 — 흡수될 sub-app 들이
 * prop drilling 없이 로그인 상태/login/logout 을 공유한다.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';

type AuthValue = ReturnType<typeof useAuth>;

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within <AuthProvider>');
  }
  return ctx;
}
