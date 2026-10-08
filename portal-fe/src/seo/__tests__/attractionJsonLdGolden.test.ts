import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { attractionBreadcrumbJsonLd, attractionJsonLd, attractionMeta } from '../copy.mjs';
import { type IndexDoc, toApi } from './indexDocToApi';

/**
 * 관광지 JSON-LD 골든 픽스처 생성기.
 *
 * 서버 렌더(search `AttractionPageRenderer`)와 화면(useSeo)은 **같은 JSON-LD** 를 심어야 한다 —
 * 하이드레이션이 서버가 심은 블록을 갈아끼우므로 어긋나면 렌더 전후로 구조화 데이터가 바뀐다.
 * 그래서 이 파일이 `copy.mjs` 의 실제 함수로 기대값을 만들어 search 테스트 리소스에 쓰고,
 * Kotlin `AttractionJsonLdParityTest` 가 같은 입력을 렌더해 비교한다.
 * CI 는 이 테스트를 돌린 뒤 `git diff --exit-code` 로 픽스처가 최신인지 확인한다 —
 * copy.mjs 만 고치고 픽스처를 안 올리면 거기서 막힌다.
 *
 * 입력은 **색인 문서(`_source`) 그대로**다 — Kotlin 은 이것을 `AttractionSearchDocument` 로 역직렬화해
 * 앱의 읽기 경로를 그대로 탄다(필드를 손으로 옮기지 않으므로 새 필드가 조용히 빠지지 않는다).
 * 화면이 받는 검색 API 응답과 이름이 다른 필드만 [toApi](`indexDocToApi.ts`)가 바꾼다 — 여기서 하나를 빠뜨리면
 * 이쪽 JSON-LD 에서 그 값이 사라져 Kotlin 비교가 빨개진다.
 *
 * 행사 상태는 `TODAY` 기준이다. JSON-LD 자체는 오늘에 따라 바뀌지 않지만, Kotlin 이 같은 날로
 * 진행 중·종료 사례가 실제로 있는지 판정한다.
 */
const GOLDEN = resolve(__dirname, '../../../../search/app/src/test/resources/render/jsonld-golden.json');

const TODAY = '2026-10-02';

const base = {
  contentId: '126508',
  category: 'history',
  address: '서울특별시 종로구 사직로 161',
  location: { lat: 37.5796, lon: 126.977 },
  imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg',
  tel: '02-3700-3900',
  ldongRegnCd: '11',
  sidoName: '서울특별시',
};

const longOverview =
  '조선 왕조 제일의 법궁이다.<br />북으로 북악산을 기대어 자리 잡았고 정문인 광화문 앞으로는 넓은 육조거리가 펼쳐져 있었다. ' +
  '&lt;script&gt;alert(1)&lt;/script&gt; 같은 원문도 글자로만 남아야 한다. 요금은 $1 이 아니라 3,000원이다. ' +
  '태조 이성계가 한양으로 도읍을 옮긴 뒤 1395년에 지었으며, 임진왜란 때 불탄 뒤 고종 때 다시 지었다. ' +
  '근정전·경회루·향원정 같은 건물이 남아 있고, 국립고궁박물관과 국립민속박물관이 궁 안팎에 있다. ' +
  '수문장 교대 의식은 매일 정해진 시각에 광화문 앞에서 열린다.';

