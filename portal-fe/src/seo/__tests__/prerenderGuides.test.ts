import { describe, expect, it, vi } from 'vitest';
// 프리렌더 스크립트는 직접 실행 가드가 있어 import 만으로는 네트워크를 두드리지 않는다.
// 기대값은 copy.mjs 의 상수·함수 출력으로 계산한다 — 문구를 여기서 다시 조립하지 않는다.
import {
  PartialSeoFailure,
  fetchPlaceGuideCards,
  fetchSeoSections,
  placeGuidePages,
  placeGuideSitemapEntries,
  placeHubPages,
  placeLlmsTxt,
} from '../../../scripts/prerender-seo.mjs';
import { GUIDE_DRAFT_BAND, guideCardAsOf, guidePath, guideUrl } from '../copy.mjs';

const SHELL = [
  '<html lang="ko">',
  '<head><!--seo:start--><title>x</title><!--seo:end--></head>',
  '<body><div id="root"></div></body>',
  '</html>',
].join('\n');

type Part = { html: string } | { cardId: string };
const guide = (slug: string, status: 'draft' | 'published', parts: Part[], extra: Record<string, unknown> = {}) => ({
  slug,
  title: `가이드 ${slug}`,
  description: `설명 ${slug}`,
  status,
  reviewedBy: status === 'published' ? '권기덕' : null,
  reviewedAt: status === 'published' ? '2026-10-10' : null,
  attractionIds: parts.flatMap((p) => ('cardId' in p ? [p.cardId] : [])),
  source: `portal-fe/src/content/guides/${slug}.md`,
  headings: [],
  parts,
  ...extra,
});

const card = (id: string, title = `관광지 ${id}`) => ({
  id,
  title,
  address: '서울특별시 종로구 사직로 161',
  feeText: '무료',
  restDate: '매주 화요일',
  attrParking: 'YES',
  parking: '',
  petPolicy: 'UNKNOWN',
  petAcmpyType: null,
});

const BUILD = '2026-10-09';
const body = (html: string) => html.slice(html.indexOf('<div id="root">'));

