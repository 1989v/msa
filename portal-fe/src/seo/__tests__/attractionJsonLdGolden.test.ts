import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { attractionBreadcrumbJsonLd, touristAttractionJsonLd } from '../copy.mjs';

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
 * 입력 필드 이름은 검색 색인 표기다(`closureState` · `closedWeekdays` · `attrAdmission`, `sidoCode` = 법정동 시도).
 */
const GOLDEN = resolve(__dirname, '../../../../search/app/src/test/resources/render/jsonld-golden.json');

const base = {
  contentId: '126508',
  category: 'history',
  address: '서울특별시 종로구 사직로 161',
  latitude: 37.5796,
  longitude: 126.977,
  imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg',
  tel: '02-3700-3900',
  sidoCode: '11',
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
      sidoCode: null,
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
];

describe('관광지 JSON-LD 골든 픽스처 (서버 렌더 패리티)', () => {
  const rendered = cases.map(({ name, input }) => ({
    name,
    input,
    jsonLd: [touristAttractionJsonLd(input.lang, input), attractionBreadcrumbJsonLd(input.lang, input)],
  }));

  it('해석된 정기휴무는 여는 요일로, 해석된 요금은 isAccessibleForFree 로 나간다', () => {
    const weekly = rendered.find((c) => c.name === 'ko-weekly-free')!.jsonLd[0] as Record<string, unknown>;
    expect(weekly.isAccessibleForFree).toBe(true);
    expect((weekly.openingHoursSpecification as { dayOfWeek: string[] }).dayOfWeek).not.toContain(
      'https://schema.org/Tuesday',
    );
  });

  it('모르는 값은 필드를 싣지 않는다 — 「무료 아님」「매일 연다」로 바꾸지 않는다', () => {
    for (const name of ['ko-unknown-no-overview-no-sido', 'en-legacy-without-attributes']) {
      const json = rendered.find((c) => c.name === name)!.jsonLd[0] as Record<string, unknown>;
      expect(json).not.toHaveProperty('openingHoursSpecification');
      expect(json).not.toHaveProperty('isAccessibleForFree');
    }
  });

  it('골든 파일을 쓴다 — CI 가 git diff 로 최신인지 본다', () => {
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify({ cases: rendered }, null, 2)}\n`);
    expect(rendered).toHaveLength(cases.length);
  });
});
