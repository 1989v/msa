import { describe, expect, it } from 'vitest';
import {
  attractionHreflangAlternates,
  attractionMeta,
  placeHubMeta,
  placeItemListJsonLd,
  regionMeta,
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
