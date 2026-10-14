import { MemoryRouter } from 'react-router-dom';
import { marbleEditorial } from '../../../seo/gameEditorial.mjs';
import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { GameAboutPanel } from '../GameDetailPanels';
import type { GameDetail } from '../../../api/gameApi';
import { gamePlayGuide } from '../../../seo/gameGuide.mjs';

it.each(['ko', 'en'] as const)('shares source instructions for all selected games: %s', (lang) => {
  for (const slug of ['block-burst', 'mine-pioneer', 'rift-front']) {
    const game = { slug, description: '원래 소개', descriptionEn: 'Original intro', ratingCount: 0 } as GameDetail;
    const view = render(<GameAboutPanel game={game} lang={lang} favorites={2} />);
    expect(screen.getByText(lang === 'en' ? 'Original intro' : '원래 소개')).toBeTruthy();
    for (const item of gamePlayGuide(slug, lang)!) {
      expect(screen.getByText(item.label)).toBeTruthy();
      expect(screen.getByText(item.text)).toBeTruthy();
    }
    expect(view.container.textContent).toContain('♡ 2');
    view.unmount();
  }
});
it('keeps ordinary game introductions and ratings without added instructions', () => {
  const game = { slug: 'other', description: '설명', ratingCount: 1, ratingAvg: 8 } as GameDetail;
  const view = render(<GameAboutPanel game={game} lang="ko" favorites={null} />);
  expect(screen.getByText('설명')).toBeTruthy();
  expect(view.container.querySelector('.game-play-guide')).toBeNull();
  expect(view.container.textContent).toContain('4.0');
});

it.each(['ko', 'en'] as const)('shows authoritative pinball copy instead of legacy database text: %s', (lang) => {
  const game = { slug: 'marble-race', description: '맵 3종 같은 같은 코드', descriptionEn: 'Three old maps', ratingCount: 0 } as GameDetail;
  render(<MemoryRouter><GameAboutPanel game={game} lang={lang} favorites={null} /></MemoryRouter>);
  expect(screen.getByText(marbleEditorial(lang).description)).toBeInTheDocument();
  for (const item of gamePlayGuide(game.slug, lang)!) expect(screen.getByText(item.text)).toBeInTheDocument();
  expect(screen.queryByText(game.description)).toBeNull();
  expect(screen.queryByText(game.descriptionEn!)).toBeNull();
});
