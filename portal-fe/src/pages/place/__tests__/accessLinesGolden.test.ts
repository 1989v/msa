import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Attraction } from '../../../api/placeApi';
import { type IndexDoc, toApi } from '../../../seo/__tests__/indexDocToApi';
import { accessView } from '../accessLines';

/**
 * 가까운 역·정류장 골든 생성기.
 *
 * 화면(`accessView`)과 search 상세 SSR(`AttractionPageRenderer` 의 `access` 절)은 같은 줄을 내야 한다.
 * `input` 은 색인 문서(`_source`) 그대로이고, Kotlin `AttractionAccessParityTest` 가 같은 입력을 렌더한 HTML 에서
 * 줄·안내·출처를 뽑아 `output` 과 비교한다. CI 는 이 테스트를 돌린 뒤 `git diff` · `git status` 로 골든이 최신인지 본다.
 */
const GOLDEN = resolve(__dirname, '../../../../../search/app/src/test/resources/render/access-golden.json');

const base = {
  contentId: '126508',
  contentTypeId: '12',
  category: 'history',
  address: '서울특별시 종로구 사직로 161',
  location: { lat: 37.5796, lon: 126.977 },
  ldongRegnCd: '11',
  sidoName: '서울특별시',
};

const rail = (rank: number, name: string, nameEn: string | null, lines: string | null, distanceM: number, baseDate?: string) => ({
  kind: 'RAIL', rank, name, ...(nameEn ? { nameEn } : {}), ...(lines ? { lines } : {}), distanceM, ...(baseDate ? { baseDate } : {}),
});
const bus = (rank: number, name: string, distanceM: number, baseDate?: string) => ({
  kind: 'BUS', rank, name, distanceM, ...(baseDate ? { baseDate } : {}),
});

/** km 경계(999·1000·1049·1050), 「역」 중복, 번호·이름 노선, 영문 역명 없음, 미연계(줄 있음·없음), 연계인데 줄 없음, 기준일 없음 */
const accesses = [
  {
    key: 'boundaries',
    access: {
      stops: [
        rail(1, '서울역', 'Seoul Station', '1·4호선', 999, '2024-12-31'),
        rail(2, '시청', null, '1·2호선', 1000, '2024-12-31'),
        bus(1, '세종문화회관', 1049, '2025-10-31'),
        bus(2, '광화문', 1050, '2025-10-31'),
      ],
      busCovered: true,
    },
  },
  {
    key: 'named-line-bus-not-covered',
    access: { stops: [rail(1, '광운대', 'Kwangwoon Univ.', '경의중앙선·경춘선', 1950, '2026-06-18')], busCovered: false },
  },
  { key: 'not-covered-only', access: { stops: [], busCovered: false } },
  { key: 'covered-empty', access: { stops: [], busCovered: true } },
  { key: 'bus-only-no-date', access: { stops: [bus(1, '경복궁역', 85)] } },
  { key: 'none', access: null },
];
const langs = [
  { lang: 'ko', title: '경복궁' },
  { lang: 'en', title: 'Gyeongbokgung Palace' },
];

let seq = 0;
const cases = accesses.flatMap(({ key, access }) =>
  langs.map(({ lang, title }) => ({
    name: `${lang}-${key}`,
    input: { ...base, id: String(5000 + ++seq), lang, title, ...(access ? { access } : {}) },
  })),
);

describe('가까운 역·정류장 골든 (서버 렌더 패리티)', () => {
  const rendered = cases.map(({ name, input }) => {
    const api = toApi(input as IndexDoc) as unknown as Attraction;
    return { name, input, output: accessView(api.access ?? null, input.lang as 'ko' | 'en') };
  });

  it('절 있음·없음, 미연계 안내, km 경계가 모두 있다', () => {
    expect(rendered.some((c) => c.output == null)).toBe(true);
    const lines = rendered.flatMap((c) => c.output?.items ?? []);
    expect(lines).toContain('서울역 (1·4호선) · 직선거리 999m');
    expect(lines).toContain('시청역 (1·2호선) · 직선거리 1.0km');
    expect(lines).toContain('이 지역은 버스정류장 위치 자료가 없습니다');
    expect(lines).toContain('No bus stop data for this area');
    expect(new Set(rendered.map((c) => c.name)).size).toBe(rendered.length);
  });

  it('골든 파일을 쓴다 — CI 가 git diff · status 로 최신인지 본다', () => {
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify({ cases: rendered }, null, 2)}\n`);
    expect(rendered).toHaveLength(cases.length);
  });
});
