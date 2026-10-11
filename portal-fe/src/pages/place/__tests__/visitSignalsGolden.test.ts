import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Attraction } from '../../../api/placeApi';
import { type IndexDoc, toApi } from '../../../seo/__tests__/indexDocToApi';
import { siteSignalSentences } from '../visitSignals';

/**
 * 이 사이트 근거 줄 골든 생성기.
 *
 * 화면(`siteSignalSentences`)과 search 상세 SSR(`AttractionPageRenderer` 의 `visit-signals` 절)은 같은 문장을 내야 한다.
 * `input` 은 색인 문서(`_source`) 그대로이고, Kotlin `VisitSignalsParityTest` 가 같은 입력을 렌더한 HTML 에서 줄을 뽑아
 * `output` 과 비교한다. CI 는 이 테스트를 돌린 뒤 `git diff` · `git status` 로 골든이 최신인지 본다.
 */
const GOLDEN = resolve(__dirname, '../../../../../search/app/src/test/resources/render/visit-signals-golden.json');

const base = {
  contentId: '126508',
  contentTypeId: '12',
  category: 'history',
  address: '서울특별시 종로구 사직로 161',
  location: { lat: 37.5796, lon: 126.977 },
  ldongRegnCd: '11',
  sidoName: '서울특별시',
};

/** 찜·클릭 하한 경계(2·3 · 4·5), 기준일 있음·없음, 큰 수(자릿수 구분 없음), 유형 문서 */
const signals = [
  { key: 'at-min', fields: { savedCount: 3, uniqueClickers14d: 5, signalsAsOf: '2026-10-10' } },
  { key: 'below-min', fields: { savedCount: 2, uniqueClickers14d: 4, signalsAsOf: '2026-10-10' } },
  { key: 'saved-only-no-date', fields: { savedCount: 12 } },
  { key: 'clicked-only', fields: { uniqueClickers14d: 1234, signalsAsOf: '2026-10-09' } },
  { key: 'none', fields: {} },
  { key: 'stay', fields: { contentTypeId: '32', category: 'stay', savedCount: 7, uniqueClickers14d: 9, signalsAsOf: '2026-10-10' } },
];
const langs = [
  { lang: 'ko', title: '경복궁' },
  { lang: 'en', title: 'Gyeongbokgung Palace' },
];

let seq = 0;
const cases = signals.flatMap((signal) =>
  langs.map(({ lang, title }) => ({
    name: `${lang}-${signal.key}`,
    input: {
      ...base,
      id: String(4000 + ++seq),
      lang,
      title,
      ...(lang === 'en' && signal.key === 'stay' ? { contentTypeId: '80' } : {}),
      ...signal.fields,
    },
  })),
);

describe('이 사이트 근거 줄 골든 (서버 렌더 패리티)', () => {
  const rendered = cases.map(({ name, input }) => ({
    name,
    input,
    output: siteSignalSentences(toApi(input as IndexDoc) as unknown as Attraction, input.lang as 'ko' | 'en'),
  }));

  it('줄이 둘·하나·없음인 사례가 모두 있다', () => {
    const sizes = new Set(rendered.map((c) => c.output.length));
    expect([...sizes].sort()).toEqual([0, 1, 2]);
    expect(new Set(rendered.map((c) => c.name)).size).toBe(rendered.length);
  });

  it('골든 파일을 쓴다 — CI 가 git diff · status 로 최신인지 본다', () => {
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify({ cases: rendered }, null, 2)}\n`);
    expect(rendered).toHaveLength(cases.length);
  });
});
