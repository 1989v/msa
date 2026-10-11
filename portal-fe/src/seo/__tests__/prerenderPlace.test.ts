import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SIGHT_CATEGORIES } from '../copy.mjs';
// 프리렌더 스크립트는 직접 실행 가드가 있어 import 만으로는 네트워크를 두드리지 않는다 —
// 운영 API 를 치지 않고 렌더 함수를 그대로 검증한다 (dry-verify).
import {
  PartialSeoFailure,
  SIDO_CODES,
  SLICE_CATEGORIES,
  SLICE_WINDOW,
  fetchRegionTops,
  fetchSeoSections,
  fetchSidoSlice,
  indexDoc,
  isTierA,
  placeDetailPages,
  placeHubPages,
  placeLinkDepth,
  placeDetailSitemapEntries,
  placeSitemapFiles,
  renderRegionDetail,
  robotsTxt,
} from '../../../scripts/prerender-seo.mjs';

const SHELL = [
  '<html lang="ko">',
  '<head><!--seo:start--><title>x</title><!--seo:end--></head>',
  '<body><div id="root"></div></body>',
  '</html>',
].join('\n');

const doc = {
  id: '42',
  hasOverview: true,
  sidoCode: '11',
  title: 'Dosan Park',
  titleLocal: '도산공원',
  category: 'nature',
  address: '서울특별시 강남구 도산대로45길 20',
  imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/1/1.jpg',
  tel: null,
  overview: 'A quiet memorial park in Gangnam dedicated to independence activist Ahn Chang-ho.',
  latitude: 37.5241,
  longitude: 127.0357,
};

const seoul = { code: '11', level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', latitude: 37.56, longitude: 126.97, attractionCount: 4321 };
const gangnam = { code: '11680', level: 'SIGUNGU', name: '강남구', nameEn: 'Gangnam-gu', latitude: 37.51, longitude: 127.04, attractionCount: 321 };

describe('열거 샤드 — 법정동 시도코드', () => {
  it('시도 16개, 전부 유일한 2자리 코드다 — 구 areaCode 축은 43% 가 비어 있어 쓰지 않는다', () => {
    expect(SIDO_CODES).toHaveLength(16);
    expect(new Set(SIDO_CODES).size).toBe(16);
    for (const code of SIDO_CODES) expect(code).toMatch(/^\d{2}$/);
    // 특별자치도 승격 후 코드 — administrative_regions 와 어긋나면 지역 링크가 전부 죽는다
    expect(SIDO_CODES).toContain('51'); // 강원
    expect(SIDO_CODES).toContain('52'); // 전북
    expect(SIDO_CODES).toContain('50'); // 제주
    // 광주·전남은 통합특별시 12 — 옛 코드로 훑으면 원천에 행이 없어 그 지역 관광지가 sitemap 에서 빠진다
    expect(SIDO_CODES).toContain('12');
    expect(SIDO_CODES).not.toContain('29');
    expect(SIDO_CODES).not.toContain('46');
  });
});

describe('indexDoc — 슬라이스 항목 변환', () => {
  const raw = {
    id: 'a1',
    title: 'Dosan Park',
    titleLocal: '도산공원',
    category: 'nature',
    address: 'Seoul',
    imageUrl: 'x.jpg',
    tel: null,
    overview: '  A park.  ',
    latitude: 1,
    longitude: 2,
  };

  it('개요 있는 문서는 이름·사진 + 훑은 시도 샤드만 들고 간다 — 본문은 서버 렌더 몫이다', () => {
    const item = indexDoc(raw, '11');
    expect(item).toMatchObject({ id: 'a1', hasOverview: true, sidoCode: '11', title: 'Dosan Park', imageUrl: 'x.jpg' });
    expect(item).not.toHaveProperty('overview');
  });

  it('본문 변경 시각(contentUpdatedAt)을 투영한다 — 없으면 null', () => {
    expect(indexDoc({ ...raw, contentUpdatedAt: '2026-10-08T09:10:11' }, '11')).toMatchObject({ contentUpdatedAt: '2026-10-08T09:10:11' });
    expect(indexDoc(raw, '11')).toMatchObject({ contentUpdatedAt: null });
  });

  it('개요 없는 문서는 sitemap 용 스켈레톤만 — 6만 건 본문을 메모리에 얹지 않는다', () => {
    expect(indexDoc({ ...raw, overview: '' }, '11')).toEqual({ id: 'a1', hasOverview: false });
    expect(indexDoc({ ...raw, overview: '   ' }, '11')).toEqual({ id: 'a1', hasOverview: false });
  });
});

describe('placeDetailPages — place 상세 단계의 산출물', () => {
  const places = {
    ko: [
      { ...doc, id: 'no-image', imageUrl: null },
      doc,
      { id: 'no-overview', hasOverview: false },
    ],
    en: [doc],
  };
  const regions = { ko: [seoul, gangnam], en: [seoul] };
  const pages = placeDetailPages(SHELL, places, regions);

  it('관광지 상세 파일은 만들지 않는다 — search 가 서버 렌더한다 (ADR-0103)', () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const { path } of pages) expect(path).not.toMatch(/attractions/);
  });

  it('지역 파일은 언어별로 그대로 만든다', () => {
    expect(pages.map((p) => p.path).sort()).toEqual([
      'prerender/en/regions/11.html',
      'prerender/regions/11.html',
      'prerender/regions/11680.html',
    ]);
  });

  it('시도 대표 관광지는 사진 있는 문서 먼저, 개요 없는 문서는 빼고 링크한다', () => {
    const html = pages.find((p) => p.path === 'prerender/regions/11.html')!.html;
    expect(html).toContain('href="/regions/11680"');
    expect(html.indexOf('href="/attractions/42"')).toBeGreaterThan(-1);
    expect(html.indexOf('href="/attractions/42"')).toBeLessThan(html.indexOf('href="/attractions/no-image"'));
    expect(html).not.toContain('href="/attractions/no-overview"');
  });
});

