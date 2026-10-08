import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PORTAL_ORIGIN, TRUST_LINKS } from '../copy.mjs';
import { siteFooter } from '../../../scripts/prerender-seo.mjs';

/**
 * 초기 HTML 바닥글 링크 골든 생성기.
 *
 * 프리렌더(`siteFooter`)와 search 상세 SSR(`AttractionPageRenderer`)은 같은 바닥글을 그려야 한다.
 * 이 파일이 `siteFooter()` 의 **출력**에서 링크를 뽑아 search 테스트 리소스에 쓰고,
 * Kotlin `FooterLinksParityTest` 가 렌더한 HTML 에서 같은 모양으로 뽑아 비교한다.
 * CI 는 이 테스트를 돌린 뒤 `git diff --exit-code` 로 골든이 최신인지 본다.
 */
const GOLDEN = resolve(__dirname, '../../../../search/app/src/test/resources/render/footer-links-golden.json');

type FooterLink = { href: string; label: string };

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/** `<footer>` 안 `<a>` 전부를 순서째. Kotlin 쪽도 같은 규칙으로 뽑는다. */
function footerLinks(html: string): FooterLink[] {
  const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] ?? '';
  return [...footer.matchAll(/<a href="([^"]*)">([\s\S]*?)<\/a>/g)].map((m) => ({
    href: decodeHtml(m[1]),
    label: decodeHtml(m[2]),
  }));
}

describe('바닥글 링크 골든', () => {
  const links = footerLinks(siteFooter());

  it('호스트 여섯 + 신뢰 링크 넷 = 열 개', () => {
    expect(links).toHaveLength(10);
  });

  it('마지막 넷이 TRUST_LINKS 의 apex 절대 주소·국문 라벨과 순서째 같다', () => {
    expect(links.slice(-4)).toEqual(
      TRUST_LINKS.map((t: { path: string; label: string }) => ({ href: `${PORTAL_ORIGIN}${t.path}`, label: t.label })),
    );
  });

  it('골든 파일을 쓴다 — CI 가 git diff 로 최신인지 본다', () => {
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify(links, null, 2)}\n`);
    expect(links.length).toBeGreaterThan(0);
  });
});
