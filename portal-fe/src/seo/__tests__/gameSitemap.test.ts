import { afterEach, expect, it, vi } from 'vitest';
import { renderGameSitemap } from '../../../scripts/prerender-seo.mjs';
import { gameUrl } from '../copy.mjs';

const game = (slug: string, contentUpdatedAt?: string, releasedAt?: string) => ({
  slug, genre: 'PUZZLE', contentUpdatedAt, releasedAt,
});
function dates(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return Object.fromEntries(Array.from(doc.querySelectorAll('url')).map((url) => [
    url.querySelector('loc')!.textContent,
    url.querySelector('lastmod')?.textContent ?? null,
  ]));
}
afterEach(() => vi.useRealTimers());

it('emits actual FE dates for both language homepages and all edited guides', () => {
  const games = ['block-burst', 'mine-pioneer', 'rift-front'].map((slug) => game(slug, '2026-08-17'));
  const result = dates(renderGameSitemap(games));
  for (const lang of ['ko', 'en']) {
    expect(result[gameUrl(lang)]).toBe('2026-10-15');
    for (const g of games) expect(result[gameUrl(lang, `/games/${g.slug}`)]).toBe('2026-10-15');
    expect(result[gameUrl(lang, '/games/genre/puzzle')]).toBeNull();
  }
});

it('keeps newer real API dates and the existing date priority for untouched games', () => {
  const result = dates(renderGameSitemap([
    game('block-burst', '2026-10-15T23:30:00-03:00', '2026-08-17'),
    game('mine-pioneer', '2026-10-01', '2026-10-17T00:00:00Z'),
    game('untouched', '2026-09-20', '2026-10-10'),
    game('release-only', undefined, '2026-09-21T12:00:00+09:00'),
  ]));
  for (const lang of ['ko', 'en']) {
    expect(result[gameUrl(lang)]).toBe('2026-10-17');
    expect(result[gameUrl(lang, '/games/block-burst')]).toBe('2026-10-16');
    expect(result[gameUrl(lang, '/games/mine-pioneer')]).toBe('2026-10-17');
    expect(result[gameUrl(lang, '/games/untouched')]).toBe('2026-09-20');
    expect(result[gameUrl(lang, '/games/release-only')]).toBe('2026-09-21');
  }
});

it('omits invalid API dates, including impossible calendar days, without losing edited content dates', () => {
  const result = dates(renderGameSitemap([
    game('block-burst', '2026-02-30', '2026-13-01'),
    game('invalid', 'not-a-date', '2026-09-01'),
    game('invalid-day', '2026-02-30T12:00:00Z'),
    game('invalid-month', undefined, '2026-13-01'),
    game('no-date'),
  ]));
  expect(result[gameUrl('ko')]).toBe('2026-10-15');
  expect(result[gameUrl('ko', '/games/block-burst')]).toBe('2026-10-15');
  for (const slug of ['invalid', 'invalid-day', 'invalid-month', 'no-date']) {
    expect(result[gameUrl('ko', `/games/${slug}`)]).toBeNull();
  }
});

it('produces identical XML across build times, including an empty catalog', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T00:00:00Z'));
  const games = [game('rift-front', '2026-08-17')];
  const first = renderGameSitemap(games), empty = renderGameSitemap([]);
  vi.setSystemTime(new Date('2027-07-01T00:00:00Z'));
  expect(renderGameSitemap(games)).toBe(first);
  expect(renderGameSitemap([])).toBe(empty);
  expect(dates(empty)[gameUrl('en')]).toBe('2026-10-15');
});