describe('renderRegionDetail', () => {
  it('시도 페이지 — 번역쌍이면 hreflang, 시군구·대표 관광지 링크가 본문에 있다', () => {
    const html = renderRegionDetail(SHELL, 'ko', seoul, {
      children: [gangnam],
      top: [doc],
      bothLangs: true,
    });
    expect(html).toContain('<link rel="canonical" href="https://place.1989v.com/regions/11" />');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('href="/regions/11680"');
    expect(html).toContain('href="/attractions/42"');
    expect(html).toContain('"@type":"TouristDestination"');
    expect(html).toContain('<h1>서울특별시 가볼 만한 곳</h1>');
  });

  it('한쪽 언어에만 있는 지역은 hreflang 을 걸지 않는다', () => {
    const html = renderRegionDetail(SHELL, 'ko', gangnam, { parent: seoul, bothLangs: false });
    expect(html).not.toContain('hreflang');
    expect(html).toContain('href="/regions/11"'); // 부모 시도로 가는 빵부스러기
  });
});

describe('하이드레이션 인계 표시 — data-seo-multi', () => {
  // useSeo 는 `[data-seo-multi]` 가 붙은 태그만 지우고 다시 심는다. 프리렌더가 표시를
  // 빠뜨리면 하이드레이션이 기존 것을 못 찾아 **같은 블록을 한 벌 더** 붙인다 —
  // 2026-09-10 실측: 관광지 상세 렌더 후 TouristAttraction ×2 · BreadcrumbList ×2 였고,
  // 두 breadcrumb 의 내용까지 달라(`…›서울특별시›경복궁` vs `…›경복궁`) 검색엔진이
  // 어느 쪽을 쓸지 임의로 골랐다.
  it('JSON-LD 는 전부 표시를 달고 나간다 — 표시 없는 ld+json 이 하나도 없어야 한다', () => {
    const html = renderRegionDetail(SHELL, 'ko', seoul, { top: [doc] });
    const scripts = html.match(/<script type="application\/ld\+json"[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain('data-seo-multi');
  });

  it('hreflang 도 같은 표시를 단다 — 안 그러면 대체 주소가 두 벌씩 선언된다', () => {
    const html = renderRegionDetail(SHELL, 'ko', seoul, { bothLangs: true });
    const links = html.match(/<link rel="alternate"[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const tag of links) expect(tag).toContain('data-seo-multi');
  });
});

describe('robots — 크롤러 정책', () => {
  it('메타 AI 학습 크롤러는 막는다 — 부하의 95% 였고 답변형 검색이 아니다', () => {
    // 2026-09-16~17 ingress 로그: 관광지 상세 1,465건 중 meta-externalagent 1,395건
    const robots = robotsTxt('https://place.1989v.com');
    const block = robots.split('\n\n').find((b) => /User-agent: meta-externalagent/i.test(b));
    expect(block).toBeDefined();
    expect(block).toContain('Disallow: /');
    expect(block).not.toContain('Allow: /');
  });

  it('답변형 검색 크롤러는 그대로 연다 — 인용되는 쪽이 이득이다 (ADR-0062)', () => {
    const robots = robotsTxt('https://place.1989v.com');
    for (const ua of ['GPTBot', 'ClaudeBot', 'PerplexityBot']) {
      const block = robots.split('\n\n').find((b) => b.includes(`User-agent: ${ua}`));
      expect(block, ua).toContain('Allow: /');
      expect(block, ua).not.toContain('Disallow: /\n');
    }
  });

  it('링크 미리보기(facebookexternalhit)는 막지 않는다 — 공유 카드가 깨진다', () => {
    const robots = robotsTxt('https://place.1989v.com');
    expect(robots).not.toMatch(/User-agent: facebookexternalhit\s+Disallow/i);
  });
});

describe('정적 sitemap — 행사 제외 · 숙박 등재 조건', () => {
  // 검색 응답 모양 그대로 — indexDoc 을 거친 뒤 sitemap 항목이 된다
  const api = (id: string, over: Record<string, unknown>) => ({
    id, title: `문서 ${id}`, category: 'nature', contentTypeId: '12', overview: '개요가 있다', imageUrl: 'p.jpg', ...over,
  });
  const raw = {
    ko: [
      api('sight', {}),
      api('course', { category: 'course', contentTypeId: '25', imageUrl: null }),
      api('event', { category: 'festival', contentTypeId: '15' }),
      api('stay-full', { category: 'stay', contentTypeId: '32' }),
      api('stay-no-photo', { category: 'stay', contentTypeId: '32', imageUrl: null }),
      api('stay-no-overview', { category: 'stay', contentTypeId: '32', overview: '' }),
      // 분류는 stay 지만 유형은 레포츠 — 기존 조건(개요만) 그대로
      api('camping', { category: 'stay', contentTypeId: '28', imageUrl: null }),
    ],
    en: [
      api('event-en', { category: 'festival', contentTypeId: '85' }),
      api('stay-en-no-photo', { category: 'stay', contentTypeId: '80', imageUrl: null }),
      api('sight-en', { contentTypeId: '76' }),
    ],
  };
  const docs = (list: Array<Record<string, unknown>>) =>
    list.map((a) => indexDoc(a, '11')).filter((d): d is Record<string, unknown> & { id: string } => d != null);
  const places = { ko: docs(raw.ko), en: docs(raw.en) };
  const locs = placeDetailSitemapEntries(places).map((e: { loc: string }) => e.loc);
  const has = (path: string) => locs.includes(`https://place.1989v.com${path}`);

  it('입력에 행사가 있어도 출력에는 행사 URL 이 없다 — 같은 출력에 관광지·코스는 있다', () => {
    expect(raw.ko.some((a) => a.contentTypeId === '15')).toBe(true);
    expect(raw.en.some((a) => a.contentTypeId === '85')).toBe(true);
    expect(has('/attractions/event')).toBe(false);
    expect(has('/en/attractions/event-en')).toBe(false);
    expect(has('/attractions/sight')).toBe(true);
    expect(has('/attractions/course')).toBe(true);
    expect(has('/en/attractions/sight-en')).toBe(true);
  });

  it('행사는 허브 링크·지역 대표 재료에도 남지 않는다(indexDoc 이 뺀다)', () => {
    expect(indexDoc(raw.ko[2], '11')).toBeNull();
    expect(places.ko.map((d) => d.id)).not.toContain('event');
  });

  it('숙박(32·80)은 개요와 대표 사진이 둘 다 있을 때만 싣는다', () => {
    expect(has('/attractions/stay-full')).toBe(true);
    expect(has('/attractions/stay-no-photo')).toBe(false);
    expect(has('/attractions/stay-no-overview')).toBe(false);
    expect(has('/en/attractions/stay-en-no-photo')).toBe(false);
  });

  it('대조: 사진 없는 레포츠 캠핑장(분류 stay · 유형 28)은 개요만으로 계속 실린다', () => {
    expect(has('/attractions/camping')).toBe(true);
  });
});

describe('정적 sitemap — 관광지 상세 hreflang(언어 대체 짝)', () => {
  // 검색 응답 모양 그대로 — indexDoc 이 alternateId 를 들고 와야 sitemap 이 짝을 안다
  const api = (id: string, contentTypeId: string, over: Record<string, unknown> = {}) => ({
    id, title: `문서 ${id}`, category: 'history', contentTypeId, overview: '개요가 있다', imageUrl: 'p.jpg', ...over,
  });
  const docs = (list: Array<Record<string, unknown>>) =>
    list.map((a) => indexDoc(a, '11')).filter((d): d is Record<string, unknown> & { id: string } => d != null);
  const places = {
    ko: docs([
      api('K1', '12', { alternateId: 'E1' }),
      // 상대 영문 문서가 이번 빌드 항목에 없다(개요 없음 → sitemap 제외)
      api('K2', '12', { alternateId: 'E2' }),
      api('K3', '12', { alternateId: null }),
    ]),
    en: docs([
      api('E1', '76', { alternateId: 'K1' }),
      api('E2', '76', { alternateId: 'K2', overview: '' }),
    ]),
  };
  const entries = placeDetailSitemapEntries(places);
  const entryOf = (path: string) => entries.find((e: { loc: string }) => e.loc === `https://place.1989v.com${path}`);
  const PAIR = [
    { hreflang: 'ko', href: 'https://place.1989v.com/attractions/K1' },
    { hreflang: 'en', href: 'https://place.1989v.com/en/attractions/E1' },
    { hreflang: 'x-default', href: 'https://place.1989v.com/en/attractions/E1' },
  ];

  it('indexDoc 이 alternateId 를 투영한다', () => {
    expect(places.ko[0]).toMatchObject({ id: 'K1', alternateId: 'E1' });
  });

  it('상대 언어 항목이 있으면 양쪽 항목에 같은 세 줄을 붙인다', () => {
    expect(entryOf('/attractions/K1')?.alternates).toEqual(PAIR);
    expect(entryOf('/en/attractions/E1')?.alternates).toEqual(PAIR);
  });

  it('alternateId 는 있으나 상대 언어 항목 집합에 없으면 붙이지 않는다', () => {
    expect(entryOf('/attractions/K2')).toBeDefined();
    expect(entryOf('/attractions/K2')).not.toHaveProperty('alternates');
  });

  it('alternateId 가 없으면 붙이지 않는다', () => {
    expect(entryOf('/attractions/K3')).toBeDefined();
    expect(entryOf('/attractions/K3')).not.toHaveProperty('alternates');
  });
});

describe('place sitemap 인덱스 — 행사 sitemap(동적) 연결', () => {
  const hub = [{ loc: 'https://place.1989v.com/', priority: '1.0' }];
  const detail = [{ loc: 'https://place.1989v.com/attractions/1', priority: '0.7' }];
  const fileOf = (files: Array<[string, string]>, name: string) => files.find(([n]) => n === name)?.[1];
  const sitemapLocs = (xml: string | undefined) =>
    [...(xml ?? '').matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it('상세가 있으면 인덱스가 sitemap-places-events.xml 을 가리키고, 그 파일은 정적으로 만들지 않는다', () => {
    const files = placeSitemapFiles(hub, detail);
    expect(sitemapLocs(fileOf(files, 'sitemap.xml'))).toEqual([
      'https://place.1989v.com/sitemap-places-core.xml',
      'https://place.1989v.com/sitemap-places-1.xml',
      'https://place.1989v.com/sitemap-places-events.xml',
    ]);
    expect(fileOf(files, 'sitemap-places-hub.xml')).toBeUndefined();
    expect(fileOf(files, 'sitemap-places-events.xml')).toBeUndefined();
  });

  it('상세 0건 분기는 인덱스가 아닌 urlset 하나이고 행사 sitemap 을 가리키지 않는다', () => {
    const files = placeSitemapFiles(hub, []);
    expect(files.map(([n]) => n)).toEqual(['sitemap.xml']);
    const xml = fileOf(files, 'sitemap.xml');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>https://place.1989v.com/</loc>');
    expect(xml).not.toContain('sitemap-places-events');
  });
});

describe('fetchSidoSlice — 조회 창(10,000) 초과', () => {
  const page = (n: number, total: number, from = 0) => ({
    totalElements: total,
    attractions: Array.from({ length: n }, (_, i) => ({ id: `d${from + i}`, contentTypeId: '12', overview: '개요' })),
  });
  /** 경로의 category·page 를 보고 응답을 만든다 — 분류마다 건수를 정한다 */
  function fakeGet(totals: Record<string, number>, whole: number) {
    const calls: string[] = [];
    const get = async (path: string) => {
      calls.push(path);
      const url = new URL(path, 'http://x');
      const category = url.searchParams.get('category');
      const p = Number(url.searchParams.get('page'));
      const total = category ? (totals[category] ?? 0) : whole;
      const left = Math.max(0, Math.min(100, total - p * 100));
      return page(left, total, p * 100);
    };
    return { get, calls };
  }

  it('창 안이면 한 번에 받고 분류로 쪼개지 않는다', async () => {
    const { get, calls } = fakeGet({}, 250);
    const items = await fetchSidoSlice('ko', '11', get);
    expect(items).toHaveLength(250);
    expect(calls.every((c) => !c.includes('category='))).toBe(true);
  });

  it('창을 넘으면 분류별로 다시 받는다 — 넘는 조각을 첫 쪽에서 멈추고 나머지를 분류로 채운다', async () => {
    const totals = Object.fromEntries(SLICE_CATEGORIES.map((c: string) => [c, 1_100]));
    const whole = 1_100 * SLICE_CATEGORIES.length;
    expect(whole).toBeGreaterThan(SLICE_WINDOW);
    const { get, calls } = fakeGet(totals, whole);
    const items = await fetchSidoSlice('ko', '11', get);
    expect(items).toHaveLength(whole);
    expect(calls.filter((c) => !c.includes('category='))).toHaveLength(1);
  });

  it('분류로 쪼개도 한 분류가 창을 넘으면 빌드를 세운다', async () => {
    const { get } = fakeGet({ food: SLICE_WINDOW + 1 }, SLICE_WINDOW + 1);
    await expect(fetchSidoSlice('ko', '11', get)).rejects.toThrow(/조회 창 10,000건을 넘습니다/);
  });

  it('분류별 합이 조각 건수와 다르면(빠진 분류가 있다) 빌드를 세운다', async () => {
    const totals = { nature: 6_000, food: 5_000 };
    const { get } = fakeGet(totals, 11_500);
    await expect(fetchSidoSlice('ko', '11', get)).rejects.toThrow(/합이 11000건으로 조각 11500건과 다릅니다/);
  });
});

describe('placeHubPages — 사진 원천 preconnect', () => {
  const places = { ko: [doc], en: [doc] };
  const regions = { ko: [seoul], en: [seoul] };
  const PRECONNECT = '<link rel="preconnect" href="https://tong.visitkorea.or.kr" />';
  const head = (html: string) => html.slice(0, html.indexOf('</head>'));

  it('허브 두 파일(국·영)의 head 에 tong preconnect 가 한 번씩 — crossorigin·data-seo-multi 없이', () => {
    const pages = placeHubPages(SHELL, places, regions);
    expect(pages.map((p) => p.path)).toEqual([
      'prerender/_hosts/place.1989v.com.html',
      'prerender/_hosts/place.1989v.com.en.html',
    ]);
    for (const { html } of pages) {
      expect(head(html).split(PRECONNECT)).toHaveLength(2);
      expect(html.match(/rel="preconnect"/g)).toHaveLength(1);
      expect(html).not.toMatch(/preconnect[^>]*(crossorigin|data-seo-multi)/);
    }
  });

  it('허브 국·영 head 에 그 언어의 최근 갱신 피드 링크가 한 줄 — data-seo-multi 를 단다', () => {
    const [ko, en] = placeHubPages(SHELL, places, regions);
    const feeds = (html: string) => head(html).match(/<link rel="alternate" type="application\/rss\+xml"[^>]*>/g) ?? [];
    expect(feeds(ko.html)).toEqual([
      '<link rel="alternate" type="application/rss+xml" title="K-관광 — 최근 바뀐 관광지" href="https://place.1989v.com/feed.xml" data-seo-multi />',
    ]);
    expect(feeds(en.html)).toEqual([
      '<link rel="alternate" type="application/rss+xml" title="K-Tour — Recently Updated Attractions" href="https://place.1989v.com/en/feed.xml" data-seo-multi />',
    ]);
  });

  it('지역 프리렌더에는 넣지 않는다', () => {
    for (const { html } of placeDetailPages(SHELL, places, { ko: [seoul, gangnam], en: [seoul] })) {
      expect(html).not.toContain('preconnect');
    }
  });
});

describe('isTierA — 핵심 sitemap 의 상세 기준', () => {
  // 검색 응답 모양 그대로 — 판정은 indexDoc 을 거친 항목으로 한다(빌드가 실제로 보는 값)
  const full = {
    id: 't1', title: '경복궁', category: 'history', contentTypeId: '12', overview: '조선의 법궁',
    imageUrl: 'p.jpg', googlePlaceId: 'ChIJx',
  };
  const tierA = (over: Record<string, unknown>) => isTierA(indexDoc({ ...full, ...over }, '11')!);

  it('관광 분류 · 개요 · 사진 · place_id 를 다 갖추면 티어 A', () => {
    expect(tierA({})).toBe(true);
  });

  it('하나라도 빠지면 아니다 — 분류(쇼핑) · 사진 · place_id · 개요', () => {
    expect(tierA({ category: 'shopping' })).toBe(false);
    expect(tierA({ category: undefined })).toBe(false);
    expect(tierA({ imageUrl: null })).toBe(false);
    expect(tierA({ googlePlaceId: null })).toBe(false);
    expect(tierA({ googlePlaceId: undefined })).toBe(false);
    expect(tierA({ overview: '' })).toBe(false);
  });

  it("place_id · 사진이 빈 문자열이나 공백뿐이면 없는 것이다", () => {
    for (const blank of ['', '  ']) {
      expect(tierA({ googlePlaceId: blank })).toBe(false);
      expect(tierA({ imageUrl: blank })).toBe(false);
    }
  });

  it('indexDoc 은 place_id 값이 아니라 유무만 싣는다', () => {
    const item = indexDoc(full, '11');
    expect(item).toMatchObject({ category: 'history', hasGooglePlaceId: true });
    expect(item).not.toHaveProperty('googlePlaceId');
    expect(indexDoc({ ...full, imageUrl: '  ' }, '11')).toMatchObject({ imageUrl: null });
  });
});

describe('place sitemap — 핵심(core) 분리', () => {
  const api = (id: string, over: Record<string, unknown> = {}) => ({
    id, title: `문서 ${id}`, category: 'nature', contentTypeId: '12', overview: '개요', imageUrl: 'p.jpg',
    googlePlaceId: 'ChIJ', ...over,
  });
  const docs = (list: Array<Record<string, unknown>>) =>
    list.map((a) => indexDoc(a, '11')).filter((d): d is Record<string, unknown> & { id: string } => d != null);
  const places = {
    ko: docs([api('A1'), api('A2'), api('N1', { googlePlaceId: null }), api('N2', { category: 'shopping' }), api('N3', { imageUrl: null })]),
    en: docs([api('E1'), api('EN1', { googlePlaceId: '' })]),
  };
  const hub = [
    { loc: 'https://place.1989v.com/', priority: '1.0' },
    { loc: 'https://place.1989v.com/regions/11', priority: '0.8' },
  ];
  const detail = placeDetailSitemapEntries(places);
  const files = placeSitemapFiles(hub, detail);
  const fileOf = (fs: Array<[string, string]>, name: string) => fs.find(([n]) => n === name)?.[1];
  const urlLocs = (xml: string | undefined) => [...(xml ?? '').matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const indexLocs = (fs: Array<[string, string]>) =>
    [...(fileOf(fs, 'sitemap.xml') ?? '').matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  /** sitemap.xml(색인)을 뺀 모든 urlset 의 <loc> — 순서 무관 멀티셋 비교용으로 정렬 */
  const allUrlLocs = (fs: Array<[string, string]>) =>
    fs.filter(([n]) => n !== 'sitemap.xml' || fs.length === 1).flatMap(([, xml]) => urlLocs(xml)).sort();
  const P = (path: string) => `https://place.1989v.com${path}`;

  it('색인 순서는 core → 나머지 → 행사, hub 파일은 없다', () => {
    expect(indexLocs(files)).toEqual([
      P('/sitemap-places-core.xml'),
      P('/sitemap-places-1.xml'),
      P('/sitemap-places-events.xml'),
    ]);
    expect(files.map(([n]) => n)).not.toContain('sitemap-places-hub.xml');
  });

  it('티어 A 상세와 허브 항목은 core 에만, 나머지 상세는 core 에 없다', () => {
    const core = urlLocs(fileOf(files, 'sitemap-places-core.xml'));
    const rest = urlLocs(fileOf(files, 'sitemap-places-1.xml'));
    expect(core).toEqual([P('/'), P('/regions/11'), P('/attractions/A1'), P('/attractions/A2'), P('/en/attractions/E1')]);
    expect(rest.sort()).toEqual([P('/attractions/N1'), P('/attractions/N2'), P('/attractions/N3'), P('/en/attractions/EN1')].sort());
  });

  it('집합 동일성 — 모든 urlset 의 <loc> 멀티셋 = 입력 허브 ∪ 상세, 중복 0', () => {
    const expected = [...hub, ...detail].map((e) => e.loc).sort();
    const got = allUrlLocs(files);
    expect(got).toEqual(expected);
    expect(new Set(got).size).toBe(got.length);
  });

  it('core 가 상한을 넘으면 core-2 로 이어 쓰고 색인에서 core 바로 다음 — 집합은 그대로', () => {
    const chunk = 3;
    // 허브 2 + 티어 A 3 = 5 > 3
    const over = placeSitemapFiles(hub, detail, chunk);
    expect(indexLocs(over).slice(0, 3)).toEqual([P('/sitemap-places-core.xml'), P('/sitemap-places-core-2.xml'), P('/sitemap-places-1.xml')]);
    expect(urlLocs(fileOf(over, 'sitemap-places-core.xml'))).toHaveLength(chunk);
    const got = allUrlLocs(over);
    expect(got).toEqual([...hub, ...detail].map((e) => e.loc).sort());
    expect(new Set(got).size).toBe(got.length);
  });

  it('기본 상한(20,000) 경계 — core 가 상한 + 1 이면 core-2 에 한 건', () => {
    const many = Array.from({ length: 20_000 }, (_, i) => ({ loc: P(`/attractions/c${i}`), priority: '0.7', tierA: true }));
    const big = placeSitemapFiles([hub[0]], many);
    expect(urlLocs(fileOf(big, 'sitemap-places-core.xml'))).toHaveLength(20_000);
    expect(urlLocs(fileOf(big, 'sitemap-places-core-2.xml'))).toHaveLength(1);
    expect(indexLocs(big)).toEqual([P('/sitemap-places-core.xml'), P('/sitemap-places-core-2.xml'), P('/sitemap-places-events.xml')]);
  });

  it('상세 0건이면 urlset 하나 — 집합은 허브 그대로', () => {
    const none = placeSitemapFiles(hub, []);
    expect(none.map(([n]) => n)).toEqual(['sitemap.xml']);
    expect(allUrlLocs(none)).toEqual(hub.map((e) => e.loc).sort());
  });

  it('티어 A 0건 게이트 — 상세 10,000건 · 티어 A 0 이면 빌드를 세우고, 9,999건이면 통과', () => {
    const plain = (n: number) => Array.from({ length: n }, (_, i) => ({ loc: P(`/attractions/p${i}`), priority: '0.7', tierA: false }));
    expect(() => placeSitemapFiles(hub, plain(10_000))).toThrow(PartialSeoFailure);
    expect(() => placeSitemapFiles(hub, plain(9_999))).not.toThrow();
  });
});

describe('place sitemap — 상세 lastmod', () => {
  const TZ = process.env.TZ;
  // KST 자정 직후 시각이 UTC 로 바뀌면 하루 앞 날짜가 된다 — 그 경로로 가면 갈리도록 서울 시간대로 고정한다
  beforeAll(() => {
    process.env.TZ = 'Asia/Seoul';
  });
  afterAll(() => {
    process.env.TZ = TZ;
  });
  const api = (id: string, over: Record<string, unknown>) => ({
    id, title: id, category: 'nature', contentTypeId: '12', overview: '개요', ...over,
  });
  const lastmodOf = (over: Record<string, unknown>) => {
    const item = indexDoc(api('x', over), '11')!;
    const [entry] = placeDetailSitemapEntries({ ko: [item], en: [] });
    const xml = placeSitemapFiles([], [entry])[0][1];
    return { entry: entry.lastmod ?? null, xml: xml.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null };
  };

  it('contentUpdatedAt 이 있으면 그 날짜 부분(KST 문자열 앞 10자) — 시간대 변환을 거치지 않는다', () => {
    expect(new Date('2026-10-09T00:30:00').toISOString().slice(0, 10)).toBe('2026-10-08');
    expect(lastmodOf({ contentUpdatedAt: '2026-10-09T00:30:00', modifiedAt: '2026-01-02T12:00:00' }).entry).toBe('2026-10-09');
  });

  it('앞 10자가 날짜 형식이 아니면 modifiedAt 규칙', () => {
    expect(lastmodOf({ contentUpdatedAt: '20261009T003000', modifiedAt: '2026-01-02T12:00:00' }).entry).toBe('2026-01-02');
  });

  it('contentUpdatedAt 이 없으면 modifiedAt 규칙, 둘 다 없으면 <lastmod> 없음', () => {
    expect(lastmodOf({ modifiedAt: '2026-01-02T12:00:00' }).entry).toBe('2026-01-02');
    const none = lastmodOf({});
    expect(none.entry).toBeNull();
  });
});

describe('시군구 대표 관광지 — 내부 링크 깊이', () => {
  const jongno = { code: '11110', level: 'SIGUNGU', name: '종로구', nameEn: 'Jongno-gu', attractionCount: 300 };
  const regions = { ko: [seoul, gangnam, jongno], en: [seoul] };
  const api = (id: string, over: Record<string, unknown> = {}) => ({
    id, title: `문서 ${id}`, category: 'history', contentTypeId: '12', overview: '개요', imageUrl: 'p.jpg', googlePlaceId: 'ChIJ', ...over,
  });
  // 서울 시도 샤드 30건 — 시도 대표(10)에는 앞쪽만 든다
  const raw = [
    ...Array.from({ length: 24 }, (_, i) => api(`s${i}`)),
    api('plain1', { googlePlaceId: null }),
    api('plain2', { googlePlaceId: null }),
    api('no-ov', { overview: '' }),
  ];
  const places = {
    ko: raw.map((a) => indexDoc(a, '11')).filter((d): d is Record<string, unknown> & { id: string } => d != null),
    en: [],
  };
  // 강남 응답 30건: 색인(places)에 없는 id · 개요 없는 문서 · 티어 A 아닌 문서가 섞여 있고, 티어 A 가 뒤에 있다
  const gangnamTop = [
    api('plain1', { googlePlaceId: null }),
    api('ghost'),
    api('no-ov', { overview: '' }),
    api('plain2', { googlePlaceId: null }),
    ...Array.from({ length: 12 }, (_, i) => api(`s${12 + i}`)),
  ];
  const regionTops = new Map([['ko/11680', gangnamTop]]);
  const pages = placeDetailPages(SHELL, places, regions, { regionTops });
  const htmlOf = (path: string) => pages.find((p) => p.path === path)!.html;
  const attrLinks = (html: string) => [...html.matchAll(/<a href="\/attractions\/([^"]+)">/g)].map((m) => m[1]);

  it('시군구 페이지에 대표 최대 10곳 — 색인에 없는 id · 개요 없는 문서는 빠지고 티어 A 가 먼저', () => {
    const links = attrLinks(htmlOf('prerender/regions/11680.html'));
    expect(links).toHaveLength(10);
    expect(links).toEqual(Array.from({ length: 10 }, (_, i) => `s${12 + i}`));
    expect(links).not.toContain('ghost');
    expect(links).not.toContain('no-ov');
  });

  it('티어 A 가 모자라면 개요 있는 나머지로 채운다', () => {
    const few = placeDetailPages(SHELL, places, regions, { regionTops: new Map([['ko/11680', gangnamTop.slice(0, 6)]]) });
    expect(attrLinks(few.find((p) => p.path === 'prerender/regions/11680.html')!.html)).toEqual(['s12', 's13', 'plain1', 'plain2']);
  });

  it('조회 결과가 없는 시군구는 대표 링크 0 — 지어내지 않는다', () => {
    expect(attrLinks(htmlOf('prerender/regions/11110.html'))).toEqual([]);
  });

  it('시도 페이지는 지금 출력 그대로(대표 10)', () => {
    const before = placeDetailPages(SHELL, places, regions);
    expect(htmlOf('prerender/regions/11.html')).toBe(before.find((p) => p.path === 'prerender/regions/11.html')!.html);
    expect(attrLinks(htmlOf('prerender/regions/11.html'))).toHaveLength(10);
  });

  it('링크 그래프 — 허브에서 <a href> 만 따라가면 시군구 대표가 깊이 3 안', () => {
    const all = [...placeHubPages(SHELL, { ko: [], en: [] }, regions), ...pages];
    const urlOf = (path: string) =>
      path === 'prerender/_hosts/place.1989v.com.html' ? '/' : path.replace(/^prerender/, '').replace(/\.html$/, '');
    const byUrl = new Map(all.map((p) => [urlOf(p.path), p.html]));
    const depth = new Map([['/', 0]]);
    const queue = ['/'];
    while (queue.length) {
      const url = queue.shift()!;
      for (const m of (byUrl.get(url) ?? '').matchAll(/<a href="([^"]+)"/g)) {
        if (depth.has(m[1])) continue;
        depth.set(m[1], depth.get(url)! + 1);
        if (byUrl.has(m[1])) queue.push(m[1]);
      }
    }
    // 허브의 관광지 seed 를 비웠으므로 대표는 지역 페이지를 거쳐서만 닿는다
    expect(depth.get('/regions/11680')).toBe(2);
    expect(attrLinks(htmlOf('prerender/regions/11680.html')).length).toBeGreaterThan(0);
    for (const id of attrLinks(htmlOf('prerender/regions/11680.html'))) {
      expect(depth.get(`/attractions/${id}`)).toBeLessThanOrEqual(3);
    }
  });

  it('빌드 로그 재료 — 티어 A 중 깊이 3 안 N/M', () => {
    const all = [...placeHubPages(SHELL, { ko: [], en: [] }, regions), ...pages];
    const tierA = places.ko.filter((d) => isTierA(d)).length;
    // 시도 대표 s0~s9 + 강남 대표 s12~s21 = 20곳
    expect(placeLinkDepth(all, places).ko).toEqual({ within: 20, total: tierA });
  });

  it('스위치가 꺼져 있으면 시군구 페이지 랜딩 링크 0, indexed 랜딩은 그 시군구 페이지에만', () => {
    const landing = (code: string, attr: string, indexed: boolean) => ({
      entry: { lang: 'ko', code, attr }, heading: `${code} ${attr} 랜딩`, indexed,
    });
    const off = placeDetailPages(SHELL, places, regions, { regionTops, landingPages: [landing('11680', 'parking', false)] });
    for (const { html } of off) expect(html).not.toContain('/regions/11680/parking');
    const on = placeDetailPages(SHELL, places, regions, { regionTops, landingPages: [landing('11680', 'parking', true)] });
    expect(on.find((p) => p.path === 'prerender/regions/11680.html')!.html).toContain('<a href="/regions/11680/parking">');
    for (const { path, html } of on) {
      if (path !== 'prerender/regions/11680.html') expect(html).not.toContain('/regions/11680/parking');
    }
  });
});

describe('fetchRegionTops — 시군구 대표 조회', () => {
  const regions = {
    ko: [seoul, gangnam],
    en: [seoul, { ...gangnam }],
  };

  it('시군구마다 1회 — 관광 분류 · 시도 2자리 · 시군구 3자리 · size 30', async () => {
    const paths: string[] = [];
    const get = async (path: string) => {
      paths.push(path);
      return { attractions: [{ id: 'x' }] };
    };
    const tops = await fetchRegionTops(regions, get, { retryDelays: [0, 0] });
    expect(paths).toHaveLength(2);
    const q = new URLSearchParams(paths[0].split('?')[1]);
    expect(paths[0].startsWith('/api/search/attractions?')).toBe(true);
    expect(q.get('category')).toBe(SIGHT_CATEGORIES.join(','));
    expect(q.get('category')).toBe('nature,history,culture,leisure');
    expect(q.get('sidoCode')).toBe('11');
    expect(q.get('sigunguCode')).toBe('680');
    expect(q.get('size')).toBe('30');
    expect(paths[0]).toContain('category=nature,history,culture,leisure');
    expect(tops.get('ko/11680')).toEqual([{ id: 'x' }]);
    expect(tops.get('en/11680')).toEqual([{ id: 'x' }]);
  });

  it('첫 시도 실패 · 재시도 성공이면 성공으로 친다', async () => {
    let calls = 0;
    const get = async () => {
      calls += 1;
      if (calls === 1) throw new Error('GET → 503');
      return { attractions: [] };
    };
    const tops = await fetchRegionTops({ ko: [gangnam], en: [] }, get, { retryDelays: [0, 0] });
    expect(calls).toBe(2);
    expect(tops.get('ko/11680')).toEqual([]);
  });

  const ok = {
    games: async () => [{ slug: 'g' }],
    places: async () => ({ ko: [], en: [] }),
    regions: async () => regions,
    landingList: async () => [],
    landings: async () => new Map(),
    guides: async () => [],
    guideCards: async () => new Map(),
    blog: async () => ({ posts: [], categories: [] }),
    concepts: async () => [],
    deal: async () => [],
    rank: async () => [],
  };

  it('하나가 재시도까지 실패하면 place-region-tops 섹션 실패 — 다른 섹션이 성공했으면 PartialSeoFailure', async () => {
    const get = async (path: string) => {
      if (path.includes('lang=en')) throw new Error('GET → 503');
      return { attractions: [] };
    };
    const err = await fetchSeoSections({
      ...ok,
      regionTops: (r: unknown) => fetchRegionTops(r, get, { retryDelays: [0, 0] }),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartialSeoFailure);
    expect((err as Error).message).toMatch(/실패: place-region-tops/);
  });

  it('places 섹션이 실패하면 시군구 대표를 조회하지 않는다', async () => {
    const regionTops = vi.fn(async () => new Map());
    await fetchSeoSections({
      ...ok,
      places: async () => {
        throw new Error('GET → 503');
      },
      regionTops,
    }).catch(() => undefined);
    expect(regionTops).not.toHaveBeenCalled();
  });

  it('성공하면 결과를 돌려준다', async () => {
    const data = await fetchSeoSections({
      ...ok,
      regionTops: (r: unknown) => fetchRegionTops(r, async () => ({ attractions: [{ id: 'y' }] }), { retryDelays: [0, 0] }),
    });
    expect(data.regionTops.get('ko/11680')).toEqual([{ id: 'y' }]);
  });
});
