import { useState, useCallback, useEffect } from 'react';
import type { JwtPayload, AuthState } from '@/types/auth';
import { TOKEN_KEY } from '@/api/client';
import { getDevAuthToken } from '@/lib/dev-auth';

const UNAUTHENTICATED: AuthState = { token: null, user: null, isAdmin: false, isAuthenticated: false };

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
  if (!token) return UNAUTHENTICATED;
  const payload = decodeJwt(token);
  if (!payload || isTokenExpired(payload)) {
    localStorage.removeItem(TOKEN_KEY);
    return UNAUTHENTICATED;
  }
  return {
    token,
    user: payload,
    isAdmin: hasAdminRole(payload),
    isAuthenticated: true,
  };
}

/**
 * 저장된 토큰이 없을 때만 개발용 토큰을 localStorage 에 심는다. 이렇게 해두면
 * api/client 는 localStorage 하나만 보면 되고, 인증 분기를 둘로 나눌 필요가 없다.
 */
function readToken(): string | null {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) return stored;
  const devToken = getDevAuthToken();
  if (devToken) localStorage.setItem(TOKEN_KEY, devToken);
  return devToken;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => buildAuthState(readToken()));

  useEffect(() => {
    setAuthState(buildAuthState(readToken()));
  }, []);

  const login = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuthState(buildAuthState(token));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthState(UNAUTHENTICATED);
  }, []);

  return {
    ...authState,
    login,
    logout,
  };
}
