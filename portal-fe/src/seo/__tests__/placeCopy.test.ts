import { describe, expect, it } from 'vitest';
import {
  attractionHreflangAlternates,
  attractionMeta,
  placeHubMeta,
  placeHubIntro,
  clampDescription,
  placeItemListJsonLd,
  regionMeta,
  regionIntro,
  regionVisitGuide,
  touristAttractionJsonLd,
} from '../copy.mjs';

const attraction = {
  id: '42',
  lang: 'en',
  title: 'Dosan Park',
  titleLocal: '도산공원',
  category: 'nature',
  address: '서울특별시 강남구 도산대로45길 20',
  latitude: 37.5241,
  longitude: 127.0357,
  imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/1/1.jpg',
  tel: null,
  overview: null,
};

const sido = { code: '50', level: 'SIDO', name: '제주특별자치도', nameEn: 'Jeju', latitude: 33.48, longitude: 126.53 };

describe('관광지 메타 — 의도 키워드', () => {
  it('ko 타이틀은 관광 정보·가는 길·주변 패턴을 따른다', () => {
    const meta = attractionMeta('ko', { ...attraction, title: '도산공원', titleLocal: null });
    expect(meta.title).toContain('도산공원 관광 정보');
    expect(meta.title).toContain('가는 길');
    expect(meta.title).toContain('가볼 만한 곳');
  });

  it('en 타이틀은 Visit {name} + Things to Do 패턴을 따른다', () => {
    const meta = attractionMeta('en', attraction);
    expect(meta.title).toContain('Visit Dosan Park');
    expect(meta.title).toContain('Things to Do Nearby');
  });

  it('titleLocal 을 타이틀에 다시 합치지 않는다', () => {
    expect(attractionMeta('en', attraction).title).not.toContain('도산공원');
  });

  it('개요 없는 문서의 설명은 분류·주소로 채우고 155자 안이다', () => {
    const meta = attractionMeta('en', attraction);
    expect(meta.description).toContain('nature');
    expect(meta.description.length).toBeLessThanOrEqual(155);
    expect(attractionMeta('ko', { ...attraction, title: '도산공원' }).description).toContain('자연');
  });
});

describe('지역·허브 메타', () => {
  it('ko 지역 타이틀은 "{이름} 가볼 만한 곳" 이 앞머리다', () => {
    const meta = regionMeta('ko', sido, 1234);
    expect(meta.title.startsWith('제주특별자치도 가볼 만한 곳')).toBe(true);
    expect(meta.title).toContain('1,234곳');
    expect(meta.description.length).toBeLessThanOrEqual(155);
  });

  it('en 지역 타이틀은 Things to Do in {name} 이 앞머리고 건수 없이도 성립한다', () => {
    expect(regionMeta('en', sido, 321).title.startsWith('Things to Do in Jeju')).toBe(true);
    expect(regionMeta('en', sido, null).title).toContain('Attractions & Map');
  });

  it('허브 타이틀에 지역·의도 키워드가 실린다', () => {
    expect(placeHubMeta('ko').title).toContain('가볼 만한 곳');
    expect(placeHubMeta('en').title).toContain('Things to Do in Korea');
  });
});

describe('구조화 데이터', () => {
  it('titleLocal 은 alternateName 으로 나간다 — name 에 합치지 않는다', () => {
    const ld = touristAttractionJsonLd('en', attraction) as unknown as {
      name: string;
      alternateName?: string;
    };
    expect(ld.name).toBe('Dosan Park');
    expect(ld.alternateName).toBe('도산공원');
  });

  it('titleLocal 이 없거나 같으면 alternateName 을 만들지 않는다', () => {
    const bare = touristAttractionJsonLd('en', { ...attraction, titleLocal: null });
    expect('alternateName' in bare).toBe(false);
    const same = touristAttractionJsonLd('en', { ...attraction, titleLocal: 'Dosan Park' });
    expect('alternateName' in same).toBe(false);
  });

  it('placeItemListJsonLd 는 이름 있는 문서만 상세 URL 로 싣는다', () => {
    const ld = placeItemListJsonLd('ko', [
      { id: '1', title: '경복궁' },
      { id: '2', title: '' },
    ]) as unknown as { numberOfItems: number; itemListElement: Array<{ url: string; name: string }> };
    expect(ld.numberOfItems).toBe(1);
    expect(ld.itemListElement[0].url).toBe('https://place.1989v.com/attractions/1');
    expect(ld.itemListElement[0].name).toBe('경복궁');
  });
});

describe('관광지 상세 hreflang — 언어 대체 짝', () => {
  const pair = [
    { hreflang: 'ko', href: 'https://place.1989v.com/attractions/K' },
    { hreflang: 'en', href: 'https://place.1989v.com/en/attractions/E' },
    { hreflang: 'x-default', href: 'https://place.1989v.com/en/attractions/E' },
  ];

  it('국문 문서 — ko 는 자기, en 은 짝, x-default 는 영문 쪽', () => {
    expect(attractionHreflangAlternates('ko', 'K', 'E')).toEqual(pair);
  });

  it('영문 문서 — 문서 언어로 어느 쪽이 국문인지 정하므로 같은 세 줄이 같은 순서로 나온다', () => {
    expect(attractionHreflangAlternates('en', 'E', 'K')).toEqual(pair);
  });
});


describe('관광 본문 소개 — 메타 제한과 분리', () => {
  it.each(['ko', 'en'])('본문은 원래 지역 설명의 전체 문장이고 메타만 길이 제한을 적용한다: %s', lang => {
    const region = { ...sido, name: '제주특별자치도'.repeat(20), nameEn: 'Jeju Special Self-Governing Province'.repeat(5) };
    const intro = regionIntro(lang, region, 1234);
    expect(intro.length).toBeGreaterThan(155);
    expect(intro).not.toContain('…');
    expect(intro.endsWith(lang === 'en' ? 'from official tourism data.' : '확인하세요.')).toBe(true);
    const meta = regionMeta(lang, region, 1234);
    expect(meta.description).toBe(clampDescription(intro));
    expect(meta.description.length).toBeLessThanOrEqual(155);
    expect(meta.description.endsWith('…')).toBe(true);
  });

  it.each(['ko', 'en'])('알 수 없는 수량은 0으로 표시하지 않고 실제 수량만 표시한다: %s', lang => {
    for (const count of [null, 0]) {
      expect(regionIntro(lang, sido, count)).not.toMatch(/0곳|0 tourist attractions/);
      expect(regionMeta(lang, sido, count).title).not.toMatch(/0곳|0 Attractions/);
    }
    expect(regionIntro(lang, sido, 1234)).toContain('1,234');
    expect(regionVisitGuide(lang, { ...sido, level: 'SIGUNGU' })).toBeNull();
    expect(regionVisitGuide(lang, { ...sido, code: '41' })).toBeNull();
    expect(regionVisitGuide(lang, { ...sido, code: 'toString' })).toBeNull();
  });

  it('국·영 홈 소개는 확정된 한 문단 전체를 제공한다', () => {
    expect(placeHubIntro('ko')).toBe('한국 관광지 탐색에서 지역과 테마별로 가볼 만한 곳을 찾아보세요. 관광지 사진·주소·지도와 제공된 운영시간·방문 정보를 비교하고, 상세 페이지에서 가까운 역과 정류장을 확인할 수 있습니다.');
    expect(placeHubIntro('en')).toBe('Find places to visit in South Korea by region and theme. Compare attraction photos, addresses, maps and available opening hours and visitor information, then check nearby stations and bus stops on each detail page.');
  });
});