describe('편집 페이지 프리렌더', () => {
  const draft = guide('seoul-free', 'draft', [{ html: '<p>첫 문단</p>' }, { cardId: '101' }, { html: '<p>끝</p>' }]);
  // 원천 이름에 태그와 엔터티가 섞여 온다 — 태그는 평문화로 걷히고, 디코드된 「<script>」는 이스케이프돼 글자로 남아야 한다
  const cards = new Map<string, Record<string, unknown> | null>([['101', card('101', '<script>alert(1)</script>&lt;script&gt;경복궁')]]);

  it('draft → noindex · 「검수 전 초안」 띠 · sitemap·llms 제외 · 목록 없음 · 허브 링크 없음', () => {
    const out = placeGuidePages(SHELL, { guides: [draft], cards, buildDate: BUILD });
    // 초안은 _noindex 아래 같은 경로 — nginx 가 X-Robots-Tag 헤더로도 noindex 를 낸다
    expect(out.pages.map((p: { path: string }) => p.path)).toEqual(['prerender/_noindex/guides/seoul-free.html']);
    expect(out.pages[0].path).toBe(`prerender/_noindex${new URL(out.pages[0].url).pathname}.html`);
    const html = out.pages[0].html;
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).toContain(`<link rel="canonical" href="${guideUrl('seoul-free')}" />`);
    expect(body(html)).toContain(GUIDE_DRAFT_BAND);
    expect(body(html).match(/<h1>/g)).toHaveLength(1);
    expect(body(html)).toContain(`<h1>${draft.title}</h1>`);
    expect(out.index).toBeNull();
    expect(placeGuideSitemapEntries(out)).toEqual([]);
    expect(placeLlmsTxt({ ko: [], en: [] }, [], out)).not.toContain(guidePath('seoul-free'));
    const hub = placeHubPages(SHELL, { ko: [], en: [] }, { ko: [], en: [] }, { guidesListed: out.index != null });
    for (const p of hub) expect(p.html).not.toContain(`href="${guidePath()}"`);
  });

  it('published ≥ 1 → 목록 파일·허브 하단 링크 1개·sitemap·llms 포함, draft 는 목록에 없다', () => {
    const pub = guide('palace', 'published', [{ html: '<p>본문</p>' }, { cardId: '101' }]);
    const out = placeGuidePages(SHELL, { guides: [draft, pub], cards, buildDate: BUILD });
    const pubPage = out.pages.find((p) => p.guide.slug === 'palace')!;
    expect(pubPage.html).not.toContain('noindex');
    expect(pubPage.path).toBe('prerender/guides/palace.html');
    expect(pubPage.path).toBe(`prerender${new URL(pubPage.url).pathname}.html`);
    expect(body(pubPage.html)).not.toContain(GUIDE_DRAFT_BAND);
    expect(out.index!.path).toBe('prerender/guides/index.html');
    expect(out.index!.html).toContain(`href="${guidePath('palace')}"`);
    expect(out.index!.html).not.toContain(`href="${guidePath('seoul-free')}"`);
    expect(placeGuideSitemapEntries(out).map((e: { loc: string }) => e.loc)).toEqual([guideUrl(''), guideUrl('palace')]);
    const llms = placeLlmsTxt({ ko: [], en: [] }, [], out);
    expect(llms).toContain(guideUrl('palace'));
    expect(llms).not.toContain(guideUrl('seoul-free'));
    const [ko, en] = placeHubPages(SHELL, { ko: [], en: [] }, { ko: [], en: [] }, { guidesListed: out.index != null });
    expect(ko.html.match(new RegExp(`href="${guidePath()}"`, 'g'))).toHaveLength(1);
    expect(en.html).not.toContain(`href="${guidePath()}"`);
  });

  it('카드는 이름이 평문으로 이스케이프되고 카드 영역에 「색인 기준 {빌드 날짜}」가 붙는다', () => {
    const out = placeGuidePages(SHELL, { guides: [draft], cards, buildDate: BUILD });
    const root = body(out.pages[0].html);
    expect(root).not.toContain('<script');
    expect(root).toContain('&lt;script&gt;경복궁');
    expect(root).toContain(guideCardAsOf(BUILD));
    // 조각 순서 그대로 — 첫 문단 · 카드 · 끝
    const [a, b, c] = ['첫 문단', '경복궁', '끝'].map((t) => root.indexOf(t));
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it('draft 카드 404 → 그 카드만 빼고 경고', () => {
    const two = guide('two', 'draft', [{ cardId: '101' }, { cardId: '404' }]);
    const out = placeGuidePages(SHELL, { guides: [two], cards: new Map<string, Record<string, unknown> | null>([['101', card('101')], ['404', null]]), buildDate: BUILD });
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0].html).toContain('관광지 101');
    expect(out.pages[0].html).not.toContain('/attractions/404');
    expect(out.warnings.join('\n')).toMatch(/404/);
  });

  it('published 카드 404 → 원본 파일 경로와 id 를 담아 빌드 실패', () => {
    const pub = guide('palace', 'published', [{ cardId: '404' }]);
    const run = () => placeGuidePages(SHELL, { guides: [pub], cards: new Map<string, Record<string, unknown> | null>([['404', null]]), buildDate: BUILD });
    expect(run).toThrow(PartialSeoFailure);
    expect(run).toThrow(/portal-fe\/src\/content\/guides\/palace\.md/);
    expect(run).toThrow(/404/);
  });

  it('본문 속 랜딩이 이번 빌드에서 하한 미만이면 경고', () => {
    const linked = guide('linked', 'draft', [{ html: '<p><a href="/regions/11110/free">종로구</a></p>' }, { cardId: '101' }]);
    const landingPages = [{ path: 'prerender/regions/11110/free.html', url: 'https://place.1989v.com/regions/11110/free', count: 3, entry: { lang: 'ko', code: '11110', attr: 'free' } }];
    const out = placeGuidePages(SHELL, { guides: [linked], cards, buildDate: BUILD, landingPages });
    expect(out.warnings.join('\n')).toContain('/regions/11110/free');
    const enough = placeGuidePages(SHELL, { guides: [linked], cards, buildDate: BUILD, landingPages: [{ ...landingPages[0], count: 50 }] });
    expect(enough.warnings).toEqual([]);
  });
});

describe('편집 페이지 카드 조회', () => {
  it('관광지마다 상세 1회, 404 는 null 로 남기고 다른 실패는 던진다', async () => {
    const get = vi.fn(async (path: string) => (path.endsWith('/404') ? null : { id: path.split('/').pop() }));
    const cards = await fetchPlaceGuideCards([guide('a', 'draft', [{ cardId: '101' }, { cardId: '404' }])], get);
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/api/search/attractions/101', '/api/search/attractions/404']);
    expect(cards.get('101')).toEqual({ id: '101' });
    expect(cards.get('404')).toBeNull();
    const broken = vi.fn(async () => {
      throw new Error('GET → 500');
    });
    await expect(fetchPlaceGuideCards([guide('a', 'draft', [{ cardId: '101' }])], broken)).rejects.toThrow(/500/);
  });
});

describe('부분 실패 가드 — guides 섹션', () => {
  const ok = {
    games: async () => [],
    places: async () => ({ ko: [], en: [] }),
    regions: async () => ({ ko: [], en: [] }),
    landingList: async () => [],
    landings: async () => new Map(),
    regionTops: async () => new Map(),
    guides: async () => [guide('a', 'draft', [{ cardId: '101' }])],
    guideCards: async () => new Map([['101', card('101')]]),
    blog: async () => ({ posts: [], categories: [] }),
    concepts: async () => [],
    deal: async () => [],
    rank: async () => [],
  };

  it('카드 조회가 실패하고 다른 섹션이 성공했으면 PartialSeoFailure', async () => {
    const err = await fetchSeoSections({
      ...ok,
      guideCards: async () => {
        throw new Error('GET → 503');
      },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartialSeoFailure);
    expect((err as Error).message).toMatch(/실패: guides/);
  });

  it('성공하면 원본과 카드를 돌려준다', async () => {
    const data = await fetchSeoSections(ok);
    expect(data.guides.map((g: { slug: string }) => g.slug)).toEqual(['a']);
    expect(data.guideCards.get('101')).toMatchObject({ id: '101' });
  });
});
