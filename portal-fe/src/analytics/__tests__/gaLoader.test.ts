import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * GA 로더는 index.html 안의 인라인 스크립트다 — 그 스크립트 본문을 그대로 꺼내 위치·리퍼러만 바꿔 실행한다.
 * 판정 근거는 스크립트가 head 에 붙인 googletagmanager 태그 수다(검사 안에 로더 사본을 두지 않는다).
 */
const html = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8');
const loader = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((body) => body.includes('googletagmanager'));

function gaTagsLoaded(href: string, referrer = ''): number {
  if (!loader) throw new Error('index.html 에서 GA 로더 스크립트를 찾지 못했다');
  const url = new URL(href);
  const appended: { src?: string }[] = [];
  const fakeDocument = {
    referrer,
    createElement: () => ({}) as { src?: string; async?: boolean },
    head: { appendChild: (el: { src?: string }) => appended.push(el) },
  };
  const fakeWindow: Record<string, unknown> = {};
  const fakeLocation = { hostname: url.hostname, pathname: url.pathname, search: url.search, href };
  new Function('location', 'document', 'window', loader)(fakeLocation, fakeDocument, fakeWindow);
  return appended.filter((el) => String(el.src).includes('googletagmanager')).length;
}

describe('index.html GA 로더 — 공유 토큰이 GA 로 가는 문서', () => {
  it('대조군: apex 루트에서는 싣는다', () => {
    expect(gaTagsLoaded('https://1989v.com/')).toBe(1);
  });

  it('① 수신 화면 경로 /shared/ 에서는 싣지 않는다', () => {
    expect(gaTagsLoaded('https://1989v.com/shared/Ab3dE5gH9k')).toBe(0);
  });

  it('② 로그인 next 쿼리에 /shared/ 가 인코딩돼 있으면 싣지 않는다 — 대소문자 무관', () => {
    expect(gaTagsLoaded('https://1989v.com/login?next=https%3A%2F%2F1989v.com%2Fshared%2Fx')).toBe(0);
    expect(gaTagsLoaded('https://1989v.com/login?next=https%3a%2f%2f1989v.com%2fshared%2fx')).toBe(0);
  });

  it('③ 리퍼러 경로가 /shared/ 이면 싣지 않는다', () => {
    expect(gaTagsLoaded('https://1989v.com/login', 'https://1989v.com/shared/x')).toBe(0);
    // 리퍼러가 다른 경로면 그대로 싣는다
    expect(gaTagsLoaded('https://1989v.com/login', 'https://1989v.com/favorites')).toBe(1);
  });

  it('resume 호스트 제외는 그대로다', () => {
    expect(gaTagsLoaded('https://resume.1989v.com/')).toBe(0);
  });
});
