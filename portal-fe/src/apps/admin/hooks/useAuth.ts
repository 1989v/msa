import { useState, useCallback, useEffect } from 'react';
import type { JwtPayload, AuthState } from '@admin/types/auth';
import { TOKEN_KEY } from '@admin/api/client';
import { BYPASS_AUTH } from '@admin/lib/auth-bypass';

const MOCK_AUTH_STATE: AuthState = {
  token: 'local-bypass',
  user: {
    userId: 'local-admin',
    roles: ['ROLE_ADMIN'],
    type: 'access',
    iat: 0,
    exp: Number.MAX_SAFE_INTEGER,
  },
  isAdmin: true,
  isAuthenticated: true,
};

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Add padding if needed
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(payload: JwtPayload): boolean {
  return Date.now() / 1000 > payload.exp;
}

function hasAdminRole(payload: JwtPayload): boolean {
  return Array.isArray(payload.roles) && payload.roles.includes('ROLE_ADMIN');
}

function buildAuthState(token: string | null): AuthState {
  if (!token) {
    return { token: null, user: null, isAdmin: false, isAuthenticated: false };
  }
  const payload = decodeJwt(token);
  if (!payload || isTokenExpired(payload)) {
    localStorage.removeItem(TOKEN_KEY);
    return { token: null, user: null, isAdmin: false, isAuthenticated: false };
  }
  return {
    token,
    user: payload,
    isAdmin: hasAdminRole(payload),
    isAuthenticated: true,
  };
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    // ⚠️ TEMPORARY: BYPASS_AUTH 모드면 mock admin state 즉시 반환. 위 BYPASS_AUTH 주석 참고.
    if (BYPASS_AUTH) return MOCK_AUTH_STATE;
    const token = localStorage.getItem(TOKEN_KEY);
    return buildAuthState(token);
  });

  useEffect(() => {
    if (BYPASS_AUTH) return; // ⚠️ TEMPORARY: bypass 시 storage 동기화 불필요.
    const token = localStorage.getItem(TOKEN_KEY);
    setAuthState(buildAuthState(token));
  }, []);

  const login = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuthState(buildAuthState(token));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    // ⚠️ TEMPORARY: bypass 모드에서도 명시적 logout 호출은 mock 유지 (재진입 시 자동 로그인 유사 동작).
    setAuthState(BYPASS_AUTH ? MOCK_AUTH_STATE : { token: null, user: null, isAdmin: false, isAuthenticated: false });
  }, []);

  return {
    ...authState,
    login,
    logout,
  };
}
