import { useState, useCallback, useEffect } from 'react';
import { JwtPayload, AuthState } from '@/types/auth';
import { TOKEN_KEY } from '@/api/client';

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
    const token = localStorage.getItem(TOKEN_KEY);
    return buildAuthState(token);
  });

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    setAuthState(buildAuthState(token));
  }, []);

  const login = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuthState(buildAuthState(token));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthState({ token: null, user: null, isAdmin: false, isAuthenticated: false });
  }, []);

  return {
    ...authState,
    login,
    logout,
  };
}
