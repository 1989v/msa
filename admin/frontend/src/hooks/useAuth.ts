import { useState, useCallback, useEffect } from 'react';
import type { JwtPayload, AuthState } from '@/types/auth';
import { TOKEN_KEY } from '@/api/client';

// ⚠️ TEMPORARY — k3d 로컬 테스트용 SSO 우회 플래그.
// 이유: auth-service / OAuth provider 가 로컬에 미기동인 상태에서도
//       admin FE 화면 진입을 검증할 수 있도록 한시적으로 추가.
// 영향: AppLayout 의 isAuthenticated / isAdmin 가드가 무조건 통과되어
//       /admin 하위 페이지를 인증 없이 렌더링한다. (API 호출은 token 부재로
//       여전히 401 가능 — 그건 별도 처리.)
// TODO(removal): auth flow 정상화 후 본 상수 + bypass 분기 즉시 제거.
//                운영 빌드에 절대 포함 금지. README 의 운영 배포 체크리스트 참고.
const BYPASS_AUTH = true;

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
