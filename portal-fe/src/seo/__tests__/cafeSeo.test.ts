import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cafeMeta } from '../copy.mjs';
import { renderCafeDrinkHtml, renderCafeHtml } from '../../../scripts/prerender-seo.mjs';
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

it('keeps search and condition tools noindex before JS while preserving the main canonical', () => {
  const nginx = readFileSync(resolve(__dirname, '../../../nginx.conf'), 'utf8');
  expect(nginx).toMatch(/location ~ \^\/cafe\/\(search\|filter\|results\)\/\?\$ \{[^}]*X-Robots-Tag \$private_robots_tag always;/);
  expect(cafeMeta({ filtered: true }).canonical).toBe('https://rank.1989v.com/cafe');
  expect(renderCafeHtml(shell)).toContain('href="/cafe/filter"');
  expect(renderCafeHtml(shell)).toContain('디카페인은 0mg와 다릅니다.');
});

it('serves drink WebP files without falling through to the private detail SPA', () => {
  const nginx = readFileSync(resolve(__dirname, '../../../nginx.conf'), 'utf8');
  expect(nginx).toMatch(/location \^~ \/cafe\/drinks\/ \{\s*[^]*?location ~ \\.webp\$ \{[^}]*Cache-Control "no-cache, must-revalidate";[^}]*try_files \$uri =404;/);
});

it('indexes a drink comparison only when enough cafes sell it, with the same rule in HTML, nginx and the screen', () => {
  expect(cafeMeta({ drinkName: '아메리카노', brandCount: 11 }).noindex).toBe(false);
  expect(cafeMeta({ drinkName: '아메리카노', brandCount: 4 }).noindex).toBe(true);
  expect(cafeMeta({ drinkName: '아메리카노', brandCount: 11, filtered: true }).noindex).toBe(true);
  expect(cafeMeta({ drinkName: '아메리카노', brandCount: 11 }).canonical).toBe('https://rank.1989v.com/cafe/drink/%EC%95%84%EB%A9%94%EB%A6%AC%EC%B9%B4%EB%85%B8');
  const html = renderCafeDrinkHtml(shell, {
    drinkName: '아메리카노', brandCount: 2,
    brands: [
      { brandName: '메가MGC커피', representative: { menuName: '아메리카노', temperature: 'ICE', sizeLabel: null, cupVolumeMl: 710, caffeineMg: 199.7, caffeineStatus: 'DISCLOSED', sugarG: 0, kcal: 12.2 } },
      { brandName: '우지커피', representative: { menuName: '디카페인 아메리카노', temperature: 'HOT', sizeLabel: '20oz', cupVolumeMl: 591, caffeineMg: 0, caffeineStatus: 'DECAF', sugarG: null, kcal: 15 } },
    ],
  });
  expect(html).toContain('<title>아메리카노 카페인·당류·칼로리 카페별 비교 | 1989v 랭킹</title>');
  expect(html).toContain('<h1>아메리카노 카페별 비교</h1>');
  expect(html).toContain('<td>ICE · 710ml</td><td>199.7mg</td><td>0g</td><td>12.2kcal</td>');
  expect(html).toContain('<td>디카페인</td><td>미공개</td>');
  const nginx = readFileSync(resolve(__dirname, '../../../nginx.conf'), 'utf8');
  expect(nginx).toContain('try_files /prerender/_hosts/$host/cafe/drink/$1.html @cafe_drink_noindex;');
  expect(nginx).toMatch(/location @cafe_drink_noindex \{[^}]*X-Robots-Tag \$private_robots_tag always;/);
});

it('links the frequently compared drinks from the cafe hub', () => {
  const html = renderCafeHtml(shell, [{ drinkName: '카페라떼', brandCount: 13, brands: [] }]);
  expect(html).toContain('<a href="/cafe/drink/%EC%B9%B4%ED%8E%98%EB%9D%BC%EB%96%BC">카페라떼 카페별 비교</a> · 카페 13곳');
});
