import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cafeMeta } from '../copy.mjs';
import { renderCafeHtml } from '../../../scripts/prerender-seo.mjs';
const shell = '<html lang="ko"><head><!--seo:start--><title>x</title><!--seo:end--></head><body><div id="root"></div></body></html>';
describe('cafe dedicated SEO', () => {
  it('renders the cafe title, description and canonical in initial HTML', () => {
    const meta = cafeMeta();
    const html = renderCafeHtml(shell);
    expect(html).toContain(`<title>${meta.title}</title>`);
    expect(html).toContain(meta.description);
    expect(html).toContain('href="https://rank.1989v.com/cafe"');
    expect(meta.noindex).toBe(false);
    expect(html).not.toContain('시군구별 최저가');
  });
  it('excludes query combinations and detail variants from indexing', () => {
    expect(cafeMeta({ filtered: true }).noindex).toBe(true);
    expect(cafeMeta({ detail: true }).noindex).toBe(true);
    expect(cafeMeta({ detail: true, drinkKey: 'v1_example' }).canonical).toBe('https://rank.1989v.com/cafe/drinks/v1_example');
    const nginx = readFileSync(resolve(__dirname, '../../../nginx.conf'), 'utf8');
    expect(nginx).toContain('try_files /prerender/_hosts/$host/cafe.html /index.html;');
    expect(nginx).toContain('add_header X-Robots-Tag $cafe_robots_tag always;');
    const script = readFileSync(resolve(__dirname, '../../../scripts/prerender-seo.mjs'), 'utf8');
    expect(script).toContain("{ loc: rankUrl('/cafe'), priority: '0.7' }");
    expect(script).toContain('prerender/_hosts/${RANK_HOST}/cafe.html');
  });
});
