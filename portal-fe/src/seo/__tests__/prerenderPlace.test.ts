import { describe, expect, it } from 'vitest';
// 프리렌더 스크립트는 직접 실행 가드가 있어 import 만으로는 네트워크를 두드리지 않는다 —
// 운영 API 를 치지 않고 렌더 함수를 그대로 검증한다 (dry-verify).
import {
  SIDO_CODES,
  indexDoc,
  placeDetailPages,
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
  it('시도 17개, 전부 유일한 2자리 코드다 — 구 areaCode 축은 43% 가 비어 있어 쓰지 않는다', () => {
    expect(SIDO_CODES).toHaveLength(17);
    expect(new Set(SIDO_CODES).size).toBe(17);
    for (const code of SIDO_CODES) expect(code).toMatch(/^\d{2}$/);
    // 특별자치도 승격 후 코드 — administrative_regions 와 어긋나면 지역 링크가 전부 죽는다
    expect(SIDO_CODES).toContain('51'); // 강원
    expect(SIDO_CODES).toContain('52'); // 전북
    expect(SIDO_CODES).toContain('50'); // 제주
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
