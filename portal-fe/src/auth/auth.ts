/**
 * auth — portal-fe 인증 모듈.
 *
 * 토큰은 **서버가 HttpOnly 쿠키로 내리고 JS 는 읽지 못한다**(ADR-0101). 요청은 같은 오리진 상대 경로라
 * 쿠키가 저절로 실리고, 게이트웨이가 그 쿠키에서 토큰을 읽는다. 이 모듈이 아는 것은
 * 「로그인했다」는 표시 쿠키(`portal_user_id`, 비밀 아님)뿐이다.
 * 로그인은 **apex 한 곳**에서만 일어난다 (ADR-0079).
 */

import { PORTAL_ORIGIN } from '../seo/copy.mjs';

const ACCESS_TOKEN_KEY = 'portal_access_token';
const REFRESH_TOKEN_KEY = 'portal_refresh_token';
const USER_ID_KEY = 'portal_user_id';
const COOKIE_DOMAIN = '.1989v.com';

/** 프로덕션 1989v 계열 호스트인가 (로컬·k3d 는 서브도메인이 없어 도메인 쿠키를 못 쓴다) */
const isProd1989vHost =
  window.location.hostname === '1989v.com' || window.location.hostname.endsWith('.1989v.com');

function readCookie(name: string): string | null {
  const hit = document.cookie
    .split('; ')
    .find((c) => c.slice(0, name.length + 1) === `${name}=`);
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function clearCookie(name: string): void {
  const base = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = isProd1989vHost ? `${base}; Domain=${COOKIE_DOMAIN}` : base;
  // 도메인 쿠키 도입 전에 남은 host-only 쿠키도 함께 지운다
  document.cookie = base;
}

/** 로그인 후 복귀 경로 보관용 (OAuth redirect 왕복 동안 유지) */
export const LOGIN_NEXT_KEY = 'portal_login_next';

export type OAuthProvider = 'kakao' | 'google';

export function getUserId(): string | null {
  return readCookie(USER_ID_KEY);
}

/** 표시 쿠키로 본다 — 토큰은 HttpOnly 라 여기서 보이지 않는다. 토큰이 만료됐으면 첫 요청의 401 이 갱신을 부른다 */
export function isLoggedIn(): boolean {
  return getUserId() != null;
}

/**
 * 로컬 흔적을 지운다. 서버 쿠키(HttpOnly)는 `/api/auth/logout` 응답이 지우고, 여기서는 JS 가 볼 수 있는
 * 것만 지운다 — 표시 쿠키, 쿠키 전환 전의 읽히는 토큰 쿠키, 그보다 앞선 localStorage 잔재.
 */
export function clearLocalSession(): void {
  clearCookie(USER_ID_KEY);
  if (readCookie(ACCESS_TOKEN_KEY) != null) clearCookie(ACCESS_TOKEN_KEY);
  if (readCookie(REFRESH_TOKEN_KEY) != null) clearCookie(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

/**
 * HttpOnly 전환 전에 로그인한 세션 — 토큰 쿠키가 JS 에 **보이면** 옛 것이다(ADR-0101 §5).
 * 한 번 갱신을 불러 서버가 HttpOnly 쿠키로 바꿔 끼우게 하고, 읽히는 옛 쿠키를 지운다.
 * 갱신은 호출자가 넘긴다(순환 의존을 피해). 끊지 않고 옮기는 것이 요점이다.
 */
export async function upgradeLegacySession(refresh: () => Promise<boolean>): Promise<void> {
  if (readCookie(REFRESH_TOKEN_KEY) == null && readCookie(ACCESS_TOKEN_KEY) == null) return;
  const ok = await refresh();
  // 성공이면 서버가 같은 이름의 HttpOnly 쿠키를 새로 걸었다 — 남은 읽히는 사본(Path=/ 리프레시)만 지운다
  if (readCookie(REFRESH_TOKEN_KEY) != null) clearCookie(REFRESH_TOKEN_KEY);
  if (!ok) clearLocalSession();
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

/**
 * 그 제공자로 실제 로그인할 수 있는가 — `client_id` 가 빌드에 주입됐는지로 판정한다.
 *
 * 비어 있으면 인가 요청이 제공자 쪽에서 거절된다(카카오 KOE101, 구글 invalid_client).
 * **동작할 수 없는 로그인 수단은 화면에 내지 않는다** — 눌러서 오류를 보는 것이
 * 처음부터 없는 것보다 나쁘다. 시크릿을 넣어 다시 빌드하면 그대로 살아난다.
 */
export function isProviderEnabled(provider: OAuthProvider): boolean {
  return (provider === 'kakao' ? KAKAO_CLIENT_ID : GOOGLE_CLIENT_ID).trim().length > 0;
}

const OAUTH_STATE_KEY = 'portal_oauth_state';

/**
 * OAuth `state` — 로그인을 시작할 때마다 새 난수(ADR-0101 §4).
 *
 * 제공자 이름만 넣던 때는 누구나 같은 값을 만들 수 있어, 공격자가 자기 인가 코드로 만든 콜백 링크를
 * 밟게 하면 피해자가 공격자 계정으로 로그인됐다(로그인 CSRF). 시작한 탭의 sessionStorage 에 두고
 * 콜백에서 같은지 본다. 로그인은 apex 한 곳이라 시작과 콜백이 같은 오리진이다.
 */
function newOAuthState(provider: OAuthProvider): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const state = `${provider}.${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  return state;
}

/** 콜백의 `state` 가 이 탭에서 시작한 것과 같으면 제공자를, 아니면 null. 한 번 쓰면 지운다 */
export function consumeOAuthState(state: string | null): OAuthProvider | null {
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  if (!state || !expected || state !== expected) return null;
  const provider = state.split('.')[0];
  return provider === 'kakao' || provider === 'google' ? provider : null;
}

export function buildKakaoAuthUrl(): string {
  const redirectUri = getOAuthRedirectUri();
  return (
    'https://kauth.kakao.com/oauth/authorize' +
    `?client_id=${KAKAO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&state=${encodeURIComponent(newOAuthState('kakao'))}`
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
    `&response_type=code&scope=openid&state=${encodeURIComponent(newOAuthState('google'))}`
  );
}
