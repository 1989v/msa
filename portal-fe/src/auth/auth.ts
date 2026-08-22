/**
 * auth — portal-fe 쇼핑 플로우 인증 모듈.
 *
 * 도메인 쿠키 기반 토큰 보관 + OAuth 인가 URL 빌더.
 * 로그인은 **apex 한 곳**에서만 일어난다 (ADR-0079).
 * API 호출(로그인/리프레시/로그아웃)은 src/api/shopApi.ts 가 담당.
 */

import { PORTAL_ORIGIN } from '../seo/copy.mjs';

const ACCESS_TOKEN_KEY = 'portal_access_token';
const REFRESH_TOKEN_KEY = 'portal_refresh_token';
const USER_ID_KEY = 'portal_user_id';

/**
 * 토큰은 쿠키에 둔다 — `localStorage` 가 아니다 (ADR-0079).
 *
 * `localStorage` 는 **오리진마다 격리**된다. 1989v.com 에서 로그인해도 game.1989v.com 은
 * 그 토큰을 읽지 못해, 서브도메인 수만큼 따로 로그인해야 했다. `.1989v.com` 도메인 쿠키는
 * 전 서브도메인이 공유하므로 한 번 로그인하면 어디서든 로그인 상태다.
 *
 * **httpOnly 로 두지 않는다.** 그러면 JS 가 못 읽어 `Authorization: Bearer` 를 만들 수 없고,
 * 게이트웨이를 쿠키 인증으로 바꿔야 하며 CSRF 방어가 새로 필요해진다. JS 가 읽는 쿠키는
 * XSS 노출 면에서 localStorage 와 동일하므로 후퇴가 없고, 서브도메인 공유만 얻는다.
 * 전송은 지금처럼 헤더로 하므로 쿠키 자동 전송에 기대지 않는다(=CSRF 표면 없음).
 */
const COOKIE_DOMAIN = '.1989v.com';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일 — refresh 토큰 수명과 맞춘다

/** 프로덕션 1989v 계열 호스트인가 (로컬·k3d 는 서브도메인이 없어 도메인 쿠키를 못 쓴다) */
const isProd1989vHost =
  window.location.hostname === '1989v.com' || window.location.hostname.endsWith('.1989v.com');

function readCookie(name: string): string | null {
  const hit = document.cookie
    .split('; ')
    .find((c) => c.slice(0, name.length + 1) === `${name}=`);
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ];
  // Secure 쿠키는 http 에서 거부된다 — 로컬 개발이 조용히 로그인 불가가 되지 않게 가른다
  if (window.location.protocol === 'https:') parts.push('Secure');
  if (isProd1989vHost) parts.push(`Domain=${COOKIE_DOMAIN}`);
  document.cookie = parts.join('; ');
}

function clearCookie(name: string): void {
  const base = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = isProd1989vHost ? `${base}; Domain=${COOKIE_DOMAIN}` : base;
  // 도메인 쿠키 도입 전에 남은 host-only 쿠키도 함께 지운다 — 남아 있으면 같은 이름의
  // 쿠키가 둘이 되어 브라우저가 더 좁은 쪽을 돌려주고, 로그아웃이 안 먹는 것처럼 보인다.
  document.cookie = base;
}

/** 로그인 후 복귀 경로 보관용 (OAuth redirect 왕복 동안 유지) */
export const LOGIN_NEXT_KEY = 'portal_login_next';

export type OAuthProvider = 'kakao' | 'google';

export function getAccessToken(): string | null {
  return readCookie(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readCookie(REFRESH_TOKEN_KEY);
}

export function getUserId(): string | null {
  return readCookie(USER_ID_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() != null;
}

export function login(accessToken: string, refreshToken: string, memberId: string | number): void {
  writeCookie(ACCESS_TOKEN_KEY, accessToken);
  writeCookie(REFRESH_TOKEN_KEY, refreshToken);
  writeCookie(USER_ID_KEY, String(memberId));
}

/** 토큰 갱신 시 access/refresh 만 교체 */
export function updateTokens(accessToken: string, refreshToken: string): void {
  writeCookie(ACCESS_TOKEN_KEY, accessToken);
  writeCookie(REFRESH_TOKEN_KEY, refreshToken);
}

export function logout(): void {
  clearCookie(ACCESS_TOKEN_KEY);
  clearCookie(REFRESH_TOKEN_KEY);
  clearCookie(USER_ID_KEY);
  // 쿠키 전환 이전 세션의 잔재 — 남겨두면 isLoggedIn 이 쿠키를 보는데 옛 값이 계속 남는다
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

/**
 * OAuth 콜백 주소 — 프로덕션에서는 **항상 apex 하나**다 (ADR-0079).
 *
 * 예전에는 `window.location.origin` 을 썼다. 그러면 게임 페이지에서 로그인을 누른 사람은
 * `game.1989v.com/oauth/callback` 으로 돌아오게 되고, 제공자 콘솔에 호스트 수만큼 URI 를
 * 등록해야 한다. 하나라도 빠지면 `redirect_uri_mismatch` 로 로그인이 통째로 막힌다
 * (2026-08-22 game 호스트에서 실제로 발생). 등록 대상을 하나로 줄이는 것이 이 함수의 요점이다.
 */
export function getOAuthRedirectUri(): string {
  const origin = isProd1989vHost ? PORTAL_ORIGIN : window.location.origin;
  return `${origin}/oauth/callback`;
}

/**
 * 로그인 후 돌아갈 주소를 안전하게 정규화한다.
 *
 * apex 로 모으면서 `next` 가 **다른 호스트의 절대 URL** 이 됐다. 검증 없이 그대로 보내면
 * 공격자가 `?next=https://evil.example` 를 붙여 우리 도메인의 로그인 화면을 미끼로 쓸 수 있다
 * (오픈 리다이렉트). 1989v 계열과 상대 경로만 통과시킨다.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  // 상대 경로는 허용하되 `//evil.com` 같은 프로토콜 상대 주소는 막는다
  if (next.startsWith('/') && !next.startsWith('//')) return next;
  try {
    const url = new URL(next);
    const ok =
      url.protocol === 'https:' &&
      (url.hostname === '1989v.com' || url.hostname.endsWith('.1989v.com'));
    return ok ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * 로그인 화면 주소 — 어느 호스트에서 눌러도 **apex 로 보낸다** (ADR-0079).
 *
 * @param next 로그인 뒤 돌아올 곳. 서브도메인에서 부르면 절대 URL 이어야 한다 —
 *   상대 경로를 그대로 넘기면 apex 안에서 길을 잃는다.
 */
export function buildLoginHref(next?: string): string {
  const target = next ?? window.location.href;
  const absolute = isProd1989vHost ? new URL(target, window.location.origin).toString() : target;
  const base = isProd1989vHost ? `${PORTAL_ORIGIN}/login` : '/login';
  return `${base}?next=${encodeURIComponent(absolute)}`;
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

/**
 * 스코프는 `openid` 하나다 (ADR-0078).
 *
 * `email`·`profile` 을 빼면 응답에 식별값(sub)만 온다 — 받지 않는 것이 저장하지 않는 것보다
 * 확실하고, 동의 화면에 이름·이메일이 뜨지 않아 사용자가 무엇을 주는지도 정확해진다.
 * 회원을 찾는 데는 sub 이면 충분하다(원래부터 그것이 유일한 조회 키였다).
 */
export function buildGoogleAuthUrl(): string {
  const redirectUri = getOAuthRedirectUri();
  return (
    'https://accounts.google.com/o/oauth2/v2/auth' +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    '&response_type=code&scope=openid&state=google'
  );
}
