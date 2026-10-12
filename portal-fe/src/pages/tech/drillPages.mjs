// tech 드릴다운 페이지 목록 — 라우트 · NAV · 아틀라스 카드 · 렌더 · 프리렌더 · sitemap 이 이 목록 하나를 돈다.
// 도메인을 더하려면 code-dictionary 의 DrillExportSpec `DRILLS` 에 한 줄, 여기에 한 줄, copy.mjs 의 PORTAL_PAGES 에 한 줄.
// 데이터는 `src/content/drill/<domain>.json`(온톨로지에서 내보낸 것)이고 렌더가 `generated/<domain>-drill.json` 을 만든다.

/**
 * @typedef {{ domain: string, path: string, title: string, area: string, card: string }} DrillPage
 * `area` 는 머리 줄 · 카드의 분야 이름, `card` 는 아틀라스 첫 화면 카드의 한 줄 설명.
 */

/** @type {DrillPage[]} */
export const DRILL_PAGES = [
  {
    domain: 'search',
    path: '/tech/search',
    title: '검색 아키텍처',
    area: '검색',
    card: '검색어 하나가 결과가 되기까지 — 단계를 눌러 좁혀 들어가며 일반 개념, 이 서비스의 적용 상태, 코드를 본다.',
  },
  {
    domain: 'recommendation',
    path: '/tech/recommendation',
    title: '추천 아키텍처',
    area: '추천',
    card: '행동 신호가 추천 목록이 되기까지 — 후보 생성 · 랭킹 · 재정렬 · 서빙 · 실험을 단계별로 좁혀 본다.',
  },
];

/** IT 면 GNB — 아틀라스, 드릴다운 페이지들, 홈. 아틀라스와 드릴다운 페이지가 같은 줄을 쓴다 */
export const DRILL_NAV = [
  { label: '아틀라스', href: '/tech' },
  ...DRILL_PAGES.map((p) => ({ label: p.title, href: p.path })),
  { label: '홈', href: '/' },
];

/** @param {string} domain */
export function drillPage(domain) {
  const page = DRILL_PAGES.find((p) => p.domain === domain);
  if (!page) throw new Error(`드릴다운 페이지가 없다: ${domain}`);
  return page;
}
