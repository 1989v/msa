import { describe, expect, it } from 'vitest';
// 프리렌더 스크립트는 직접 실행 가드가 있어 import 만으로는 네트워크를 두드리지 않는다.
import { portalPageHtml } from '../../../scripts/prerender-seo.mjs';
import { regionUrl } from '../copy.mjs';

const SHELL = [
  '<html lang="ko">',
  '<head><!--seo:start--><title>x</title><!--seo:end--></head>',
  '<body><div id="root"></div></body>',
  '</html>',
].join('\n');

/** 바닥글을 뺀 본문 — 바닥글의 서비스 링크와 섞지 않는다 */
const main = (html: string) => html.slice(html.indexOf('<div id="root">')).replace(/<footer>[\s\S]*?<\/footer>/, '');

describe('apex 홈 프리렌더 — place 지역 링크', () => {
  const SEOUL = regionUrl('ko', '11');

  it('홈 본문에 서울 지역 페이지 링크가 하나 — 홈 카드가 서울 관광지를 보이는 맥락', () => {
    expect(SEOUL).toBe('https://place.1989v.com/regions/11');
    const html = portalPageHtml(SHELL, '/');
    expect(main(html).split(`<a href="${SEOUL}">`)).toHaveLength(2);
  });

  it('다른 포털 페이지에는 싣지 않는다', () => {
    for (const path of ['/tech', '/portfolio', '/shop', '/privacy']) {
      expect(portalPageHtml(SHELL, path)).not.toContain(SEOUL);
    }
  });
});
