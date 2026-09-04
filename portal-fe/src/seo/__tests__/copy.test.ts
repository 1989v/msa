import { describe, expect, it } from 'vitest';
import {
  clampDescription,
  detailMeta,
  gamePath,
  gameUrl,
  genreFromSlug,
  genreSlug,
  hreflangAlternates,
  hubMeta,
  socialImage,
  PLACE_ORIGIN,
  PORTAL_PAGES,
  attractionMeta,
  attractionPath,
  attractionUrl,
  collectionPageJsonLd,
  placeBrand,
  placeHubMeta,
  placeUrl,
  touristAttractionJsonLd,
} from '../copy.mjs';

const game = {
  slug: 'spud-arena',
  title: '감자 투기장',
  titleEn: 'Spud Arena',
  description: '감자 전사를 골라 파도처럼 몰려오는 적을 막아내는 아레나 액션. 라운드마다 상점에서 장비를 갈아끼운다.',
  descriptionEn: 'Pick a spud warrior and survive waves of enemies in this arena brawler. Re-equip between rounds.',
  genre: 'ACTION',
  thumbnailUrl: '/games/thumbs/shots/spud-arena.jpg',
  ratingAvg: 8.4,
  ratingCount: 12,
  developerName: 'kgd',
};

describe('게임 URL 규칙', () => {
  it('한국어는 루트, 영문은 /en 프리픽스', () => {
    expect(gamePath('ko', '/games/spud-arena')).toBe('/games/spud-arena');
    expect(gamePath('en', '/games/spud-arena')).toBe('/en/games/spud-arena');
  });

  it('허브는 빈 sub 로도 슬래시가 남는다 — canonical 에 호스트만 남으면 안 된다', () => {
    expect(gameUrl('ko')).toBe('https://game.1989v.com/');
    expect(gameUrl('en')).toBe('https://game.1989v.com/en');
  });

  it('hreflang 은 ko/en/x-default 세 쌍이고 x-default 는 영문을 가리킨다', () => {
    const alternates = hreflangAlternates('/games/spud-arena');
    expect(alternates.map((a) => a.hreflang)).toEqual(['ko', 'en', 'x-default']);
    expect(alternates[2].href).toBe(alternates[1].href);
  });

  it('장르 슬러그는 enum 과 왕복한다', () => {
    expect(genreSlug('ACTION')).toBe('action');
    expect(genreFromSlug('action')).toBe('ACTION');
    expect(genreFromSlug('없는장르')).toBeNull();
  });
});

describe('메타 카피', () => {
  it('상세 타이틀은 언어별 포맷을 따른다', () => {
    expect(detailMeta('ko', game).title).toBe('감자 투기장 — 무료 온라인 플레이 | 1989v 게임');
    expect(detailMeta('en', game).title).toBe('Spud Arena — Play Free Online | 1989v 게임');
  });

  it('설명이 짧으면 장르 문구를 덧붙여 빈약한 스니펫을 막는다', () => {
    const short = { ...game, description: '짧은 설명.' };
    expect(detailMeta('ko', short).description).toContain('무료 액션 게임');
  });

  it('description 은 스니펫 상한에서 잘린다', () => {
    expect(clampDescription('가'.repeat(300)).length).toBeLessThanOrEqual(155);
    expect(clampDescription('짧다')).toBe('짧다');
  });

  it('허브 설명에 게임 수가 들어간다', () => {
    expect(hubMeta('ko', 28).description).toContain('28종');
    expect(hubMeta('en', 28).description).toContain('28 free browser games');
  });
});

describe('소셜 카드 이미지', () => {
  it('래스터 썸네일만 절대 URL 로 노출한다', () => {
    expect(socialImage(game)).toBe('https://game.1989v.com/games/thumbs/shots/spud-arena.jpg');
  });

  it('SVG 는 언퍼러가 렌더하지 못하므로 제외한다', () => {
    expect(socialImage({ ...game, thumbnailUrl: '/games/thumbs/art/spud-arena.svg' })).toBeNull();
  });
});

describe('place (K-관광)', () => {
  const attraction = {
    id: '1',
    lang: 'ko',
    title: '경복궁',
    category: 'history',
    address: '서울특별시 종로구 사직로 161',
    latitude: 37.5760307,
    longitude: 126.9767218,
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/98/3487598_image2_1.jpg',
    tel: null,
    overview: '경복궁은 1392년 조선 건국 후 1395년에 창건한 조선왕조 제일의 법궁이다. 백악산을 주산으로 넓은 지형에 건물을 배치하였다.',
  };

  it('허브는 ko 루트 · en 은 /en (게임과 같은 규칙)', () => {
    expect(placeUrl('ko')).toBe('https://place.1989v.com/');
    expect(placeUrl('en')).toBe('https://place.1989v.com/en');
  });

  it('상세 주소에 attractions 를 남겨 영문 키워드를 URL 에 싣는다', () => {
    expect(attractionUrl('ko', '1')).toBe('https://place.1989v.com/attractions/1');
    expect(attractionPath('en', '21')).toBe('/en/attractions/21');
  });

  it('개요가 있으면 스니펫으로 쓰고 없으면 위치·분류로 채운다', () => {
    expect(attractionMeta('ko', attraction).description).toContain('조선왕조 제일의 법궁');
    const bare = { ...attraction, overview: null };
    expect(attractionMeta('ko', bare).description).toContain('역사');
    expect(attractionMeta('en', { ...bare, title: 'Gyeongbokgung' }).description).toContain('history');
  });

  it('TouristAttraction 구조화 데이터에 좌표와 주소가 실린다', () => {
    const ld = touristAttractionJsonLd('ko', attraction) as unknown as {
      '@type': string;
      url: string;
      geo: { latitude: number };
      address: { addressCountry: string };
    };
    expect(ld['@type']).toBe('TouristAttraction');
    expect(ld.geo.latitude).toBeCloseTo(37.576, 3);
    expect(ld.address.addressCountry).toBe('KR');
    expect(ld.url).toBe('https://place.1989v.com/attractions/1');
  });

  it('CollectionPage 는 넘긴 사이트에 소속시킨다 — 기본값(게임)이 새면 브랜드가 어긋난다', () => {
    const meta = placeHubMeta('en');
    const ld = collectionPageJsonLd('en', meta, placeUrl('en'), {
      name: placeBrand('en'),
      url: PLACE_ORIGIN,
    }) as unknown as { isPartOf: { url: string; name: string } };
    expect(ld.isPartOf.url).toBe('https://place.1989v.com');
    expect(ld.isPartOf.name).toBe('K-Tour');
  });
});

describe('포털 페이지 카피', () => {
  it('프리렌더 대상 경로가 모두 정의돼 있다', () => {
    expect(Object.keys(PORTAL_PAGES)).toEqual(['/', '/tech', '/portfolio', '/shop', '/privacy']);
    const pages = Object.entries(PORTAL_PAGES) as [string, { title: string; description: string }][];
    for (const [path, meta] of pages) {
      expect(meta.title, path).toBeTruthy();
      expect(meta.description.length, path).toBeLessThanOrEqual(200);
    }
  });
});
