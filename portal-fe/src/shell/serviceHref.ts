import { DEAL_ORIGIN } from '../seo/copy.mjs';

/**
 * apex 프로덕션인가. 서브도메인이 없는 로컬·k3d 는 false 라 상대 경로가 그대로 쓰인다.
 * (App.tsx 의 호스트 리다이렉트도 같은 판정을 쓴다 — 기준이 갈리면 타일과 라우트가 어긋난다)
 */
export const isApexProd = window.location.hostname === '1989v.com';

/**
 * 서브도메인이 정규 주소인 전시 서비스 — 전시 코드 → origin.
 *
 * `display_service.href` 는 상대 경로로 둔다(ADR-0066) — 절대 URL 을 DB 에 박으면 로컬
 * 개발에서도 프로덕션으로 튄다. 대신 **apex 에서 그릴 때만** 여기서 정규 주소로 올린다.
 *
 * App.tsx 의 `dealRoute` 가 이미 클릭 후 리다이렉트를 하지만, 그건 JS 가 돈 뒤다. 링크
 * 자체를 정규 주소로 두면 hover 표시·새 탭 열기·링크 복사가 전부 실제 주소를 가리키고
 * 왕복 한 번이 사라진다. 리다이렉트는 직접 주소를 친 방문자를 위한 안전망으로 남는다.
 *
 * place·game 도 같은 구조지만 지금 건드리지 않았다 — 요청 범위 밖이고, 넣으려면
 * PLACE_ORIGIN/GAME_ORIGIN 한 줄씩이면 된다.
 */
const SUBDOMAIN_ORIGIN: Record<string, string> = {
  deal: DEAL_ORIGIN,
};

/** 전시 타일이 실제로 걸 주소 */
export function resolveServiceHref(code: string, href: string): string {
  const origin = SUBDOMAIN_ORIGIN[code];
  return isApexProd && origin ? `${origin}/` : href;
}
