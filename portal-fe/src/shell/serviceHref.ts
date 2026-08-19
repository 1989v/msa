import { DEAL_ORIGIN, GAME_ORIGIN, PLACE_ORIGIN } from '../seo/copy.mjs';

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
  deal: DEAL_ORIGIN,
  place: PLACE_ORIGIN,
  game: GAME_ORIGIN,
};

/** 전시 타일이 실제로 걸 주소 */
export function resolveServiceHref(code: string, href: string): string {
  const origin = SUBDOMAIN_ORIGIN[code];
  return isApexProd && origin ? `${origin}/` : href;
}
