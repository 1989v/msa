import { expect, it } from 'vitest';
import { PUBLIC_GAME_SLUGS } from '../publicGameSlugs.mjs';
import { catalogGuides } from '../gameGuideCatalog.mjs';
import catalog from './fixtures/game-catalog-20261015.json';

it('keeps the lightweight public route set in parity with all verified catalog routes', () => {
  expect([...PUBLIC_GAME_SLUGS].sort()).toEqual(catalog.map((game) => game.slug).sort());
  expect([...PUBLIC_GAME_SLUGS].sort()).toEqual([...Object.keys(catalogGuides), 'block-burst', 'mine-pioneer', 'rift-front', 'marble-race'].sort());
});
