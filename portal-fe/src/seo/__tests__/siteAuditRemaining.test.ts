import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractRoutes, permitsRoute, nginxRouteMap, NOT_FOUND_HTML } from '../../../scripts/spa-routes.mjs';
import { siteFooter, renderDealHubHtml, renderDetail } from '../../../scripts/prerender-seo.mjs';
import { visitSummary } from '../../pages/place/placeAttributes';
import type { Attraction } from '../../api/placeApi';
import { DEAL_CONDITIONS_NOTE, dealOfferKind } from '../copy.mjs';
const routes = extractRoutes(readFileSync('src/App.tsx', 'utf8'));
describe('initial routing from the App route declarations', () => {
  it.each(['/shop/products/123', '/en/attractions/13686', '/en/regions/11740', '/en/games/landslide', '/oauth/callback?code=x', '/shop/orders/', '/SHOP/orders', '/party/ABCD'])('preserves valid routes: %s', (path) => {
    expect(permitsRoute(routes, '1989v.com', path)).toBe(true);
  });
  it('preserves host conditions and unknown IDs as upstream existence checks', () => {
    expect(permitsRoute(routes, 'blog.1989v.com', '/posts/not-yet-published')).toBe(true);
    expect(permitsRoute(routes, '1989v.com', '/posts/article')).toBe(false);
    expect(permitsRoute(routes, 'resume.1989v.com', '/d/private')).toBe(true);
    expect(permitsRoute(routes, '1989v.com', '/d/private')).toBe(false);
    expect(permitsRoute(routes, 'game.1989v.com', '/audit-nonexistent-20261018')).toBe(false);
    expect(NOT_FOUND_HTML).toContain('noindex,follow');
    expect(NOT_FOUND_HTML).toContain('href="/"');
    expect(nginxRouteMap(routes)).toContain('default 0;');
  });
  it('rejects a new unsupported dynamic path or host guard rather than silently losing it', () => {
    expect(() => extractRoutes('<Route path={dynamic} />')).toThrow();
    expect(() => extractRoutes('{unknownHost && <Route path="/new" />}')).toThrow();
  });
});
it('preserves source lines and deduplicates identical parking information', () => {
  const summary = visitSummary({ useTime: 'Summer: 09:00–18:00<br>Winter: 09:00–17:00', attrParking: true, parking: 'Parking available' } as unknown as Attraction, 'en');
  const cell = (label: string) => summary.rows.find((r) => r.label === label)?.value;
  expect(cell('Hours')).toBe('Summer: 09:00–18:00\nWinter: 09:00–17:00');
  expect(cell('Parking')).toBe('Parking available');
});
it('uses the actual PREOPEN status and resumes a normal link on OPEN', () => {
  const pending = siteFooter('en', [{ code: 'rank', status: 'PREOPEN' }]);
  expect(pending).toContain('Rankings (coming soon)');
  expect(pending).not.toContain('href="https://rank.1989v.com"');
  expect(siteFooter('en', [{ code: 'rank', status: 'OPEN' }])).toContain('href="https://rank.1989v.com"');
});
it('initial deals show source conditions limitations without inventing a verification date', () => {
  const shell = '<html><head><!--seo:start--><!--seo:end--></head><body><div id="root"></div></body></html>';
  const html = renderDealHubHtml(shell, []);
  expect(html).toContain(DEAL_CONDITIONS_NOTE);
  expect(dealOfferKind({ title: '이벤트 전체보기', summary: null })).toBe('이벤트 모음');
  expect(dealOfferKind({ title: 'LINK 할인 안내', summary: null })).toBe('혜택 안내');
});

it('preserves explicit and default React Router case sensitivity', () => {
  const fixture = extractRoutes('<Routes><Route path="/Exact" caseSensitive /><Route path="/Loose" caseSensitive={false} /></Routes>');
  expect(permitsRoute(fixture, '1989v.com', '/Exact')).toBe(true);
  expect(permitsRoute(fixture, '1989v.com', '/exact')).toBe(false);
  expect(permitsRoute(fixture, '1989v.com', '/LOOSE')).toBe(true);
  expect(() => extractRoutes('<Route path="/x" caseSensitive={dynamic} />')).toThrow();
});

it('uses the real source update date while keeping collection time explicitly unknown', () => {
  const status = (modifiedAt?: string) => visitSummary({ modifiedAt } as Attraction, 'en').rows.at(-1)!.value;
  expect(status('2026-06-23T11:37:49')).toContain('Source updated: 2026-06-23');
  expect(status('2026-06-23T23:50:00-09:00')).toContain('Source updated: 2026-06-23');
  expect(status()).toContain('Source updated: Not provided');
  expect(status()).toContain('Collected: Not provided');
});

it.each(['ko', 'en'])('initial game detail preserves verified player labels: %s', (lang) => {
  const shell = '<html><head><!--seo:start--><!--seo:end--></head><body><div id="root"></div></body></html>';
  const game = { slug: 'landslide', title: 'Landslide', titleEn: 'Landslide', genre: 'ACTION', description: 'Test', playerMode: 'SINGLE', tags: [], playCount: 0, ratingCount: 0 };
  expect(renderDetail(shell, lang, game, [])).toContain(lang === 'en' ? 'Solo practice · Online 1v1' : '혼자 연습 · 온라인 1대1');
  expect(renderDetail(shell, lang, { ...game, slug: 'other', playerMode: 'MULTI' }, [])).toContain(lang === 'en' ? '2+ players' : '2인 이상');
});
