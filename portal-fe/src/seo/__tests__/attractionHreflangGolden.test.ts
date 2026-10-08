import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { attractionHreflangAlternates } from '../copy.mjs';

/**
 * 관광지 상세 hreflang 골든 생성기.
 *
 * 화면(copy.mjs `attractionHreflangAlternates`)과 search 상세 SSR(`AttractionPageRenderer`)은 언어 대체 짝에
 * 같은 세 줄을 같은 순서로 내야 한다. 이 파일이 copy.mjs 함수의 **출력**으로 골든을 쓰고 Kotlin
 * `AttractionHreflangParityTest` 가 같은 입력을 렌더해 `<link rel="alternate" hreflang>` 줄과 비교한다.
 * CI 는 이 테스트를 돌린 뒤 `git diff` · `git status` 로 골든이 최신인지 본다.
 */
const GOLDEN = resolve(__dirname, '../../../../search/app/src/test/resources/render/attraction-hreflang-golden.json');

const cases: Array<{ name: string; docLang: 'ko' | 'en'; id: string; alternateId: string }> = [
  { name: 'ko-document', docLang: 'ko', id: '1001', alternateId: '2001' },
  { name: 'en-document', docLang: 'en', id: '2001', alternateId: '1001' },
];

describe('관광지 상세 hreflang 골든 (서버 렌더 패리티)', () => {
  const rows = cases.map((c) => ({ ...c, output: attractionHreflangAlternates(c.docLang, c.id, c.alternateId) }));

  it('국문 문서와 영문 문서가 같은 세 줄을 낸다 — 짝의 양쪽', () => {
    expect(rows[0].output).toEqual(rows[1].output);
    expect(rows[0].output.map((a: { hreflang: string }) => a.hreflang)).toEqual(['ko', 'en', 'x-default']);
  });

  it('골든 파일을 쓴다 — CI 가 git diff · status 로 최신인지 본다', () => {
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify({ cases: rows }, null, 2)}\n`);
    expect(rows).toHaveLength(cases.length);
  });
});