const cases = [
  {
    name: 'ko-weekly-free',
    input: {
      ...base,
      id: '1001',
      lang: 'ko',
      title: '경복궁',
      titleLocal: null,
      overview: longOverview,
      closureState: 'WEEKLY',
      closedWeekdays: ['TUE'],
      attrAdmission: 'FREE',
    },
  },
  {
    name: 'ko-always-open-paid',
    input: {
      ...base,
      id: '1002',
      lang: 'ko',
      title: '남산서울타워',
      titleLocal: 'N서울타워',
      overview: '서울의 전망대.\n\n\n\n야경이 좋다 &middot; 연중무휴',
      closureState: 'ALWAYS_OPEN',
      closedWeekdays: null,
      attrAdmission: 'PAID',
    },
  },
  {
    name: 'ko-unknown-no-overview-no-sido',
    input: {
      ...base,
      id: '1003',
      lang: 'ko',
      title: '이름만 있는 곳',
      titleLocal: null,
      tel: null,
      imageUrl: null,
      ldongRegnCd: null,
      sidoName: null,
      overview: null,
      closureState: 'UNKNOWN',
      closedWeekdays: null,
      attrAdmission: 'UNKNOWN',
    },
  },
  {
    name: 'en-no-weekly-free',
    input: {
      ...base,
      id: '2001',
      lang: 'en',
      title: 'Dosan Park',
      titleLocal: '도산공원',
      category: 'nature',
      address: '20, Dosan-daero 45-gil, Gangnam-gu, Seoul',
      overview: 'Dosan Park honors Ahn Chang-ho&rsquo;s legacy.<br>It&#8217;s quiet&nbsp;and green.',
      closureState: 'NO_WEEKLY',
      closedWeekdays: null,
      attrAdmission: 'FREE',
    },
  },
  {
    name: 'en-weekend-closed-paid',
    input: {
      ...base,
      id: '2002',
      lang: 'en',
      title: 'War Memorial of Korea',
      titleLocal: null,
      category: 'culture',
      address: '29, Itaewon-ro, Yongsan-gu, Seoul',
      overview: 'Short.',
      closureState: 'WEEKLY',
      closedWeekdays: ['MON', 'SUN'],
      attrAdmission: 'PAID',
    },
  },
  {
    // 속성 필드가 생기기 전에 색인된 문서 — 필드 자체가 없다
    name: 'en-legacy-without-attributes',
    input: {
      ...base,
      id: '2003',
      lang: 'en',
      title: 'Bukchon Hanok Village',
      titleLocal: '북촌한옥마을',
      category: 'culture',
      address: '37, Gyedong-gil, Jongno-gu, Seoul',
      overview: null,
    },
  },
  {
    name: 'ko-event-ongoing',
    input: {
      ...base,
      id: '5001',
      contentId: '3113671',
      lang: 'ko',
      contentTypeId: '15',
      title: '서울세계불꽃축제',
      titleLocal: null,
      category: 'culture',
      address: '서울특별시 영등포구 여의동로 330',
      overview: '가을 밤하늘을 수놓는 불꽃 축제다.<br>한강공원 일대에서 열린다.',
      eventStartEffective: '2026-09-28',
      eventEndEffective: '2026-10-05',
      introRaw: JSON.stringify({
        contentid: '3113671',
        eventplace: '여의도 한강공원 <b>일대</b>',
        playtime: '19:00~21:00',
        usetimefestival: '무료',
        sponsor1: '한화',
        eventhomepage: '<a href="https://example.com">홈페이지</a>',
      }),
    },
  },
  {
    name: 'ko-event-ended-no-place',
    input: {
      ...base,
      id: '5002',
      contentId: '2990001',
      lang: 'ko',
      contentTypeId: '15',
      title: '지난 여름 축제',
      titleLocal: null,
      category: 'culture',
      tel: null,
      overview: null,
      eventStartEffective: '2026-08-01',
      eventEndEffective: '2026-08-10',
      introRaw: null,
    },
  },
  {
    // 날짜가 없는 행사(UNKNOWN) — 기간 없이 장소만
    name: 'en-event-unknown-dates',
    input: {
      ...base,
      id: '6001',
      contentId: '3001001',
      lang: 'en',
      contentTypeId: '85',
      title: 'Lantern Festival',
      titleLocal: null,
      category: 'culture',
      address: '1, Cheonggyecheon-ro, Jung-gu, Seoul',
      overview: 'Lanterns float along the stream.',
      introRaw: '{"eventplace":"Cheonggyecheon Stream"}',
    },
  },
  {
    name: 'ko-stay',
    input: {
      ...base,
      id: '5101',
      contentId: '142785',
      lang: 'ko',
      contentTypeId: '32',
      title: '한옥 스테이',
      titleLocal: null,
      category: 'stay',
      overview: '북촌의 한옥 숙소.',
      introRaw: JSON.stringify({
        checkintime: '15:00',
        checkouttime: '11:00',
        roomcount: '5',
        reservationurl: 'https://booking.example.com/r?id=1',
        reservationlodging: '02-000-0000',
      }),
    },
  },
  {
    name: 'en-stay-no-geo-fields',
    input: {
      ...base,
      id: '6101',
      contentId: '2700001',
      lang: 'en',
      contentTypeId: '80',
      title: 'Seoul Guesthouse',
      titleLocal: null,
      category: 'stay',
      address: null,
      tel: null,
      imageUrl: null,
      overview: null,
    },
  },
  {
    name: 'ko-course',
    input: {
      ...base,
      id: '5201',
      contentId: '1965837',
      lang: 'ko',
      contentTypeId: '25',
      title: '부산 바다 하루 코스',
      titleLocal: null,
      category: 'etc',
      overview: '바다를 따라 걷는 코스.',
      introRaw: '{"distance":"12.5km","taketime":"당일"}',
      // 이름 순과 다른 순서 — 원천 순서가 그대로 나가야 한다
      courseStops: [
        { order: 0, contentId: '126081', name: '해운대해수욕장', attractionId: 7001 },
        { order: 1, contentId: '999999', name: '광안리 카페거리', attractionId: null },
        { order: 2, contentId: '126101', name: '감천문화마을', attractionId: 7003 },
      ],
    },
  },
  {
    // 이름이 「코스」로 끝나지 않는 코스 — 제목·설명에 「여행코스」를 붙인다
    name: 'ko-course-plain-name',
    input: {
      ...base,
      id: '5202',
      contentId: '1965838',
      lang: 'ko',
      contentTypeId: '25',
      title: '남해 바래길 드라이브',
      titleLocal: null,
      category: 'etc',
      overview: '해안 도로.',
      introRaw: '{"distance":"40km","taketime":"반나절"}',
      courseStops: [{ order: 0, contentId: '126081', name: '해운대해수욕장', attractionId: 7001 }],
    },
  },
  {
    // 원천이 http 로 준 사진 — 표시 시점에 https 로 바꿔 싣는다(원천 값은 그대로)
    name: 'ko-http-image',
    input: {
      ...base,
      id: '1004',
      lang: 'ko',
      title: '덕수궁',
      titleLocal: null,
      imageUrl: 'http://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg',
      overview: '대한제국의 황궁이다.',
      closureState: 'WEEKLY',
      closedWeekdays: ['MON'],
      attrAdmission: 'PAID',
    },
  },
  {
    // 공공누리 제1유형 사진 + 시군구까지 아는 문서 — ImageObject 에 license, 소속 지역과 breadcrumb 에 시군구
    name: 'ko-photo-type1-sigungu',
    input: {
      ...base,
      id: '1101',
      lang: 'ko',
      contentTypeId: '12',
      title: '창덕궁',
      titleLocal: null,
      overview: '조선의 이궁이다.',
      copyrightDivCd: 'Type1',
      ldongSignguCd: '110',
      sigunguName: '종로구',
      regionTypeCount: 40,
      regionCategoryCount: 5,
      lclsSystm3Name: '고궁',
      closureState: 'WEEKLY',
      closedWeekdays: ['MON'],
      attrAdmission: 'PAID',
    },
  },
  {
    // 제3유형 사진, 지역 집계가 없는 문서 — 소속 지역은 시도까지
    name: 'ko-photo-type3-no-sigungu',
    input: {
      ...base,
      id: '1102',
      lang: 'ko',
      contentTypeId: '12',
      title: '창경궁',
      titleLocal: null,
      overview: '성종 때 지은 궁이다.',
      copyrightDivCd: 'Type3',
      closureState: 'UNKNOWN',
      closedWeekdays: null,
      attrAdmission: 'UNKNOWN',
    },
  },
  {
    // 제2유형(상업 이용 금지)은 license 를 싣지 않는다. 시군구 이름은 원문 정규화를 거친다
    name: 'en-photo-type2-sigungu',
    input: {
      ...base,
      id: '2101',
      lang: 'en',
      contentTypeId: '76',
      title: 'Changgyeonggung Palace',
      titleLocal: '창경궁',
      category: 'history',
      address: '185, Changgyeonggung-ro, Jongno-gu, Seoul',
      overview: 'A palace.',
      copyrightDivCd: 'Type2',
      ldongSignguCd: '110',
      sigunguName: 'Jongno&#8209;gu ',
      regionTypeCount: 12,
      regionCategoryCount: null,
      lclsSystm3Name: null,
    },
  },
  {
    // 사진 없음 — 유형이 Type1 이어도 image 자체를 싣지 않는다. 시도가 없으면 시군구 단계도 없다
    name: 'ko-no-photo-sigungu-without-sido',
    input: {
      ...base,
      id: '1103',
      lang: 'ko',
      contentTypeId: '12',
      title: '사진 없는 곳',
      titleLocal: null,
      imageUrl: null,
      ldongRegnCd: null,
      sidoName: null,
      overview: null,
      copyrightDivCd: 'Type1',
      ldongSignguCd: '110',
      sigunguName: '종로구',
      regionTypeCount: 3,
    },
  },
];

