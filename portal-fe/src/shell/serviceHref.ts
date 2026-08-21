import { BLOG_ORIGIN, DEAL_ORIGIN, GAME_ORIGIN, PLACE_ORIGIN, PORTAL_ORIGIN } from '../seo/copy.mjs';

/**
 * apex 프로덕션인가. 서브도메인이 없는 로컬·k3d 는 false 라 상대 경로가 그대로 쓰인다.
 * (App.tsx 의 호스트 리다이렉트도 같은 판정을 쓴다 — 기준이 갈리면 타일과 라우트가 어긋난다)
 */
export const isApexProd = window.location.hostname === '1989v.com';

/**
 * 서브도메인이 정규 주소인 전시 서비스 — 전시 코드 → origin.
 *
 * **새 서비스를 서브도메인으로 올리면 여기 한 줄을 추가한다.** 빠뜨리면 타일이 apex 경로를
 * 걸고, 클릭 후 JS 리다이렉트로만 넘어간다 — 도착은 하지만 hover 표시·링크 복사·새 탭이
 * 전부 apex 를 가리키고 크롤러는 apex 에 머문다.
 *
 * `display_service.href` 는 DB 에서 상대 경로로 둔다 — 절대 URL 을 박으면 로컬 개발에서
 * 타일을 눌러도 프로덕션으로 튄다. 그래서 승격은 **apex 에서 그릴 때만** 화면이 한다.
 * App.tsx 의 호스트 리다이렉트는 주소를 직접 친 방문자를 위한 안전망으로 남는다.
 */
const SUBDOMAIN_ORIGIN: Record<string, string> = {
  blog: BLOG_ORIGIN,
  deal: DEAL_ORIGIN,
  place: PLACE_ORIGIN,
  game: GAME_ORIGIN,
};

/** 전시 타일이 실제로 걸 주소 */
export function resolveServiceHref(code: string, href: string): string {
  const origin = SUBDOMAIN_ORIGIN[code];
  return isApexProd && origin ? `${origin}/` : href;
}

/**
 * 프로덕션 1989v 계열 호스트인가 — apex 뿐 아니라 game/blog/place/deal 서브도메인 포함.
 * 서비스 탐색 오버레이는 서브도메인에서도 뜨는데, 거기서 `isApexProd` 기준의 상대 경로를
 * 걸면 `game.1989v.com/tech` 처럼 다른 서비스 화면이 게임 origin 아래로 샌다 (ADR-0066 개정
 * 이 경고한 바로 그 형태 — 도착은 하지만 주소·크롤러·공유 링크가 전부 어긋난다).
 */
const isProd1989vHost =
  window.location.hostname === '1989v.com' || window.location.hostname.endsWith('.1989v.com');

/** 서비스 탐색 오버레이가 걸 주소 — 어느 프로덕션 호스트에서든 정규 주소로 보낸다 */
export function resolveExplorerHref(code: string, href: string): string {
  if (!isProd1989vHost) return href; // 로컬/k3d — 상대 경로 그대로 (타일과 같은 이유)
  const origin = SUBDOMAIN_ORIGIN[code];
  return origin ? `${origin}/` : `${PORTAL_ORIGIN}${href}`;
}

/** 탐색 오버레이의 본진(런처) 행 — 서브도메인에서 apex 로 돌아가는 유일한 상시 통로 */
export function portalHomeHref(): string {
  return isProd1989vHost ? `${PORTAL_ORIGIN}/` : '/';
}
