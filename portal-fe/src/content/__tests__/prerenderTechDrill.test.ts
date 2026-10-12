// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// 직접 실행 가드가 있어 import 만으로는 운영 API 를 두드리지 않는다.
import { renderTechDrillHtml } from '../../../scripts/prerender-seo.mjs';
import { STATUS_LABEL } from '../../pages/tech/drillModel.mjs';
import { DRILL_PAGES } from '../../pages/tech/drillPages.mjs';

const SHELL = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8');
type Node = { id: string; lanes?: string[] };

describe.each(DRILL_PAGES)('$path 프리렌더', (page) => {
  // 생성 JSON 과 같은 모양 — render-content 는 커밋된 드릴다운 데이터에 sourceHash · gitSha 만 붙인다
  const drill = JSON.parse(readFileSync(fileURLToPath(new URL(`../drill/${page.domain}.json`, import.meta.url)), 'utf8'));
  const generated = { ...drill, sourceHash: 'abc123def456', gitSha: 'test' };
  const stages: string[] = drill.diagrams[drill.root].nodes.flatMap((n: Node) => [n.id, ...(n.lanes ?? [])]);

  const html = renderTechDrillHtml(SHELL, generated, page);
  const rootStart = html.indexOf('<div id="root">');
  // 셸의 모듈 스크립트 앞까지가 프리렌더 본문이다
  const rootBody = html.slice(rootStart, html.indexOf('<script type="module"', rootStart));
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

  it('제목·canonical·JSON-LD(TechArticle·BreadcrumbList)를 심는다', () => {
    expect(html).toMatch(new RegExp(`<title>[^<]*${page.title}[^<]*</title>`));
    expect(html).toContain(`<link rel="canonical" href="https://1989v.com${page.path}" />`);
    expect(jsonLd.map((d) => d['@type'])).toEqual(['TechArticle', 'BreadcrumbList']);
    expect(jsonLd[0].dateModified).toBe(drill.updated);
    expect(jsonLd[0].headline).toBe(page.title);
  });

  it('본문은 h1 하나와 1단계 단계 목록 — 단계마다 이름 · 상태 · 개념 설명', () => {
    expect(rootStart).toBeGreaterThan(-1);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(rootBody).toContain(`<h1>${page.title}</h1>`);
    expect(rootBody.match(/<li>/g)).toHaveLength(stages.length);
    for (const id of stages) {
      const c = drill.concepts[id];
      expect(rootBody).toContain(`<h3>${c.name}`);
      if (c.applied) expect(rootBody).toContain(`(${STATUS_LABEL[c.applied.status as keyof typeof STATUS_LABEL]})`);
    }
    expect(rootBody).toContain(`data-source-hash="${generated.sourceHash}"`);
  });

  it('본문에 script·style 이 없다', () => {
    expect(rootBody).not.toMatch(/<script/i);
    expect(rootBody).not.toMatch(/<style/i);
  });

  it('계약을 어긴 생성물이면 throw', () => {
    expect(() => renderTechDrillHtml(SHELL, undefined, page)).toThrow();
    expect(() => renderTechDrillHtml(SHELL, { ...generated, sourceHash: undefined }, page)).toThrow();
    expect(() => renderTechDrillHtml(SHELL, { ...generated, root: 'nope' }, page)).toThrow();
    expect(() => renderTechDrillHtml(SHELL, { ...generated, maxDepth: 0 }, page)).toThrow();
  });
});