describe('관광지 JSON-LD 골든 픽스처 (서버 렌더 패리티)', () => {
  const rendered = cases.map(({ name, input }) => {
    const api = toApi(input as IndexDoc);
    const meta = attractionMeta(api.lang, api);
    return {
      name,
      input,
      // 제목·설명도 서버가 같은 문자열을 내야 한다 — 하이드레이션이 <title>·description 을 덮는다
      meta: { title: meta.title, description: meta.description },
      jsonLd: [attractionJsonLd(api.lang, api), attractionBreadcrumbJsonLd(api.lang, api)],
    };
  });
  const primary = (name: string) => rendered.find((c) => c.name === name)!.jsonLd[0] as Record<string, any>;

  it('해석된 정기휴무는 여는 요일로, 해석된 요금은 isAccessibleForFree 로 나간다', () => {
    const weekly = primary('ko-weekly-free');
    expect(weekly.isAccessibleForFree).toBe(true);
    expect((weekly.openingHoursSpecification as { dayOfWeek: string[] }).dayOfWeek).not.toContain(
      'https://schema.org/Tuesday',
    );
  });

  it('모르는 값은 필드를 싣지 않는다 — 「무료 아님」「매일 연다」로 바꾸지 않는다', () => {
    for (const name of ['ko-unknown-no-overview-no-sido', 'en-legacy-without-attributes']) {
      const json = primary(name);
      expect(json).not.toHaveProperty('openingHoursSpecification');
      expect(json).not.toHaveProperty('isAccessibleForFree');
    }
  });

  it('유형별 @type — 행사 Event · 숙박 LodgingBusiness · 코스 TouristTrip, 나머지는 TouristAttraction', () => {
    const types = new Set(rendered.map((c) => (c.jsonLd[0] as Record<string, unknown>)['@type']));
    for (const t of ['Event', 'LodgingBusiness', 'TouristTrip', 'TouristAttraction']) expect(types).toContain(t);
    expect(primary('ko-event-ongoing')['@type']).toBe('Event');
    expect(primary('en-stay-no-geo-fields')['@type']).toBe('LodgingBusiness');
  });

  it('행사는 기간과 장소를 싣고, 날짜를 모르면 기간을 싣지 않는다', () => {
    const ongoing = primary('ko-event-ongoing');
    expect(ongoing.startDate).toBe('2026-09-28');
    expect(ongoing.endDate).toBe('2026-10-05');
    expect(ongoing.location.name).toBe('여의도 한강공원 일대');
    const unknown = primary('en-event-unknown-dates');
    expect(unknown).not.toHaveProperty('startDate');
    expect(unknown.location.name).toBe('Cheonggyecheon Stream');
    // 장소 원문이 없으면 행사 이름
    expect(primary('ko-event-ended-no-place').location.name).toBe('지난 여름 축제');
  });

  it('숙박 JSON-LD 에 예약 원문이 실리지 않는다', () => {
    const stayInput = cases.find((c) => c.name === 'ko-stay')!.input as { introRaw: string };
    expect(JSON.parse(stayInput.introRaw)).toHaveProperty('reservationurl');
    expect(JSON.stringify(primary('ko-stay'))).not.toContain('booking.example.com');
  });

  it('코스 itinerary 는 원천 순서 그대로, 매칭된 지점만 주소를 갖는다', () => {
    const items = primary('ko-course').itinerary.itemListElement as Array<{ position: number; item: Record<string, unknown> }>;
    expect(items.map((i) => i.item.name)).toEqual(['해운대해수욕장', '광안리 카페거리', '감천문화마을']);
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items[0].item.url).toBe('https://place.1989v.com/attractions/7001');
    expect(items[1].item).not.toHaveProperty('url');
  });

  it('제목은 유형에 맞춘다 — 행사는 일정·장소, 숙박은 입실, 코스는 코스 구성, 관광지는 기존 그대로', () => {
    const title = (name: string) => rendered.find((c) => c.name === name)!.meta.title;
    expect(title('ko-event-ongoing')).toBe('서울세계불꽃축제 행사 정보 — 일정 · 장소 · 주변 가볼 만한 곳 | K-관광');
    expect(title('en-event-unknown-dates')).toBe('Lantern Festival — Dates, Venue & Things to Do Nearby | K-Tour');
    expect(title('ko-stay')).toBe('한옥 스테이 숙박 정보 — 입실·퇴실 · 주변 가볼 만한 곳 | K-관광');
    expect(title('en-stay-no-geo-fields')).toBe('Seoul Guesthouse — Stay Info, Check-in & Things to Do Nearby | K-Tour');
    // 이름이 이미 「코스」로 끝나면 「여행코스」를 덧붙이지 않는다(「… 코스 여행코스」 중복)
    expect(title('ko-course')).toBe('부산 바다 하루 코스 — 코스 구성 · 거리 · 소요 시간 | K-관광');
    expect(title('ko-course-plain-name')).toBe('남해 바래길 드라이브 여행코스 — 코스 구성 · 거리 · 소요 시간 | K-관광');
    const description = (name: string) => rendered.find((c) => c.name === name)!.meta.description;
    expect(description('ko-course')).toMatch(/^부산 바다 하루 코스입니다\. /);
    expect(description('ko-course-plain-name')).toMatch(/^남해 바래길 드라이브 여행코스입니다\. /);
    expect(title('ko-weekly-free')).toBe('경복궁 관광 정보 — 가는 길 · 주변 가볼 만한 곳 | K-관광');
    expect(title('en-no-weekly-free')).toBe('Visit Dosan Park — Map, Photos & Things to Do Nearby | K-Tour');
    // 개요가 짧은 행사는 유형 설명으로 채운다
    expect(rendered.find((c) => c.name === 'ko-event-ended-no-place')!.meta.description).toContain('에서 열리는 축제·행사입니다');
  });

  it('http tong 원천 사진은 https 로 싣는다', () => {
    const input = cases.find((c) => c.name === 'ko-http-image')!.input as { imageUrl: string };
    expect(input.imageUrl).toMatch(/^http:\/\/tong\./);
    expect(primary('ko-http-image').image.contentUrl).toBe('https://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg');
  });

  it('관광지 사진은 ImageObject — 공공누리 제1·3유형만 license 절대 주소를 싣는다', () => {
    expect(primary('ko-photo-type1-sigungu').image).toEqual({
      '@type': 'ImageObject',
      contentUrl: 'https://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg',
      license: 'https://www.kogl.or.kr/info/licenseType1.do',
      creditText: '한국관광공사',
    });
    expect(primary('ko-photo-type3-no-sigungu').image.license).toBe('https://www.kogl.or.kr/info/licenseType3.do');
    expect(primary('en-photo-type2-sigungu').image).not.toHaveProperty('license');
    expect(primary('ko-weekly-free').image).not.toHaveProperty('license');
    expect(primary('ko-weekly-free').image.creditText).toBe('한국관광공사');
    expect(primary('ko-no-photo-sigungu-without-sido')).not.toHaveProperty('image');
  });

  it('행사·숙박·코스의 image 는 지금처럼 주소 문자열이다', () => {
    expect(typeof primary('ko-event-ongoing').image).toBe('string');
    expect(typeof primary('ko-stay').image).toBe('string');
  });

  it('containedInPlace — 시군구 › 시도, 이름만. 모르는 단계는 뺀다', () => {
    expect(primary('ko-photo-type1-sigungu').containedInPlace).toEqual({
      '@type': 'AdministrativeArea',
      name: '종로구',
      containedInPlace: { '@type': 'AdministrativeArea', name: '서울특별시' },
    });
    expect(primary('en-photo-type2-sigungu').containedInPlace.name).toBe('Jongno\u2011gu');
    expect(primary('ko-photo-type3-no-sigungu').containedInPlace).toEqual({ '@type': 'AdministrativeArea', name: '서울특별시' });
    expect(primary('ko-no-photo-sigungu-without-sido').containedInPlace).toEqual({ '@type': 'AdministrativeArea', name: '종로구' });
    expect(primary('ko-unknown-no-overview-no-sido')).not.toHaveProperty('containedInPlace');
  });

  it('BreadcrumbList 는 시군구까지 안다 — 시도·시군구 코드가 둘 다 있을 때만', () => {
    const trail = (name: string) =>
      (rendered.find((c) => c.name === name)!.jsonLd[1] as { itemListElement: Array<{ name: string; item: string }> })
        .itemListElement.map((i) => [i.name, i.item]);
    expect(trail('ko-photo-type1-sigungu')).toEqual([
      ['한국 관광지 탐색', 'https://place.1989v.com/'],
      ['서울특별시', 'https://place.1989v.com/regions/11'],
      ['종로구', 'https://place.1989v.com/regions/11110'],
      ['창덕궁', 'https://place.1989v.com/attractions/1101'],
    ]);
    expect(trail('ko-photo-type3-no-sigungu')).toHaveLength(3);
    expect(trail('ko-no-photo-sigungu-without-sido')).toHaveLength(2);
  });

  it('골든 파일을 쓴다 — CI 가 git diff 로 최신인지 본다', () => {
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify({ today: TODAY, cases: rendered }, null, 2)}\n`);
    expect(rendered).toHaveLength(cases.length);
  });
});
