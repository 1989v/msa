import { describe, expect, it } from 'vitest';
// 직접 실행 가드가 있어 import 만으로는 운영 API 를 두드리지 않는다 (prerenderPlace.test 와 동일).
import { renderAboutHtml, renderDataSourcesHtml } from '../../../scripts/prerender-seo.mjs';
import { ABOUT_SECTIONS } from '../copy.mjs';
import { DATA_SOURCES } from '../dataSources.mjs';

const SHELL = [
  '<html lang="ko">',
  '<head><!--seo:start--><title>x</title><!--seo:end--></head>',
  '<body><div id="root"></div></body>',
  '</html>',
].join('\n');

/** 프리렌더 본문의 tbody 안 행 수 — 표 머리(thead)의 행은 세지 않는다. */
function bodyRowCount(html: string): number {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  return tbody ? (tbody[1].match(/<tr>/g) ?? []).length : 0;
}

describe('사이트 소개 프리렌더', () => {
  const html = renderAboutHtml(SHELL);

  it('About 절 제목 넷이 초기 HTML 에 h2 로 들어간다 — 페이지와 같은 상수에서 온다', () => {
    expect(ABOUT_SECTIONS).toHaveLength(4);
    for (const section of ABOUT_SECTIONS) {
      expect(html).toContain(`<h2>${section.heading}</h2>`);
    }
  });

  it('프리렌더 표식과 본문 링크가 있다', () => {
    expect(html).toContain('<!--seo:prerendered-->');
    expect(html).toContain('href="/data-sources"');
  });
});

describe('데이터 출처 프리렌더', () => {
  it('표 행 수가 상수 DATA_SOURCES 길이와 같다', () => {
    const html = renderDataSourcesHtml(SHELL);
    expect(bodyRowCount(html)).toBe(DATA_SOURCES.length);
    expect(html).toContain('<!--seo:prerendered-->');
    expect(html).toContain('GeoNames');
  });

  it('셀 값을 이스케이프한다 — 원문 태그가 본문에 섞이지 않는다', () => {
    const html = renderDataSourcesHtml(SHELL, [
      { data: '<b>&"', source: '<b>&"', license: '<b>&"', note: '<b>&"' },
    ]);
    expect(bodyRowCount(html)).toBe(1);
    expect(html).toContain('&lt;b&gt;&amp;&quot;');
    expect(html).not.toContain('<b>');
  });
});
