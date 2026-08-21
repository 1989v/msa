import { describe, expect, it } from 'vitest';
// 프리렌더 스크립트는 직접 실행 가드가 있어 import 만으로는 네트워크를 두드리지 않는다 —
// 운영 API 를 치지 않고 렌더 함수를 그대로 검증한다 (dry-verify).
import {
  SIDO_CODES,
  indexDoc,
  pickPrerenderDetails,
  renderAttractionDetail,
  renderRegionDetail,
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
    // 특별자치도 승격 후 코드 — admin_regions 와 어긋나면 지역 링크가 전부 죽는다
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

  it('개요 있는 문서는 원본 필드 + 훑은 시도 샤드를 들고 간다', () => {
    const item = indexDoc(raw, '11');
    expect(item).toMatchObject({
      id: 'a1',
      hasOverview: true,
      sidoCode: '11',
      title: 'Dosan Park',
      titleLocal: '도산공원',
      overview: 'A park.',
    });
  });

  it('개요 없는 문서는 sitemap 용 스켈레톤만 — 6만 건 본문을 메모리에 얹지 않는다', () => {
    expect(indexDoc({ ...raw, overview: '' }, '11')).toEqual({ id: 'a1', hasOverview: false });
    expect(indexDoc({ ...raw, overview: '   ' }, '11')).toEqual({ id: 'a1', hasOverview: false });
  });
});

describe('pickPrerenderDetails', () => {
  it('개요 있는 문서만, 사진 있는 쪽 먼저, 상한까지만 고른다', () => {
    const docs = [
      { id: 'no-overview', hasOverview: false },
      { id: 'no-image', hasOverview: true, title: 'a', imageUrl: null },
      { id: 'with-image', hasOverview: true, title: 'b', imageUrl: 'x.jpg' },
    ];
    expect(pickPrerenderDetails(docs, 2).map((d) => d.id)).toEqual(['with-image', 'no-image']);
    expect(pickPrerenderDetails(docs, 1).map((d) => d.id)).toEqual(['with-image']);
  });
});

describe('renderAttractionDetail', () => {
  const html = renderAttractionDetail(SHELL, 'en', doc, {
    region: seoul,
    nearby: [{ id: '7', title: 'Bongeunsa' }],
  });

  it('canonical 은 place 호스트의 상세 주소다', () => {
    expect(html).toContain('<link rel="canonical" href="https://place.1989v.com/en/attractions/42" />');
  });

  it('본문에 h1·주소·개요·주변 링크가 있다 (무 JS 크롤러가 읽는 내용)', () => {
    expect(html).toContain('<h1>Dosan Park</h1>');
    expect(html).toContain('도산대로45길');
    expect(html).toContain('quiet memorial park');
    expect(html).toContain('href="/en/attractions/7"');
    expect(html).toContain('href="/en/regions/11"');
  });

  it('원어 병기명은 별도 요소다 — 제목에 괄호로 합치지 않는다', () => {
    expect(html).toContain('<p>도산공원</p>');
    expect(html).not.toContain('Dosan Park (도산공원)');
  });

  it('TouristAttraction 구조화 데이터와 alternateName 이 실린다', () => {
    expect(html).toContain('"@type":"TouristAttraction"');
    expect(html).toContain('"alternateName":"도산공원"');
  });

  it('관광지 상세에는 hreflang 을 걸지 않는다 — ko/en 은 짝을 모르는 별도 문서다', () => {
    expect(html).not.toContain('hreflang');
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
