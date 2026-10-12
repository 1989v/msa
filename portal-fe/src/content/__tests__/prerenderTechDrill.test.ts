// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// 직접 실행 가드가 있어 import 만으로는 운영 API 를 두드리지 않는다.
import { drillPreloadTags, renderTechDrillHtml } from '../../../scripts/prerender-seo.mjs';
import { STATUS_LABEL } from '../../pages/tech/drillModel.mjs';
import { DRILL_PAGES } from '../../pages/tech/drillPages.mjs';

const SHELL = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8');
type Node = { id: string; lanes?: string[] };

const NGINX = readFileSync(fileURLToPath(new URL('../../../nginx.conf', import.meta.url)), 'utf8');

it('nginx 드릴다운 location 이 목록의 경로를 전부 받는다 — 빠지면 용어집 location 이 받아 엣지 캐시 헤더가 안 붙는다', () => {
  // 판정 근거: 실제 nginx.conf 에서 엣지 캐시(s-maxage) 를 붙이는 /tech location 의 정규식
  const block = NGINX.split(/\n\s*(?=location )/).find((b) => b.startsWith('location ~ ^/tech/(') && b.includes('s-maxage'));
  expect(block, '엣지 캐시를 붙이는 /tech 드릴다운 location 이 없다').toBeDefined();
  const re = new RegExp(block!.match(/^location ~ (\S+) \{/)![1]);
  expect(DRILL_PAGES.filter((p) => !re.test(p.path)).map((p) => p.path)).toEqual([]);
});

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
  });
});

describe('드릴다운 지연 청크 미리 받기', () => {
  // vite build 매니페스트와 같은 모양 — 페이지 청크가 화면 청크를, 화면 청크가 메인 진입과 공용 청크를 부른다
  const page = DRILL_PAGES[0];
  const manifest = {
    'index.html': { file: 'assets/index-AAA.js', isEntry: true, imports: ['_react-BBB.js'] },
    '_react-BBB.js': { file: 'assets/react-BBB.js' },
    [`src/pages/tech/${page.module}.tsx`]: { file: 'assets/Page-CCC.js', imports: ['src/pages/tech/TechDrillPage.tsx', 'index.html'] },
    'src/pages/tech/TechDrillPage.tsx': { file: 'assets/TechDrillPage-DDD.js', imports: ['index.html', '_drillPages-EEE.js'], css: ['assets/TechDrillPage-FFF.css'] },
    '_drillPages-EEE.js': { file: 'assets/drillPages-EEE.js' },
  };

  it('페이지 청크와 그 정적 import 를 따라가 미리 받고, 메인 진입 쪽은 빼고, CSS 는 스타일로 미리 받는다', () => {
    const tags = drillPreloadTags(manifest, page);
    expect(tags).toBe(
      '<link rel="modulepreload" crossorigin href="/assets/Page-CCC.js">' +
        '<link rel="modulepreload" crossorigin href="/assets/TechDrillPage-DDD.js">' +
        '<link rel="modulepreload" crossorigin href="/assets/drillPages-EEE.js">' +
        '<link rel="preload" as="style" href="/assets/TechDrillPage-FFF.css">',
    );
    expect(tags).not.toContain('index-AAA');
  });

  it('셸이 이미 부르는 공용 청크는 다시 적지 않는다', () => {
    const shell = '<link rel="modulepreload" crossorigin href="/assets/drillPages-EEE.js">';
    expect(drillPreloadTags(manifest, page, shell)).not.toContain('drillPages-EEE');
    expect(drillPreloadTags(manifest, page, shell)).toContain('TechDrillPage-DDD');
  });

  it('매니페스트에 페이지 파일이 없으면 throw — module 이름과 파일이 어긋난 것이다', () => {
    expect(() => drillPreloadTags({}, page)).toThrow(/매니페스트/);
  });

  it.each(DRILL_PAGES)('$path 의 module 은 실제 페이지 파일이다', (p) => {
    expect(existsSync(fileURLToPath(new URL(`../../pages/tech/${p.module}.tsx`, import.meta.url)))).toBe(true);
  });

  it('미리 받기 태그는 head 안에 들어가고 본문에는 없다', () => {
    const drill = JSON.parse(readFileSync(fileURLToPath(new URL(`../drill/${page.domain}.json`, import.meta.url)), 'utf8'));
    const tags = drillPreloadTags(manifest, page);
    const html = renderTechDrillHtml(SHELL, { ...drill, sourceHash: 'abc123def456', gitSha: 'test' }, page, tags);
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain(tags);
    expect(html.indexOf(tags)).toBe(html.lastIndexOf(tags));
  });
});
