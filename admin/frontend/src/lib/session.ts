import axios from 'axios';
import { getDevAuthToken } from '@/lib/dev-auth';

/**
 * 어드민 세션 — 토큰은 auth 가 HttpOnly 쿠키로 내리고 JS 는 읽지 못한다(ADR-0101).
 * 같은 오리진 `/api` 요청에 쿠키가 저절로 실리고 게이트웨이가 그 쿠키에서 토큰을 읽는다.
 * 여기서 아는 것은 「로그인했다」는 표시 쿠키(`portal_user_id`, 비밀 아님)뿐이다.
 *
 * 로그인 화면은 어드민에 두지 않는다 — apex `/login` 한 곳이다(ADR-0079).
 */

const USER_ID_COOKIE = 'portal_user_id';
const APEX_LOGIN_URL = 'https://1989v.com/login';

function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function userIdFromJwt(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const userId = (JSON.parse(json) as { userId?: unknown }).userId;
    return userId == null ? null : String(userId);
  } catch {
    return null;
  }
}

/** 로그인한 회원 id. 로컬 개발에서는 개발용 토큰에서 읽는다 */
export function getSessionUserId(): string | null {
  const devToken = getDevAuthToken();
  if (devToken) return userIdFromJwt(devToken);
  return readCookie(USER_ID_COOKIE);
}

/**
 * apex 로그인 주소 — 1989v 계열 호스트에서만 있다. 로컬·k3d 는 apex 가 없어
 * 개발용 토큰(`VITE_DEV_ADMIN_TOKEN`)으로만 들어온다.
 */
export function apexLoginHref(): string | null {
  const host = window.location.hostname;
  if (host !== '1989v.com' && !host.endsWith('.1989v.com')) return null;
  return `${APEX_LOGIN_URL}?next=${encodeURIComponent(`${window.location.origin}/`)}`;
}

/** 서버가 세 쿠키를 지운다 — HttpOnly 는 JS 가 못 지운다 */
export async function endSession(): Promise<void> {
  try {
    await axios.post('/api/auth/logout');
  } catch {
    // 네트워크 오류여도 로그인 화면으로는 보낸다
  }
}

let inFlight: Promise<boolean> | null = null;

/**
 * 액세스 토큰 재발급 — 리프레시 쿠키(Path=/api/auth)가 실리고 응답이 새 쿠키를 건다.
 * 서버는 리프레시 토큰을 회전시키므로 동시 401 이 재발급 둘로 갈리면 뒤엣것이 폐기된
 * 토큰을 보내 실패한다 — 진행 중인 것 하나를 같이 기다린다.
 */
export function refreshSession(): Promise<boolean> {
  if (getDevAuthToken() || !readCookie(USER_ID_COOKIE)) return Promise.resolve(false);
  if (inFlight) return inFlight;
  inFlight = axios
    .post<{ success: boolean }>('/api/auth/refresh')
    .then((res) => res.data.success === true)
    .catch(() => false)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
