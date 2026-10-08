import { describe, expect, it } from 'vitest';
// 프리렌더 스크립트는 직접 실행 가드가 있어 import 만으로는 네트워크를 두드리지 않는다.
// 기대값은 상수와 대상 함수(landingMeta·landingPath)의 출력으로 계산한다 — 문장을 여기서 다시 조립하지 않는다.
import {
  PartialSeoFailure,
  fetchPlaceLandings,
  fetchSeoSections,
  placeLandingPages,
  placeLandingSitemapEntries,
  placeLlmsTxt,
} from '../../../scripts/prerender-seo.mjs';
import {
  PLACE_LANDING_MIN_RESULTS,
  PLACE_ORIGIN,
  SIGHT_CATEGORIES,
  landingMeta,
  landingPath,
} from '../copy.mjs';

const SHELL = [
  '<html lang="ko">',
  '<head><!--seo:start--><title>x</title><!--seo:end--></head>',
  '<body><div id="root"></div></body>',
  '</html>',
].join('\n');

const seoul = { code: '11', level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', attractionCount: 900 };
const jongno = { code: '11110', level: 'SIGUNGU', name: '종로구', nameEn: 'Jongno-gu', attractionCount: 300 };
const junggu = { code: '11140', level: 'SIGUNGU', name: '중구', nameEn: 'Jung-gu', attractionCount: 200 };
const yongsan = { code: '11170', level: 'SIGUNGU', name: '용산구', nameEn: 'Yongsan-gu', attractionCount: 100 };
const REGIONS = { ko: [seoul, jongno, junggu, yongsan], en: [seoul, jongno] };

type Entry = { lang: string; code: string; sidoCode: string; attr: string; count: number; jaccardMax: number;
  selectedAt: string; retired?: boolean; retiredAt?: string };
const entry = (lang: string, code: string, attr: string, extra: Partial<Entry> = {}): Entry => ({
  lang, code, sidoCode: code.slice(0, 2), attr, count: 30, jaccardMax: 0, selectedAt: '2026-10-09', ...extra,
});

/** 검색 응답 — 상위 n 건(최대 30), modifiedAt 은 i 가 클수록 최근 */
function response(total: number, n = Math.min(total, 30), { facets = {} as unknown, prefix = 'a', titleOf = (i: number) => `관광지 ${prefix}${i}` } = {}) {
  return {
    totalElements: total,
    attributeFacets: facets,
    attractions: Array.from({ length: n }, (_, i) => ({
      id: `${prefix}${i}`,
      title: titleOf(i),
      category: 'history',
      address: '서울특별시 종로구 사직로 161 (세종로)',
      modifiedAt: `2026-09-${String(10 + (i % 15)).padStart(2, '0')}T10:00:00`,
    })),
  };
}

const LIST: Entry[] = [
  entry('ko', '11110', 'parking'),
  entry('ko', '11110', 'free'),
  entry('ko', '11110', 'pet'),
  entry('ko', '11140', 'parking', { retired: true, retiredAt: '2026-10-09' }),
  entry('ko', '11170', 'parking'),
  entry('en', '11110', 'parking'),
  entry('en', '11110', 'free'),
];
const RESULTS = new Map<string, Record<string, unknown>>([
  ['ko/11110/parking', response(35)],
  // facet 이 실패(null)해도 N 은 totalElements 다
  ['ko/11110/free', response(12, 12, { facets: null, prefix: 'f' })],
  ['ko/11110/pet', response(PLACE_LANDING_MIN_RESULTS - 1, PLACE_LANDING_MIN_RESULTS - 1, { prefix: 'p' })],
  ['ko/11140/parking', response(40, 30, { prefix: 'j' })],
  ['ko/11170/parking', response(20, 20, { prefix: 'y' })],
  ['en/11110/parking', response(15, 15, { prefix: 'e' })],
  ['en/11110/free', response(PLACE_LANDING_MIN_RESULTS - 1, PLACE_LANDING_MIN_RESULTS - 1, { prefix: 'g' })],
]);

const build = (indexable = false, list = LIST, results = RESULTS) =>
  placeLandingPages(SHELL, { landings: list, regions: REGIONS, results, indexable });
const pageOf = (out: ReturnType<typeof build>, lang: string, code: string, attr: string) =>
  out.pages.find((p) => p.entry.lang === lang && p.entry.code === code && p.entry.attr === attr);
const NOINDEX = '<meta name="robots" content="noindex, follow" />';

describe('placeLandingPages — 출력', () => {
  const out = build();
  const page = pageOf(out, 'ko', '11110', 'parking')!;
  const meta = landingMeta('ko', seoul, jongno, 'parking', { count: 35, asOf: '2026-09-24' });

  it('파일 경로는 prerender/{en/}regions/{code}/{attr}.html', () => {
    expect(page.path).toBe('prerender/regions/11110/parking.html');
    expect(pageOf(out, 'en', '11110', 'parking')!.path).toBe('prerender/en/regions/11110/parking.html');
  });

  it('h1 은 landingMeta heading, 문장은 N(totalElements)과 asOf(표시 30건 modifiedAt 최댓값)', () => {
    expect(page.html).toContain(`<h1>${meta.heading}</h1>`);
    expect(page.html).toContain(meta.sentence);
    expect(page.html).toContain(`<title>${meta.title}</title>`);
  });

  it('목록은 최대 30건, 상세 링크로', () => {
    expect(page.html.match(/href="\/attractions\/a\d+"/g)).toHaveLength(30);
  });

  it('canonical 은 그 랜딩 주소', () => {
    expect(page.html).toContain(`<link rel="canonical" href="${PLACE_ORIGIN}${landingPath('ko', '11110', 'parking')}" />`);
  });

  it('지역 페이지 링크와 허브 링크가 있다', () => {
    expect(page.html).toContain('href="/regions/11110"');
    expect(page.html).toContain('href="/"');
  });

  it('형제 링크: 같은 시군구 다른 속성·같은 시도 같은 속성 중 비은퇴·N≥하한만', () => {
    expect(page.html).toContain(`href="${landingPath('ko', '11110', 'free')}"`);
    expect(page.html).toContain(`href="${landingPath('ko', '11170', 'parking')}"`);
    // 미달(pet)·은퇴(11140 parking)는 잇지 않는다
    expect(page.html).not.toContain(`href="${landingPath('ko', '11110', 'pet')}"`);
    expect(page.html).not.toContain(`href="${landingPath('ko', '11140', 'parking')}"`);
    // 다른 언어는 형제가 아니다
    expect(page.html).not.toContain(`href="${landingPath('en', '11110', 'parking')}"`);
  });

  it('형제가 0개면 형제 절을 생략한다', () => {
    const solo = build(false, [entry('ko', '11110', 'parking')]);
    const html = pageOf(solo, 'ko', '11110', 'parking')!.html;
    expect(html).not.toMatch(/href="\/regions\/\d+\/[a-z-]+"/);
  });

  it('스위치 false 면 하한 이상·비은퇴여도 noindex', () => {
    expect(page.html).toContain(NOINDEX);
  });

  it('스위치 true 면 하한 이상·비은퇴 랜딩은 색인을 연다', () => {
    expect(pageOf(build(true), 'ko', '11110', 'parking')!.html).not.toContain(NOINDEX);
  });

  it('N < 하한 → noindex + 빌드 경고', () => {
    const on = build(true);
    expect(pageOf(on, 'ko', '11110', 'pet')!.html).toContain(NOINDEX);
    expect(on.warnings.some((w: string) => w.includes('ko/11110/pet'))).toBe(true);
  });

  it('은퇴 항목은 파일을 만들되 noindex', () => {
    const retired = pageOf(build(true), 'ko', '11140', 'parking');
    expect(retired).toBeDefined();
    expect(retired!.html).toContain(NOINDEX);
  });

  it('facet null + totalElements 12 → 문장에 12, 하한 판정 통과', () => {
    const free = pageOf(build(true), 'ko', '11110', 'free')!;
    const expected = landingMeta('ko', seoul, jongno, 'free', { count: 12, asOf: free.asOf });
    expect(free.html).toContain(expected.sentence);
    expect(free.html).not.toContain(NOINDEX);
  });

  it('이스케이프: 원천 이름의 <script> 는 요소가 아니라 평문', () => {
    const evil = new Map(RESULTS);
    evil.set('ko/11110/parking', response(35, 30, { titleOf: (i) => (i === 0 ? '<script>alert(1)</script>&lt;script&gt;x' : `t${i}`) }));
    const html = pageOf(build(false, LIST, evil), 'ko', '11110', 'parking')!.html;
    const body = html.slice(html.indexOf('<div id="root">'));
    expect(body).not.toContain('<script');
    expect(body).toContain('alert(1)');
    expect(body).toContain('&lt;script&gt;x');
  });

  it('모집단 밖 code 항목 → 파일 없음 + 경고', () => {
    const outside = build(false, [...LIST, entry('ko', '99999', 'parking')]);
    expect(outside.pages.some((p: { path: string }) => p.path.includes('99999'))).toBe(false);
    expect(outside.warnings.some((w: string) => w.includes('99999'))).toBe(true);
  });

  it('품질 게이트: 랜딩 간 title·description 이 겹치면 빌드를 세운다', () => {
    expect(() => build(false, [...LIST, entry('ko', '11110', 'parking')])).toThrow(PartialSeoFailure);
  });
});

describe('sitemap · llms', () => {
  it('스위치 false → 랜딩 0건', () => {
    const out = build(false);
    expect(placeLandingSitemapEntries(out.pages)).toEqual([]);
    expect(placeLlmsTxt({ ko: [], en: [] }, out.pages)).not.toMatch(/\/regions\/\d+\//);
  });

  it('스위치 true → 하한 이상·비은퇴만, lastmod 는 표시 30건 modifiedAt 최댓값', () => {
    const out = build(true);
    const entries = placeLandingSitemapEntries(out.pages);
    const locs = entries.map((e: { loc: string }) => e.loc).sort();
    expect(locs).toEqual(
      [
        `${PLACE_ORIGIN}${landingPath('en', '11110', 'parking')}`,
        `${PLACE_ORIGIN}${landingPath('ko', '11110', 'free')}`,
        `${PLACE_ORIGIN}${landingPath('ko', '11110', 'parking')}`,
        `${PLACE_ORIGIN}${landingPath('ko', '11170', 'parking')}`,
      ].sort(),
    );
    // 30건(i=0..29) 중 modifiedAt 최댓값은 i%15=14 인 2026-09-24
    const parking = entries.find((e: { loc: string }) => e.loc.endsWith('/regions/11110/parking') && !e.loc.includes('/en/'));
    expect(parking!.lastmod).toBe('2026-09-24');

    const llms = placeLlmsTxt({ ko: [], en: [] }, out.pages);
    for (const loc of locs) expect(llms).toContain(loc);
    expect(llms).not.toContain(landingPath('ko', '11140', 'parking'));
    expect(llms).not.toContain(landingPath('ko', '11110', 'pet'));
  });

  it('modifiedAt 이 없으면 lastmod 를 비운다(빌드일로 대신 적지 않는다)', () => {
    const blank = new Map(RESULTS);
    const r = response(35);
    r.attractions.forEach((a) => { (a as { modifiedAt: string | null }).modifiedAt = null; });
    blank.set('ko/11110/parking', r);
    const entries = placeLandingSitemapEntries(build(true, LIST, blank).pages);
    const parking = entries.find((e: { loc: string }) => e.loc === `${PLACE_ORIGIN}${landingPath('ko', '11110', 'parking')}`);
    expect(parking!.lastmod).toBeUndefined();
  });

  it('hreflang 은 같은 (code, attr) 가 국·영 둘 다 실릴 때만', () => {
    const entries = placeLandingSitemapEntries(build(true).pages);
    const koParking = entries.find((e: { loc: string }) => e.loc === `${PLACE_ORIGIN}${landingPath('ko', '11110', 'parking')}`);
    const koFree = entries.find((e: { loc: string }) => e.loc === `${PLACE_ORIGIN}${landingPath('ko', '11110', 'free')}`);
    expect(koParking!.alternates?.map((a: { hreflang: string }) => a.hreflang)).toEqual(['ko', 'en', 'x-default']);
    // 영문 free 는 하한 미달이라 실리지 않는다 → 국문 free 에도 대체 주소를 걸지 않는다
    expect(koFree!.alternates).toBeUndefined();
  });
});

describe('fetchPlaceLandings — 조회', () => {
  it('항목마다 필터 질의 1회: 관광 분류·시도 2자리·시군구 3자리·속성 파라미터·size 30', async () => {
    const paths: string[] = [];
    const get = async (path: string) => {
      paths.push(path);
      return response(20);
    };
    const results = await fetchPlaceLandings(LIST, REGIONS, get);
    expect(paths).toHaveLength(LIST.length);
    expect(results.size).toBe(LIST.length);
    const first = new URLSearchParams(paths[0].split('?')[1]);
    expect(paths[0].startsWith('/api/search/attractions?')).toBe(true);
    expect(first.get('lang')).toBe('ko');
    expect(first.get('category')).toBe(SIGHT_CATEGORIES.join(','));
    expect(first.get('sidoCode')).toBe('11');
    expect(first.get('sigunguCode')).toBe('110');
    expect(first.get('parking')).toBe('YES');
    expect(first.get('size')).toBe('30');
    expect(first.has('facets')).toBe(false);
  });

  it('모집단 밖 항목은 조회하지 않는다(파일을 만들지 않는다)', async () => {
    const paths: string[] = [];
    await fetchPlaceLandings([entry('ko', '99999', 'parking')], REGIONS, async (p: string) => {
      paths.push(p);
      return response(20);
    });
    expect(paths).toEqual([]);
  });
});

describe('부분 실패 가드 — place-landings 섹션', () => {
  const ok = {
    games: async () => [],
    places: async () => ({ ko: [], en: [] }),
    regions: async () => REGIONS,
    landingList: async () => LIST,
    blog: async () => ({ posts: [], categories: [] }),
    concepts: async () => [],
    deal: async () => [],
    rank: async () => [],
  };

  it('랜딩 조회 하나만 실패해도 섹션 실패 — 다른 섹션이 성공했으면 PartialSeoFailure', async () => {
    let calls = 0;
    const get = async () => {
      calls += 1;
      if (calls === 2) throw new Error('GET → 503');
      return response(20);
    };
    const err = await fetchSeoSections({
      ...ok,
      landings: (list: Entry[], regions: unknown) => fetchPlaceLandings(list, regions, get),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartialSeoFailure);
    expect((err as Error).message).toMatch(/실패: place-landings/);
  });

  it('전부 성공하면 랜딩 조회 결과를 돌려준다', async () => {
    const data = await fetchSeoSections({ ...ok, landings: (list: Entry[], regions: unknown) => fetchPlaceLandings(list, regions, async () => response(20)) });
    expect(data.landingList).toEqual(LIST);
    expect(data.landingResults.size).toBe(LIST.length);
  });
});
