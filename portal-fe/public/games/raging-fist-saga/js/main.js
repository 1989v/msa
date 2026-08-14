// 부트스트랩: 캔버스 스케일링, 고정 타임스텝 루프, 화면 상태 라우팅.

import { VW, VH, clamp, makeCanvas } from './core.js';
import { initInput, inputTick, endFrame, pressed, held, clearBuffer, debugHistory } from './input.js';
import { initAudio, resumeAudio, playBgm, stopBgm, sfx, toggleMute } from './audio.js';
import { bakeChars, sprites } from './sprites.js';
import { Game } from './game.js';
import * as UI from './ui.js';
import { FX, updateFx, drawFlash, fxReset } from './fx.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });
const buf = makeCanvas(VW, VH);
const bctx = buf.ctx;

let S = 3;
function resize() {
  const pad = 8;
  const maxS = Math.min((window.innerWidth - pad) / VW, (window.innerHeight - pad) / VH);
  S = clamp(Math.floor(maxS * 2) / 2, 1, 4);
  if (S >= 2) S = Math.floor(S);
  canvas.width = Math.round(VW * S);
  canvas.height = Math.round(VH * S);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

const game = new Game();
let screen = 'boot';
let paused = false, showList = false;
let t = 0, acc = 0, last = performance.now(), slowAcc = 0;
let bootProgress = 0;

initInput(window);

async function boot() {
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  await bakeChars(['hero'], (p) => { bootProgress = p; });
  screen = 'title';
  document.getElementById('boot')?.remove();
}
boot();

let audioReady = false;
function ensureAudio() {
  if (audioReady) return;
  audioReady = true;
  initAudio();
  resumeAudio();
  if (screen === 'title') playBgm('title');
}
window.addEventListener('keydown', ensureAudio, { once: true });
window.addEventListener('pointerdown', () => { ensureAudio(); }, { once: true });

function toTitle() {
  screen = 'title';
  game.state = 'title';
  game.boss = null;
  fxReset();
  stopBgm(); playBgm('title');
}

function routeKeys() {
  if (pressed('mute')) { toggleMute(); }
  if (pressed('list') && (screen === 'title' || screen === 'game')) {
    showList = !showList;
    sfx('menu');
  }
  if (pressed('pause')) {
    if (showList) { showList = false; sfx('menu'); }
    else if (screen === 'game' && (game.state === 'play' || game.state === 'intro')) {
      paused = !paused; sfx('menu');
    }
  }

  if (screen === 'title') {
    if (pressed('start') && !showList) {
      sfx('select');
      screen = 'game';
      fxReset();
      game.newGame();
    }
    return;
  }
  if (screen !== 'game') return;

  if (game.state === 'clear' && game.clearT > 60 && pressed('start')) {
    sfx('select');
    fxReset();
    game.nextStage();
    if (game.state === 'ending') screen = 'game';
  } else if (game.state === 'over' && pressed('start')) {
    sfx('select');
    game.useContinue();
  } else if (game.state === 'gameover' && pressed('start')) {
    toTitle();
  } else if (game.state === 'ending' && pressed('start')) {
    toTitle();
  }
}

function step() {
  inputTick(game.player ? game.player.dir : 1);
  routeKeys();
  if (screen === 'game' && !paused && !showList) {
    const ts = game.timeScale;
    slowAcc += ts;
    while (slowAcc >= 1) { slowAcc -= 1; game.update(); }
  } else if (screen === 'title') {
    updateFx();
  }
  endFrame();
  t++;
}

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.imageSmoothingEnabled = false;

  if (screen === 'boot') {
    ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, W, H);
    UI.drawLoading(ctx, { bakeProgress: bootProgress }, S, W, H);
    return;
  }

  if (screen === 'title') {
    UI.drawTitle(ctx, S, W, H, t, !!localStorage.getItem('rfs_hidden'));
    const hero = sprites('hero');
    if (hero) {
      const clip = hero.idle;
      const f = clip[Math.floor(t / 7) % clip.length];
      const hs = S * 1.85;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.95;
      ctx.translate(W * 0.83, H * 0.68);
      ctx.scale(hs, hs);
      ctx.drawImage(f.c, f.ox, f.oy);
      ctx.restore();
    }
    if (showList) UI.drawCommandList(ctx, S, W, H);
    return;
  }

  if (game.state === 'loading') {
    ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, W, H);
    UI.drawLoading(ctx, game, S, W, H);
    return;
  }

  // 월드
  bctx.imageSmoothingEnabled = false;
  game.render(bctx);

  const zoom = game.slowmo > 0 ? 1 + 0.14 * (game.slowmo / 130) : 1;
  const fx = FX.shakeX * S, fy = FX.shakeY * S;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (zoom > 1.001) {
    const cx = clamp((game.boss ? game.boss.x : game.player.x) - game.cam, 60, VW - 60);
    const cy = 150;
    const dw = W * zoom, dh = H * zoom;
    ctx.drawImage(buf.c, fx - (cx / VW) * (dw - W), fy - (cy / VH) * (dh - H), dw, dh);
  } else {
    ctx.drawImage(buf.c, fx, fy, W, H);
  }

  if (game.state === 'play' || game.state === 'intro' || game.state === 'over') {
    UI.drawHud(ctx, game, S, W, H);
  }
  if (game.state === 'intro') UI.drawStageIntro(ctx, game, S, W, H);
  if (game.state === 'clear') UI.drawClear(ctx, game, S, W, H);
  if (game.state === 'over') UI.drawGameOver(ctx, game, S, W, H, true);
  if (game.state === 'gameover') UI.drawGameOver(ctx, game, S, W, H, false);
  if (game.state === 'ending') UI.drawEnding(ctx, game, S, W, H, t);
  drawFlash(ctx, W, H);
  if (paused) UI.drawPause(ctx, S, W, H);
  if (showList) UI.drawCommandList(ctx, S, W, H);
}

function loop(now) {
  requestAnimationFrame(loop);
  let dt = now - last;
  last = now;
  if (dt > 220) dt = 220;
  acc += dt;
  const FRAME = 1000 / 60;
  let guard = 0;
  while (acc >= FRAME && guard++ < 5) { acc -= FRAME; step(); }
  render();
}
requestAnimationFrame(loop);

// 자동 검증용 읽기 전용 훅
window.__RFS = {
  get state() { return { screen, gameState: game.state, paused, showList }; },
  get player() {
    const p = game.player;
    return p ? {
      x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z), hp: Math.round(p.hp),
      meter: Math.round(p.meter), lives: p.lives, move: p.moveId || null, state: p.state,
      weapon: p.weapon ? p.weapon.kind : null, scrolls: p.scrolls, hidden: p.hiddenUnlocked,
      dir: p.dir, clip: p.clip,
    } : null;
  },
  get world() {
    return {
      stage: game.stageIdx, section: game.sectionIdx, wave: game.waveIdx, waveState: game.waveState,
      enemies: game.enemies().length, boss: game.boss ? Math.round(game.boss.hp) : null,
      combo: game.combo, maxCombo: game.stats.maxCombo, score: game.score,
      secrets: game.stats.secrets, scrolls: game.hidden.scrolls, room: game.room ? game.room.id : null,
      props: game.props.length, pickups: game.pickups.length, camLocked: game.camLocked,
      msg: game.msgT > 0 && game.msg ? game.msg.text : null,
    };
  },
  game,
  hist: () => debugHistory(),
};
