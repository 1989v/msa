import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import catalog from './fixtures/game-catalog-20261015.json';
import { gameGuideSources, gamePlayGuide, gameSelectionGuide } from '../gameGuide.mjs';
import { gameDetailLastmod } from '../gameContentDates.mjs';
import { detailMeta, videoGameJsonLd } from '../copy.mjs';
import { renderDetail } from '../../../scripts/prerender-seo.mjs';
import { GameAboutPanel } from '../../pages/games/GameDetailPanels';
import { displayTitle, type GameDetail } from '../../api/gameApi';

const shell = '<html><head><!--seo:start--><!--seo:end--></head><body><div id="root"></div></body></html>';

it.each(['ko', 'en'] as const)('all 82 catalog games share complete initial/live instructions and unique titles: %s', (lang) => {
  expect(catalog).toHaveLength(82);
  const titles = catalog.map(game => detailMeta(lang, game).title);
  expect(new Set(titles).size).toBe(82);
  expect(gameSelectionGuide(lang).picks.map(pick => pick.slug)).toEqual(['block-burst', 'mine-pioneer', 'rift-front']);
  for (const item of catalog) {
    expect(gameDetailLastmod(item)).toBe('2026-10-15');
    const game = { ...item, description: '게임 소개', descriptionEn: 'Game introduction', ratingCount: 0 } as GameDetail;
    const guide = gamePlayGuide(game.slug, lang)!;
    expect(guide.length, game.slug).toBeGreaterThanOrEqual(3);
    for (const source of gameGuideSources(game.slug)) {
      expect(existsSync(resolve(__dirname, '../../../public/games', source)), source).toBe(true);
    }
    expect(gameGuideSources(game.slug).length).toBeGreaterThan(0);
    const html = new DOMParser().parseFromString(renderDetail(shell, lang, game, [game]), 'text/html');
    const live = render(<MemoryRouter><GameAboutPanel game={game} lang={lang} favorites={null} /></MemoryRouter>);
    for (const line of guide) {
      expect(line.text.trim().length).toBeGreaterThan(12);
      if (lang === 'en') expect(line.text).not.toMatch(/[가-힣]/u);
      expect(html.querySelector('.game-play-guide')?.textContent).toContain(line.text);
      expect(live.container.querySelector('.game-play-guide')?.textContent).toContain(line.text);
    }
    expect(html.querySelector('h1')?.textContent).toBe(detailMeta(lang, game).heading);
    live.unmount();
  }
});

it.each(['ko', 'en'])('distinguishes the two archer games in heading and schema: %s', (lang) => {
  const games = catalog.filter(game => ['marine-command', 'archer-outbreak'].includes(game.slug));
  expect(new Set(games.map(game => detailMeta(lang, game).heading)).size).toBe(2);
  for (const game of games) {
    expect(videoGameJsonLd(lang, game).name).toBe(detailMeta(lang, game).heading);
    expect(displayTitle(game, lang as 'ko' | 'en')).toBe(detailMeta(lang, game).heading);
  }
});

it('keeps the existing title-only display contract and English fallback', () => {
  expect(displayTitle({ title: '원래 이름', titleEn: null }, 'en')).toBe('원래 이름');
  expect(displayTitle({ title: '원래 이름', titleEn: 'Original' }, 'en')).toBe('Original');
  expect(displayTitle({ title: '원래 이름', titleEn: 'Original' }, 'ko')).toBe('원래 이름');
});
