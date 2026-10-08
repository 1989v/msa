// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderContent } from '../../../scripts/render-content.mjs';
// 직접 실행 가드가 있어 import 만으로는 운영 API 를 두드리지 않는다.
import { renderTechSearchHtml } from '../../../scripts/prerender-seo.mjs';

const MD_PATH = fileURLToPath(new URL('../search-architecture.md', import.meta.url));
const SHELL = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8');

const markdown = readFileSync(MD_PATH, 'utf8');
// 생성 JSON 과 같은 모양 — updated·sourceHash 는 render-content 의 main 과 같은 방식으로 계산한다
const generated = {
  ...renderContent(markdown, { idPrefix: 'ts-', gitSha: 'test' }),
  updated: markdown.match(/문서 갱신일[^\n]*?(\d{4}-\d{2}-\d{2})/)?.[1],
  sourceHash: createHash('sha256').update(markdown).digest('hex').slice(0, 12),
  gitSha: 'test',
};

const fenceCount = (markdown.match(/^```mermaid/gm) ?? []).length;

const html = renderTechSearchHtml(SHELL, generated);
const rootStart = html.indexOf('<div id="root">');
// 셸의 모듈 스크립트 앞까지가 프리렌더 본문이다
const rootBody = html.slice(rootStart, html.indexOf('<script type="module"', rootStart));
const jsonLd = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) =>
  JSON.parse(m[1]),
);

describe('/tech/search 프리렌더', () => {
  it('제목·canonical·JSON-LD(TechArticle·BreadcrumbList)를 심는다', () => {
    expect(html).toMatch(/<title>[^<]*검색 아키텍처[^<]*<\/title>/);
    expect(html).toContain('<link rel="canonical" href="https://1989v.com/tech/search" />');
    expect(jsonLd.map((d) => d['@type'])).toEqual(['TechArticle', 'BreadcrumbList']);
    expect(jsonLd[0].dateModified).toBe(generated.updated);
  });

  it('생성 html 을 본문으로 — h1 하나, 표, 그림 수 == mermaid 펜스 수', () => {
    expect(fenceCount).toBeGreaterThan(0);
    expect(rootStart).toBeGreaterThan(-1);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(rootBody).toContain('<table class="kh-table"');
    expect(rootBody.match(/<th scope="col"/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(rootBody.match(/role="img"/g)?.length ?? 0).toBe(fenceCount);
    expect(rootBody).toContain(`data-source-hash="${generated.sourceHash}"`);
  });

  it('목차는 페이지와 같은 headings(level 2·3)로 그린다', () => {
    const nav = rootBody.match(/<nav[^>]*aria-label="목차"[^>]*>([\s\S]*?)<\/nav>/);
    expect(nav).not.toBeNull();
    const toc = generated.headings.filter((h) => h.level === 2 || h.level === 3);
    expect(nav![1].match(/<a href="#/g)).toHaveLength(toc.length);
    for (const h of toc) expect(nav![1]).toContain(`href="#${h.id}"`);
  });

  it('본문에 script·style 이 없다', () => {
    expect(rootBody).not.toMatch(/<script/i);
    expect(rootBody).not.toMatch(/<style/i);
  });

  it('생성 JSON 없이 부르면 throw', () => {
    expect(() => renderTechSearchHtml(SHELL, undefined)).toThrow();
    expect(() => renderTechSearchHtml(SHELL, { html: '' })).toThrow();
  });
});
