/**
 * auth — portal-fe 쇼핑 플로우 인증 모듈.
 *
 * localStorage 기반 토큰 보관 + OAuth 인가 URL 빌더 (gifticon-fe 패턴 이식).
 * API 호출(로그인/리프레시/로그아웃)은 src/api/shopApi.ts 가 담당.
 */

const ACCESS_TOKEN_KEY = 'portal_access_token';
const REFRESH_TOKEN_KEY = 'portal_refresh_token';
const USER_ID_KEY = 'portal_user_id';

/** 로그인 후 복귀 경로 보관용 (OAuth redirect 왕복 동안 유지) */
export const LOGIN_NEXT_KEY = 'portal_login_next';

export type OAuthProvider = 'kakao' | 'google';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() != null;
}

export function login(accessToken: string, refreshToken: string, memberId: string | number): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_ID_KEY, String(memberId));
}

/** 토큰 갱신 시 access/refresh 만 교체 */
export function updateTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function logout(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

export function getOAuthRedirectUri(): string {
  return `${window.location.origin}/oauth/callback`;
}

const KAKAO_CLIENT_ID: string = import.meta.env.VITE_KAKAO_CLIENT_ID ?? '';
const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export function buildKakaoAuthUrl(): string {
  const redirectUri = getOAuthRedirectUri();
  return (
    'https://kauth.kakao.com/oauth/authorize' +
    `?client_id=${KAKAO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    '&response_type=code&state=kakao'
  );
}

export function buildGoogleAuthUrl(): string {
  const redirectUri = getOAuthRedirectUri();
  return (
    'https://accounts.google.com/o/oauth2/v2/auth' +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    '&response_type=code&scope=openid%20email%20profile&state=google'
  );
}
