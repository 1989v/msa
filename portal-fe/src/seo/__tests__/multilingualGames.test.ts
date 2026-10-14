import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { renderDetail, renderDraw, renderGameSitemap, renderGenre, renderHub } from '../../../scripts/prerender-seo.mjs';
import { descriptionOf, detailMeta, drawMeta, gameDiscoveryLinks, gameUrl, hreflangAlternates, videoGameJsonLd } from '../copy.mjs';
import { drawCopy, marbleEditorial } from '../gameEditorial.mjs';
import { displayDescription } from '../../api/gameApi';
import { gamePlayGuide } from '../gameGuide.mjs';
const shell = '<html lang="ko"><head><!--seo:start--><title>x</title><!--seo:end--></head><body><div id="root"></div></body></html>';
const legacy = { slug: 'marble-race', title: '구슬 레이스', titleEn: 'Marble Race', genre: 'DECIDER', tags: [], description: '맵 3종 같은 같은 코드', descriptionEn: 'Three old maps', ratingCount: 0, contentUpdatedAt: '2026-09-10' };
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
it.each(['ko', 'en'] as const)('overrides legacy API text everywhere using one introduction: %s', (lang) => {
  const html = renderDetail(shell, lang, legacy, [legacy]);
  const doc = parse(html), editorial = marbleEditorial(lang);
  expect(displayDescription(legacy, lang)).toBe(editorial.description);
  expect(descriptionOf(legacy, lang)).toBe(editorial.description);
  expect(doc.title).toBe(detailMeta(lang, legacy).title);
  expect(doc.querySelector('h1')?.textContent).toBe(editorial.heading);
  expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(detailMeta(lang, legacy).description);
  expect(doc.body.textContent).toContain(editorial.description);
  for (const line of gamePlayGuide('marble-race', lang)!) expect(doc.body.textContent).toContain(line.text);
  const schema = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map((el) => JSON.parse(el.textContent!));
  expect(schema).toContainEqual(videoGameJsonLd(lang, legacy));
  expect(html).not.toContain(legacy.description);
  expect(html).not.toContain(legacy.descriptionEn);
  expect(displayDescription({ description: 'Original', descriptionEn: null }, lang)).toBe('Original');
  expect(descriptionOf({ ...legacy, slug: 'other' }, lang)).toBe(lang === 'en' ? legacy.descriptionEn : legacy.description);
});
it.each(['ko', 'en'])('provides localized public HTML and reciprocal discovery signals: %s', (lang) => {
  const copy = drawCopy(lang), doc = parse(renderDraw(shell, lang));
  expect(doc.documentElement.lang).toBe(lang);
  expect(doc.title).toBe(drawMeta(lang).title);
  expect(doc.querySelector('h1')?.textContent).toBe(copy.heading);
  for (const text of [copy.intro, copy.privacy, ...copy.steps]) expect(doc.body.textContent).toContain(text);
  expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '').not.toContain('noindex');
  expect(doc.querySelector('input, textarea, iframe')).toBeNull();
  for (const [sub, html] of [['/draw', renderDraw(shell, lang)], ['/games/marble-race', renderDetail(shell, lang, legacy, [legacy])]]) {
    const detail = parse(html);
    expect(detail.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(gameUrl(lang, sub));
    for (const alt of hreflangAlternates(sub)) expect(detail.querySelector(`link[hreflang="${alt.hreflang}"]`)?.getAttribute('href')).toBe(alt.href);
  }
  for (const html of [renderDraw(shell, lang), renderHub(shell, lang, [legacy]), renderGenre(shell, lang, 'DECIDER', [legacy], [legacy]), renderDetail(shell, lang, legacy, [legacy])]) {
    const page = parse(html);
    for (const { href, label } of gameDiscoveryLinks(lang).links) expect(Array.from(page.querySelectorAll(`a[href="${href}"]`)).map((a) => a.textContent)).toContain(label);
  }
  if (lang === 'en') expect(doc.body.textContent).not.toMatch(/내기|참가자|이름/);
});
it('lists public URLs with actual dates and excludes private state and frames', () => {
  const xml = renderGameSitemap([legacy]), doc = new DOMParser().parseFromString(xml, 'application/xml');
  for (const lang of ['ko', 'en']) for (const sub of ['/draw', '/games/marble-race']) {
    const entry = Array.from(doc.querySelectorAll('url')).find((url) => url.querySelector('loc')?.textContent === gameUrl(lang, sub));
    expect(entry?.querySelector('lastmod')?.textContent).toBe('2026-10-15');
    for (const alt of hreflangAlternates(sub)) expect(entry?.innerHTML).toContain(alt.href);
  }
  expect(xml).toContain('/games/genre/decider');
  expect(xml).not.toMatch(/\/party|\?r=|names=|index\.html|\/account/);
  const nginx = readFileSync('nginx.conf', 'utf8');
  expect(nginx).toContain('location ~ ^/(en/)?draw$');
  expect(nginx).toContain('try_files /prerender/$1draw.html /index.html;');
  expect(nginx).toContain('add_header X-Robots-Tag "noindex, follow"');
  expect(readFileSync('src/pages/party/PartyPage.tsx', 'utf8')).toContain('noindex: true');
});

it('limits root invitation HTTP noindex to the same host, path and r presence recognized by the app', () => {
  const config = readFileSync('nginx.conf', 'utf8');
  const rule = config.match(/"~([^"\n]+)" "noindex, follow";/)![1];
  const matches = (hostEnabled: number, path: string, args: string) => new RegExp(rule).test(`${hostEnabled}:${path}${args ? `?${args}` : ''}`);
  for (const args of ['r=ABC234', 'r=', 'r', 'r=ABC234&r=ABC234', 'x=1&r=bad', '%72=ABC234', 'x=1&r=&y=2']) expect(matches(1, '/', args)).toBe(true);
  for (const args of ['', 'q=r', 'rr=ABC234', 'R=ABC234', 'x=1&name=r']) expect(matches(1, '/', args)).toBe(false);
  for (const path of ['/en', '/draw', '/en/draw', '/games/marble-race']) expect(matches(1, path, 'r=ABC234')).toBe(false);
  expect(matches(0, '/', 'r=ABC234')).toBe(false);
  expect(config).toContain('default $host_robots_tag;');
  expect(config).toContain('map "$invitation_host:$request_uri" $root_robots_tag');
  expect(config).toMatch(/location = \/ \{[^}]*X-Robots-Tag \$root_robots_tag always;/);
  expect(config).toContain('location ~ ^/(en/)?party(/[^/]+)?/?$');
  expect(config).toMatch(/location ~ \^\/\(en\/\)\?draw\$ \{[^}]*try_files \/prerender\/\$1draw.html \/index.html;/);
});
