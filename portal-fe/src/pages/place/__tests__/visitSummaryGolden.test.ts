import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Attraction } from '../../../api/placeApi';
import { type IndexDoc, toApi } from '../../../seo/__tests__/indexDocToApi';
import { visitSummary } from '../placeAttributes';

/**
 * 방문 요약 골든 생성기.
 *
 * 화면(`visitSummary`)과 search 상세 SSR(`AttractionPageRenderer` 의 방문 요약 `<dl>`·배지 줄)은 같은 칸·같은 문구를
 * 내야 한다. 케이스는 `{name, input, output}` 이고 `input` 은 **색인 문서(`_source`) 그대로**다 — 화면은
 * `toApi` 로 API 응답 모양으로 바꿔 `visitSummary` 에 넣고, Kotlin `VisitSummaryParityTest` 는 같은 `input` 을
 * `AttractionSearchDocument` 로 읽어 렌더한 HTML 에서 뽑아 `output` 과 비교한다.
 * CI 는 이 테스트를 돌린 뒤 `git diff` · `git status` 로 골든이 최신인지 본다.
 */
const GOLDEN = resolve(__dirname, '../../../../../search/app/src/test/resources/render/visit-summary-golden.json');

const base = {
  contentId: '126508',
  contentTypeId: '12',
  category: 'history',
  address: '서울특별시 종로구 사직로 161',
  location: { lat: 37.5796, lon: 126.977 },
  ldongRegnCd: '11',
  sidoName: '서울특별시',
  modifiedAt: '2026-09-30T10:15:00',
  closureState: 'UNKNOWN',
  closedWeekdays: null,
  attrParking: 'UNKNOWN',
  attrCreditCard: 'UNKNOWN',
  attrStrollerRental: 'UNKNOWN',
  petPolicy: 'UNKNOWN',
  attrAdmission: 'UNKNOWN',
};

/** 요금 원천 셋(feeText · useFee 만 · 둘 다 없음) × 출처 있음·없음 × 국·영 */
const fees = [
  // feeText 는 색인이 정규화해 둔 평문이다 — 「<」·「"」가 글자 그대로 나가야 한다
  { key: 'feetext', fields: { feeText: '<어린이> 무료 / 어른 "3,000원"', useFee: '어른 3,000원' } },
  { key: 'usefee-only', fields: { useFee: '어른 3,000원<br>어린이 &lt;무료&gt;' } },
  { key: 'no-fee', fields: {} },
];
const sources = [
  { key: 'tourapi', fields: { source: 'TOURAPI' } },
  { key: 'no-source', fields: { modifiedAt: null } },
];
const langs = [
  { lang: 'ko', title: '경복궁' },
  { lang: 'en', title: 'Gyeongbokgung Palace' },
];

let seq = 0;
const matrix = fees.flatMap((fee) =>
  sources.flatMap((source) =>
    langs.map(({ lang, title }) => ({
      name: `${lang}-${fee.key}-${source.key}`,
      input: { ...base, id: String(3000 + ++seq), lang, title, ...fee.fields, ...source.fields },
    })),
  ),
);

/** SR-2.1 표의 해석·원문 조합 — 칸마다 한 건 */
const combos = [
  {
    name: 'ko-weekly-with-raw-parking-no-pet-allowed',
    input: {
      ...base, id: '3101', lang: 'ko', title: '창덕궁', source: 'TOURAPI',
      closureState: 'WEEKLY', closedWeekdays: ['MON'], restDate: '매주 월요일',
      attrParking: 'NO', parking: '주차 불가<br>인근 공영주차장 이용',
      petPolicy: 'ALLOWED', petAcmpyType: '전구역 동반가능',
      useTime: '09:00~18:00<br />입장 마감 17:00',
    },
  },
  {
    name: 'en-always-open-parking-yes-pet-partial',
    input: {
      ...base, id: '3102', lang: 'en', title: 'N Seoul Tower', source: 'TOURAPI',
      closureState: 'ALWAYS_OPEN', restDate: null, attrParking: 'YES', parking: 'Available',
      petPolicy: 'PARTIAL', useTime: '10:00~23:00',
    },
  },
  {
    name: 'ko-unknown-closure-raw-only-pet-raw',
    input: {
      ...base, id: '3103', lang: 'ko', title: '원문만 있는 곳', source: 'GOCAMPING',
      closureState: 'UNKNOWN', restDate: '설·추석 당일 (다음날 대신 휴무)',
      attrParking: 'UNKNOWN', parking: null, petPolicy: 'UNKNOWN', petAcmpyType: '소형견 &amp; 목줄 필수',
    },
  },
  {
    name: 'ko-no-weekly-barrier-free-badges',
    input: {
      ...base, id: '3104', lang: 'ko', title: '배지가 있는 곳', source: 'TOURAPI',
      closureState: 'NO_WEEKLY', restDate: '명절 당일',
      attrCreditCard: 'YES', attrStrollerRental: 'NO', uniqueClickers14d: 12,
      barrierFree: ['ELEVATOR', 'WHEELCHAIR', 'LACTATION_ROOM'],
    },
  },
  {
    name: 'en-gocamping-badges-frequently-clicked-only',
    input: {
      ...base, id: '3105', lang: 'en', title: 'Riverside Camp', source: 'GOCAMPING',
      attrCreditCard: 'UNKNOWN', uniqueClickers14d: 5, barrierFree: [],
    },
  },
  {
    // 원문 「<br>」 뒤 줄바꿈이 겹쳐 생긴 빈 줄 — 칸 안에서는 한 줄바꿈으로 줄인다
    name: 'ko-blank-lines-in-source',
    input: {
      ...base, id: '3107', lang: 'ko', title: '빈 줄이 있는 곳', source: 'TOURAPI',
      closureState: 'WEEKLY', closedWeekdays: ['MON'], restDate: '매주 월요일<br>\n<br>\n1월 1일',
      feeText: '- 개인 3,000원\n\n- 단체(10인 이상) 2,400원',
      useTime: '하절기 09:00~18:00<br>\n동절기 09:00~17:00<br>\n<br>\n※ 입장 마감 1시간 전',
    },
  },
  {
    // 방문 속성이 생기기 전에 색인된 문서 — 해석 줄 없이 원문만, 배지 줄 없음
    name: 'ko-legacy-without-attributes',
    input: {
      contentId: '126509', contentTypeId: '14', category: 'culture', address: null,
      location: { lat: 37.5, lon: 127.0 }, id: '3106', lang: 'ko', title: '옛 문서',
      restDate: '매주 화요일', parking: '가능', petAcmpyType: '불가', useFee: '무료',
    },
  },
];

