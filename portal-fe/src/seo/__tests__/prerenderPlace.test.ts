import { describe, expect, it } from 'vitest';
// 프리렌더 스크립트는 직접 실행 가드가 있어 import 만으로는 네트워크를 두드리지 않는다 —
// 운영 API 를 치지 않고 렌더 함수를 그대로 검증한다 (dry-verify).
import {
  SIDO_CODES,
  SLICE_CATEGORIES,
  SLICE_WINDOW,
  fetchSidoSlice,
  indexDoc,
  placeDetailPages,
  placeHubPages,
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
      'https://place.1989v.com/sitemap-places-hub.xml',
      'https://place.1989v.com/sitemap-places-1.xml',
      'https://place.1989v.com/sitemap-places-events.xml',
    ]);
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
