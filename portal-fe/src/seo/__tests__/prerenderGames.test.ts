import { gamePlayGuide, gameSelectionGuide } from '../gameGuide.mjs';
import { gameUrl } from '../copy.mjs';
import { expect, it } from 'vitest';
import { renderDetail, renderHub } from '../../../scripts/prerender-seo.mjs';
import { gameHubGuide } from '../copy.mjs';
const shell = '<html><head><!--seo:start--><title>x</title><!--seo:end--></head><body><div id="root"></div></body></html>';
const game = { slug: 'test', title: '<Test & play>', titleEn: 'Test & play', genre: 'ACTION', tags: [], description: '소개 <script>danger</script> & 설명', descriptionEn: 'Read <intro> & play', playerMode: 'MULTI', supportsMobile: true, estimatedMinutes: 5, ratingCount: 1, ratingAvg: 8 };
it.each(['ko', 'en'])('shares visible guide and language links: %s', (lang) => { const html = renderHub(shell, lang, [game]); const doc = new DOMParser().parseFromString(html, 'text/html'); const guide = gameHubGuide(lang); expect(doc.querySelector('#games-guide-heading')?.textContent).toBe(guide.heading); for (const text of guide.paragraphs) expect(doc.body.textContent).toContain(text); for (const item of guide.genres) expect(doc.querySelector(`section a[href="${item.href}"]`)?.textContent).toBe(item.label); expect(html.indexOf('games-guide-heading')).toBeGreaterThan(html.indexOf('/games/test')); expect(doc.body.textContent).toContain(lang === 'ko' ? game.title : game.titleEn); expect(doc.querySelector('intro')).toBeNull(); });
it('escapes intro and includes only known facts before ratings', () => { const html = renderDetail(shell, 'ko', game, [game]); const doc = new DOMParser().parseFromString(html, 'text/html'); expect(doc.body.textContent).toContain(game.description); expect(doc.body.querySelector('script')).toBeNull(); expect(doc.body.textContent).toContain('2인 이상'); expect(doc.body.textContent).toContain('모바일 지원'); expect(html.indexOf('소개 &lt;script&gt;')).toBeLessThan(html.indexOf('★')); const unknown = renderDetail(shell, 'en', { ...game, playerMode: null, supportsMobile: false, estimatedMinutes: null }, [game]); expect(unknown).not.toContain('<li>Single player</li>'); expect(unknown).not.toContain('<li>Mobile</li>'); });

it.each(['ko', 'en'])('renders verified selection and instructions from shared copy: %s', (lang) => {
  const hub = new DOMParser().parseFromString(renderHub(shell, lang, [game]), 'text/html');
  for (const pick of gameSelectionGuide(lang).picks) {
    expect(hub.querySelector(`section a[href="${pick.href}"]`)?.textContent).toBe(pick.title);
    expect(hub.body.textContent).toContain(pick.reason);
    const target = { ...game, slug: pick.slug, entryUrl: `/games/${pick.slug}/index.html` };
    const html = renderDetail(shell, lang, target, [target]);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const item of gamePlayGuide(pick.slug, lang)!) {
      expect(doc.querySelector('.game-play-guide')?.textContent).toContain(item.label);
      expect(doc.querySelector('.game-play-guide')?.textContent).toContain(item.text);
    }
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(gameUrl(lang, `/games/${pick.slug}`));
    expect(html.indexOf('class="game-play-guide"')).toBeGreaterThan(html.indexOf('소개 &lt;script&gt;') >= 0 ? html.indexOf('소개 &lt;script&gt;') : html.indexOf('Read &lt;intro&gt;'));
    expect(html.indexOf('class="game-play-guide"')).toBeLessThan(html.indexOf('★'));
  }
});
it('leaves non-target introductions unchanged', () => {
  expect(gamePlayGuide('test', 'ko')).toBeNull();
  expect(gamePlayGuide('toString', 'ko')).toBeNull();
  expect(renderDetail(shell, 'ko', game, [game])).not.toContain('game-play-guide');
});
