// Boot: wait for the bitmap font so the very first frame already has correct
// metrics, then hand off to the game loop.

import { Game } from './game.js';

const FONTS = [
  '22px Galmuri11',
  '22px Galmuri11Bold',
  '22px Galmuri14',
  '18px Galmuri9',
];

async function waitForFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all(FONTS.map((f) => document.fonts.load(f, '심연의 왕관 0123')));
    await document.fonts.ready;
  } catch (e) {
    // Fall through to the monospace fallback rather than blocking the boot.
  }
}

async function boot() {
  const canvas = document.getElementById('game');
  const loader = document.getElementById('loader');
  await waitForFonts();

  const game = new Game(canvas);
  game.init();

  if (loader) {
    loader.classList.add('gone');
    setTimeout(() => loader.remove(), 600);
  }
  // Exposed for automated play-testing.
  window.__abyssal = game;
}

boot();
