import { describe, expect, it } from 'vitest';
// 직접 실행 가드가 있어 import 만으로는 운영 API 를 두드리지 않는다 (prerenderPlace.test 와 동일).
import {
  dealLlmsTxt,
  dealRobotsTxt,
  dealSitemapEntries,
  renderDealHubHtml,
} from '../../../scripts/prerender-seo.mjs';
import { DEAL_ORIGIN } from '../copy.mjs';

const SHELL = [
  '<html lang="ko">',
  '<head><!--seo:start--><title>x</title><!--seo:end--></head>',
  '<body><div id="root"></div></body>',
  '</html>',
].join('\n');

const sections = [
  {
    category: { code: 'travel', label: '여행', tagline: '항공 · 숙소' },
    offers: [
      {
        slug: 'trip-com',
        merchant: '트립닷컴',
        title: '해외 호텔 예약',
        benefit: '최대 10% 할인',
        summary: '회원가 기준으로 추가 할인이 붙는 상시 프로모션입니다.',
        revenueType: 'AFFILIATE',
        disclosureRequired: true,
        validUntil: null,
      },
    ],
  },
  { category: { code: 'education', label: '교육', tagline: null }, offers: [] },
];

describe('혜택 허브 프리렌더 (ADR-0069 색인 개방)', () => {
  const html = renderDealHubHtml(SHELL, sections);

  it('noindex 를 심지 않는다 — 2026-08-24 부터 색인 대상이다', () => {
    expect(html).not.toContain('noindex');
  });

  it('canonical 은 허브 하나다 — 검색은 주소를 만들지 않는다', () => {
    expect(html).toContain(`<link rel="canonical" href="${DEAL_ORIGIN}/" />`);
  });

  it('오퍼가 본문에 텍스트로 들어간다 — 무 JS 크롤러가 읽을 것이 이것뿐이다', () => {
    expect(html).toContain('트립닷컴');
    expect(html).toContain('해외 호텔 예약');
    expect(html).toContain('회원가 기준으로 추가 할인이 붙는 상시 프로모션입니다.');
  });

  it('정적 본문에 /go/ 링크를 넣지 않는다 — rel="sponsored" 는 React 가 붙이므로 고지 없는 제휴 링크가 된다', () => {
    expect(html).not.toContain('/go/');
    expect(html).not.toContain('trip-com');
  });

  it('오퍼가 없는 분류는 본문에 넣지 않는다 — 빈 제목만 늘면 얇은 페이지가 된다', () => {
    expect(html).toContain('<h2>여행</h2>');
    expect(html).not.toContain('<h2>교육</h2>');
  });
});

describe('혜택 허브 robots · sitemap · llms', () => {
  it('robots 는 /go/ 를 계속 막는다 — 아웃바운드 리다이렉터는 색인 대상이 아니다', () => {
    const robots = dealRobotsTxt();
    expect(robots).toContain('Disallow: /go/');
    expect(robots).toContain(`Sitemap: ${DEAL_ORIGIN}/sitemap.xml`);
  });

  it('sitemap 은 허브 한 장이다 — 오퍼가 수십 건인 지금 쪼개면 doorway page 가 된다', () => {
    expect(dealSitemapEntries()).toEqual([{ loc: `${DEAL_ORIGIN}/`, priority: '1.0' }]);
  });

  it('llms.txt 는 오퍼를 분류별로 적고 제휴 고지를 밝힌다', () => {
    const llms = dealLlmsTxt(sections);
    expect(llms).toContain('## 여행');
    expect(llms).toContain('트립닷컴 · 최대 10% 할인 — 해외 호텔 예약');
    expect(llms).toContain('수수료를 받습니다');
    expect(llms).not.toContain('## 교육');
  });
});