const parkingFees = langs.flatMap(({ lang, title }) => [
  { key: 'fee-only', fields: { parkingFee: '소형 2,000원<br>&lt;추가&gt; &amp; 500원' } },
  { key: 'with-parking', fields: { parking: 'Available', attrParking: 'YES', parkingFee: 'First hour free' } },
  { key: 'blank-fee', fields: { parkingFee: ' \n <br> &nbsp; ' } },
  ...['-', 'N/A', '정보 없음', 'Not provided', '<p>N/A</p>'].map((parkingFee, index) => ({ key: `missing-${index}`, fields: { parkingFee } })),
  ...['무료', '없음', '현장 문의'].map((parkingFee, index) => ({ key: `meaningful-${index}`, fields: { parkingFee } })),
].map(({ key, fields }) => ({
  name: `${lang}-parking-${key}`,
  input: { ...base, id: '3200', lang, title, ...fields },
})));
const cases = [...matrix, ...combos, ...parkingFees];

describe('방문 요약 골든 (서버 렌더 패리티)', () => {
  const rendered = cases.map(({ name, input }) => ({
    name,
    input,
    output: visitSummary(toApi(input as IndexDoc) as unknown as Attraction, input.lang as 'ko' | 'en'),
  }));

  it('요금 원천 셋 × 출처 있음·없음 × 국·영이 모두 있다', () => {
    expect(matrix).toHaveLength(12);
    expect(new Set(rendered.map((c) => c.name)).size).toBe(rendered.length);
  });

  it('칸이 빠진 사례와 채워진 사례, 배지 줄이 있는 사례와 없는 사례가 모두 있다', () => {
    const counts = rendered.map((c) => c.output.rows.length);
    expect(Math.min(...counts)).toBeLessThan(Math.max(...counts));
    expect(rendered.every((c) => c.output.rows.every((r) => r.value !== '정보 없음' && r.value !== 'Not provided'))).toBe(true);
    expect(rendered.some((c) => c.output.badgeLine != null)).toBe(true);
    expect(rendered.some((c) => c.output.badgeLine == null)).toBe(true);
  });

  it.each(['ko', 'en'])('주차 여부가 미상이어도 요금을 보이며 빈 원문은 요금으로 만들지 않는다: %s', (lang) => {
    const label = lang === 'en' ? 'Parking' : '주차';
    const parking = (key: string) =>
      rendered.find((c) => c.name === `${lang}-parking-${key}`)!.output.rows.find((r) => r.label === label)?.value;
    expect(parking('fee-only')).toBe(`${lang === 'en' ? 'Parking fee' : '주차요금'}: 소형 2,000원\n<추가> & 500원`);
    expect(parking('with-parking')).toContain('First hour free');
    expect(parking('blank-fee')).toBeUndefined();
    for (let index = 0; index < 5; index++) expect(parking(`missing-${index}`)).toBeUndefined();
    for (const [index, value] of ['무료', '없음', '현장 문의'].entries()) expect(parking(`meaningful-${index}`)).toBe(`${lang === 'en' ? 'Parking fee' : '주차요금'}: ${value}`);
  });

  it('골든 파일을 쓴다 — CI 가 git diff · status 로 최신인지 본다', () => {
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify({ cases: rendered }, null, 2)}\n`);
    expect(rendered).toHaveLength(cases.length);
  });
});
