import { catalogGuides } from './gameGuideCatalog.mjs';

/** Actual FE content edits, not deployment/build dates. Update alongside the edited copy. */
export const GAME_HUB_UPDATED_AT = '2026-10-15';
export const DRAW_UPDATED_AT = '2026-10-15';
const GUIDE_UPDATED_AT = {
  // The complete catalog gained bilingual instructions/detail titles on this date.
  ...Object.fromEntries(Object.keys(catalogGuides).map(slug => [slug, '2026-10-15'])),
  'marble-race': '2026-10-15',
  'block-burst': '2026-10-15',
  'mine-pioneer': '2026-10-15',
  'rift-front': '2026-10-15',
};

function validDate(value) {
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  // Date silently rolls invalid calendar days forward (e.g. February 30).
  const calendar = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function latestDate(values) {
  return values.map(validDate).filter(Boolean).sort().at(-1) ?? null;
}

export function gameDetailLastmod(game) {
  const guideDate = Object.hasOwn(GUIDE_UPDATED_AT, game.slug) ? GUIDE_UPDATED_AT[game.slug] : null;
  return guideDate
    ? latestDate([guideDate, game.contentUpdatedAt, game.releasedAt])
    : validDate(game.contentUpdatedAt || game.releasedAt);
}

export function gameHubLastmod(games) {
  return latestDate([GAME_HUB_UPDATED_AT, ...games.flatMap((game) => [game.contentUpdatedAt, game.releasedAt])]);
}
