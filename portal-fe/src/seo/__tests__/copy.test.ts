import { describe, expect, it } from 'vitest';
import { CARDS } from '../../../scripts/make-og-cards.mjs';
import {
  definedTermSetJsonLd,
  techCategoryFromSlug,
  techCategorySlug,
  techGlossaryMeta,
  blogHubMeta,
  blogPostMeta,
  dealHubMeta,
  imageMimeType,
  rankHubMeta,
  blogPostingJsonLd,
  personJsonLd,
  personRef,
  sourceText,
  PERSON_ID,
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

describe('Person 엔티티 — 사이트 전체를 하나의 @id 로 잇는다', () => {
  it('전체 노드는 실재하는 프로필만 sameAs 로 적는다', () => {
    const person = personJsonLd();
    expect(person['@id']).toBe(PERSON_ID);
    expect(person.sameAs).toContain('https://github.com/1989v');
    expect(person.sameAs.every((u: string) => u.startsWith('https://'))).toBe(true);
  });

  it('참조는 @id 만 갖는다 — sameAs 를 페이지마다 복제하지 않는다', () => {
    expect(personRef['@id']).toBe(PERSON_ID);
    expect(personRef).not.toHaveProperty('sameAs');
  });

  it('운영자 글은 같은 @id 로 묶이고, 다른 저자는 자기 작성자 공간이 정체성이다', () => {
    // author 는 두 모양 중 하나라 유니온이다 — 검사에서는 키로 읽는다
    const authorOf = (handle: string): Record<string, unknown> =>
      blogPostingJsonLd({ title: 't', slug: 's', author: { handle, displayName: '이름' } })
        .author as Record<string, unknown>;
    expect(authorOf('kgd')['@id']).toBe(PERSON_ID);
    expect(authorOf('someone')['@id']).toBeUndefined();
    expect(authorOf('someone').url).toContain('/authors/someone');
  });
});

describe('sourceText — 원천 마크업 정리', () => {
  it('태그와 관측된 엔티티를 푼다', () => {
    expect(sourceText('a<br />b')).toBe('a\nb');
    expect(sourceText('It&rsquo;s')).toBe('It’s');
    expect(sourceText('<div class="x">y</div>')).toBe('y');
  });

  it('모르는 엔티티는 건드리지 않는다 — 추측해서 바꾸면 뜻이 달라진다', () => {
    expect(sourceText('&zzz;')).toBe('&zzz;');
  });
});

describe('소셜 카드 — 선언한 주소에 파일이 있어야 한다', () => {
  // 없는 파일을 og:image 로 선언하면 언퍼러는 '카드 없음' 이 아니라 **깨진 카드**를 그린다.
  // 카드 목록의 단일 원본은 make-og-cards.mjs 이고, 여기서 그 짝을 지킨다.
  it('meta 가 가리키는 key 는 굽는 목록에 전부 있다', () => {
    const baked = new Set(CARDS.map((c) => c.key));
    const declared = [
      placeHubMeta('ko').image,
      placeHubMeta('en').image,
      dealHubMeta().image,
      rankHubMeta().image,
      blogHubMeta(3).image,
    ];
    for (const url of declared) {
      expect(url, 'meta 에 카드 주소가 없다').toBeTruthy();
      const key = url!.split('/og/')[1]?.replace('.png', '');
      expect(baked, `굽지 않는 카드를 선언했다: ${url}`).toContain(key);
    }
  });

  it('카드 주소는 그 면의 호스트로 만든다 — 절대 URL 이어야 언퍼러가 받는다', () => {
    expect(placeHubMeta('ko').image).toBe(`${PLACE_ORIGIN}/og/place.png`);
    expect(blogHubMeta(1).image?.startsWith('https://')).toBe(true);
  });

  it('표지가 있는 글은 표지가 이긴다 — 카드는 없을 때만 받는다', () => {
    expect(blogPostMeta({ title: 't', slug: 's', coverImageUrl: 'https://x/y.jpg' }).image)
      .toBe('https://x/y.jpg');
    expect(blogPostMeta({ title: 't', slug: 's', coverImageUrl: null }).image)
      .toContain('/og/blog.png');
  });
});

describe('imageMimeType — 확장자에서 읽는다', () => {
  it('고정 png 를 적으면 jpg 사진에 거짓 타입을 붙이게 된다', () => {
    expect(imageMimeType('https://x/a.jpg')).toBe('image/jpeg');
    expect(imageMimeType('https://x/a.JPEG')).toBe('image/jpeg');
    expect(imageMimeType('https://x/a.png?v=2')).toBe('image/png');
    expect(imageMimeType('https://x/a.svg')).toBeNull();
    expect(imageMimeType('https://x/noext')).toBeNull();
  });
});

describe('/tech 분류별 용어집', () => {
  const items = [
    { conceptId: 'array', name: '배열', category: 'DATA_STRUCTURE', description: '같은 타입을 연속 배치', synonyms: ['array'] },
    { conceptId: 'graph', name: '그래프', category: 'DATA_STRUCTURE', description: '노드와 간선', synonyms: [] },
    { conceptId: 'thin', name: '풀이없음', category: 'DATA_STRUCTURE', description: '', synonyms: [] },
  ];

  it('주소는 코드가 아니라 뜻이 읽히는 슬러그다', () => {
    expect(techCategorySlug('DATA_STRUCTURE')).toBe('data-structure');
    expect(techCategoryFromSlug('data-structure')).toBe('DATA_STRUCTURE');
    expect(techCategoryFromSlug('nope-xyz')).toBeNull();
  });

  it('풀이가 빈 용어는 DefinedTerm 에 넣지 않는다 — 이름만 있는 항목은 정의가 아니다', () => {
    const set = definedTermSetJsonLd('DATA_STRUCTURE', items);
    expect(set['@type']).toBe('DefinedTermSet');
    expect(set.hasDefinedTerm).toHaveLength(2);
    expect(set.hasDefinedTerm.map((t: { name: string }) => t.name)).not.toContain('풀이없음');
  });

  it('동의어가 있을 때만 alternateName 을 단다', () => {
    const terms = definedTermSetJsonLd('DATA_STRUCTURE', items).hasDefinedTerm;
    expect(terms[0]).toHaveProperty('alternateName', ['array']);
    expect(terms[1]).not.toHaveProperty('alternateName');
  });

  it('제목이 분류명과 개수를 함께 싣는다 — 정의형 질의의 착지점이다', () => {
    const meta = techGlossaryMeta('DATA_STRUCTURE', items);
    expect(meta.title).toContain('자료구조 용어집');
    expect(meta.title).toContain('3개');
    expect(meta.canonical).toBe('https://1989v.com/tech/data-structure');
  });
});
