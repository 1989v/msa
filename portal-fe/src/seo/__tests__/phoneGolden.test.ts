import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { attractionPhone } from '../copy.mjs';

/**
 * 전화 링크 골든 생성기.
 *
 * 화면(copy.mjs `attractionPhone`)과 search 상세 SSR(`AttractionSeoText.attractionPhone`)은 같은 원문에서
 * 같은 번호를 골라야 한다. 이 파일이 copy.mjs 함수의 **출력**으로 골든을 쓰고 Kotlin `PhoneParityTest` 가
 * 같은 입력을 넣어 비교한다. CI 는 이 테스트를 돌린 뒤 `git diff` · `git status` 로 골든이 최신인지 본다.
 */
const GOLDEN = resolve(__dirname, '../../../../search/app/src/test/resources/render/phone-golden.json');

const cases: Array<{ name: string; input: string | null }> = [
  { name: 'two-numbers-glued', input: '행사장 02-319-1220운영사 02-737-6444' },
  { name: 'range-suffix', input: '02-724-0274~6' },
  { name: 'comma-extension', input: '02-2153-0310, 0311 (12:00~13:0' },
  { name: 'prefixed-label', input: 'K-컬처 스퀘어 운영사무국 02-2068-1176' },
  { name: 'br-two-lines', input: '02-123-4567<br>010-1234-5678' },
  { name: 'international', input: '+82-2-123-4567' },
  { name: 'representative-only', input: '1330' },
  { name: 'representative-after-hangul', input: '관광안내전화1330' },
  { name: 'no-number', input: '문의: 없음' },
  { name: 'blank', input: '' },
];

describe('전화 링크 골든 (서버 렌더 패리티)', () => {
  const rows = cases.map(({ name, input }) => ({ name, input, output: attractionPhone(input) }));

  it('링크가 있는 사례 · 원문만 있는 사례 · 항목이 없는 사례가 모두 있다', () => {
    expect(rows.some((r) => r.output?.href)).toBe(true);
    expect(rows.some((r) => r.output && r.output.href == null)).toBe(true);
    expect(rows.some((r) => r.output == null)).toBe(true);
  });

  it('골든 파일을 쓴다 — CI 가 git diff · status 로 최신인지 본다', () => {
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify({ cases: rows }, null, 2)}\n`);
    expect(rows).toHaveLength(cases.length);
  });
});
