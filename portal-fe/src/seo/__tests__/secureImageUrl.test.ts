import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { secureImageUrl } from '../copy.mjs';
import { secureImageUrl as reexported } from '../../pages/place/placeView';

/**
 * 사진 주소 https 규칙 + 골든 생성기.
 *
 * 화면(copy.mjs `secureImageUrl`)과 search 상세 SSR(`AttractionSeoText.secureImageUrl`)은 같은 규칙이어야 한다 —
 * 하이드레이션이 서버가 심은 og:image·JSON-LD 를 같은 규칙으로 다시 만든다. 이 파일이 copy.mjs 함수의
 * **출력**으로 골든을 쓰고 Kotlin `SecureImageParityTest` 가 같은 입력을 넣어 비교한다.
 * CI 는 이 테스트를 돌린 뒤 `git diff` · `git status` 로 골든이 최신인지 본다.
 */
const GOLDEN = resolve(__dirname, '../../../../search/app/src/test/resources/render/secure-image-golden.json');

const TONG_HTTP = 'http://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg';
const TONG_HTTPS = 'https://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg';

const cases: Array<{ name: string; input: string | null; expected: string | null }> = [
  { name: 'tong-http', input: TONG_HTTP, expected: TONG_HTTPS },
  { name: 'tong-https', input: TONG_HTTPS, expected: TONG_HTTPS },
  { name: 'other-host-http', input: 'http://example.com/a.jpg', expected: 'http://example.com/a.jpg' },
  {
    name: 'tong-in-query-of-other-host',
    input: 'http://evil/?u=http://tong.visitkorea.or.kr/',
    expected: 'http://evil/?u=http://tong.visitkorea.or.kr/',
  },
  {
    name: 'tong-uppercase-host',
    input: 'http://TONG.VISITKOREA.OR.KR/cms/1.jpg',
    expected: 'http://TONG.VISITKOREA.OR.KR/cms/1.jpg',
  },
  {
    name: 'tong-host-prefix-of-other-host',
    input: 'http://tong.visitkorea.or.kr.evil.com/1.jpg',
    expected: 'http://tong.visitkorea.or.kr.evil.com/1.jpg',
  },
  { name: 'leading-space', input: ` ${TONG_HTTP}`, expected: ` ${TONG_HTTP}` },
  { name: 'empty', input: '', expected: '' },
  { name: 'null', input: null, expected: null },
];

describe('secureImageUrl — tong 사진 주소만 https', () => {
  it.each(cases)('$name', ({ input, expected }) => {
    expect(secureImageUrl(input)).toBe(expected);
  });

  it('undefined 는 그대로', () => {
    expect(secureImageUrl(undefined)).toBeUndefined();
  });

  it('placeView 가 같은 함수를 다시 내보낸다', () => {
    expect(typeof reexported).toBe('function');
    expect(reexported).toBe(secureImageUrl);
  });

  it('골든 파일을 쓴다 — CI 가 git diff · status 로 최신인지 본다', () => {
    const rows = cases.map(({ name, input }) => ({ name, input, expected: secureImageUrl(input) }));
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify({ cases: rows }, null, 2)}\n`);
    // 바뀌는 사례와 그대로인 사례가 둘 다 있어야 패리티가 규칙을 잰다
    expect(rows.some((r) => r.input !== r.expected)).toBe(true);
    expect(rows.some((r) => r.input === r.expected)).toBe(true);
  });
});
