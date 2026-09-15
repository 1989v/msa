// forge 픽스처 — window.__forge 계약을 만족하는 최소 아레나 게임. 게이트가 "통과 가능한지" 와
// "회귀를 주입하면 빨간불이 나는지" 를 증명하는 용도다. 재미는 목표가 아니다.
'use strict';
(() => {
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const DT = 1 / 60;
const WORLD = { w: 1600, floorTop: 300, floorBottom: 540, h: 540 };

// ---- 시드 RNG (Math.random 금지) ----
let rngState = 1;
function seedRng(s) { rngState = (s >>> 0) || 1; }
let vState = 7;
function vrnd() { vState |= 0; vState = (vState + 0x6d2b79f5) | 0; let t = Math.imul(vState ^ (vState >>> 15), 1 | vState); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } // 렌더 전용 — 시뮬레이션 RNG 를 소비하지 않는다
function rnd() { rngState |= 0; rngState = (rngState + 0x6d2b79f5) | 0; let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

// ---- 오디오 (WebAudio 합성) ----
let ac = null;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
function tone(freq, ms, type = 'square', gain = 0.08, slide = 0) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + ms / 1000);
  g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + ms / 1000 + 0.02);
}
const SFX = {
  slash: () => tone(900, 80, 'sawtooth', 0.05, -600), hit: () => tone(110, 90, 'square', 0.1, -60), hurt: () => tone(160, 140, 'sawtooth', 0.08, -100),
  dash: () => tone(300, 110, 'square', 0.05, 500), spin: () => tone(220, 220, 'triangle', 0.07, 400), bolt: () => tone(1200, 120, 'sine', 0.05, -900),
  die: () => tone(200, 400, 'sawtooth', 0.09, -180), enemy_die: () => tone(500, 150, 'square', 0.06, -450), telegraph: () => tone(700, 60, 'sine', 0.04), ui: () => tone(880, 40, 'sine', 0.05),
};
const MUSIC = { arena: true };
const SCALE = [110, 131, 147, 165, 196, 220, 262];
let musicTick = 0;
function musicStep() { if (game.scene !== 'play') return; musicTick++; if (musicTick % 8 === 0) tone(SCALE[(musicTick / 8) % SCALE.length | 0] / 2, 120, 'triangle', 0.03); if (musicTick % 16 === 4) tone(SCALE[Math.floor(vrnd() * SCALE.length)] * 2, 90, 'sine', 0.02); }

// ---- 콘텐츠 ----
const STAGES = [
  { id: 'S1', name: '성문', sky: '#2a3d6b', ground: '#4a5a3a', far: '#1d2b4d', waves: [['grunt', 5], ['hound', 3]] },
  { id: 'S2', name: '안뜰', sky: '#6b3d2a', ground: '#5a3a2a', far: '#4d2b1d', waves: [['brute', 2], ['archer', 3]] },
  { id: 'S3', name: '회랑', sky: '#2a6b5a', ground: '#2a4a3a', far: '#1d4d3d', waves: [['shield', 3], ['mage', 2]] },
  { id: 'S4', name: '탑', sky: '#5a2a6b', ground: '#3a2a4a', far: '#3d1d4d', waves: [['grunt', 3], ['archer', 2], ['hound', 2], ['brute', 1]] },
  { id: 'S5', name: '왕좌', sky: '#6b1a1a', ground: '#4a2a2a', far: '#4d0d0d', waves: [['warden', 1], ['grunt', 2]] },
];
const ENEMY = {
  grunt:  { hp: 40, speed: 3.0, dmg: 26, range: 40, color: '#c94f4f', w: 36, h: 60, telegraph: 20, cooldown: 36 },
  brute:  { hp: 70, speed: 1.6, dmg: 22, range: 56, color: '#8a5a2a', w: 56, h: 80, telegraph: 30, cooldown: 70 },
  archer: { hp: 22, speed: 2.2, dmg: 9, range: 320, color: '#4f9fc9', w: 32, h: 58, telegraph: 28, cooldown: 80, ranged: true, keep: 220 },
  hound:  { hp: 24, speed: 4.6, dmg: 18, range: 34, color: '#c9a04f', w: 44, h: 36, telegraph: 16, cooldown: 28 },
  shield: { hp: 45, speed: 1.9, dmg: 14, range: 44, color: '#7f8fa0', w: 44, h: 66, telegraph: 26, cooldown: 60, guard: 0.5 },
  mage:   { hp: 26, speed: 1.4, dmg: 16, range: 260, color: '#a04fc9', w: 34, h: 62, telegraph: 34, cooldown: 90, ranged: true, keep: 200, blink: true },
  warden: { hp: 300, speed: 2.0, dmg: 20, range: 70, color: '#e0c060', w: 80, h: 110, telegraph: 30, cooldown: 60, boss: true },
};
const CONTENT = {
  stages: STAGES.map((s) => ({ id: s.id, name: s.name })),
  enemyTypes: ['grunt', 'brute', 'archer', 'hound', 'shield', 'mage'],
  bosses: [{ id: 'warden', stage: 'S5', phases: 2 }],
  skills: ['slash', 'dash', 'spin', 'bolt'],
  items: [],
  secrets: 0,
};
const FEEL = { hitstopMs: 60, shakePx: 4, telegraphMs: 400 };

// ---- 입력: 이벤트는 상태만 기록, 판정은 step 안에서 ----
const KEYS = [
  { code: 'ArrowLeft', action: 'left' }, { code: 'ArrowRight', action: 'right' }, { code: 'ArrowUp', action: 'up' }, { code: 'ArrowDown', action: 'down' },
  { code: 'KeyZ', action: 'attack' }, { code: 'KeyX', action: 'dash' }, { code: 'KeyC', action: 'spin' }, { code: 'KeyV', action: 'bolt' },
];
const input = { held: new Set(), pressed: new Set(), stick: { x: 0, y: 0 } };
const actionOf = {}; for (const k of KEYS) actionOf[k.code] = k.action;
window.addEventListener('keydown', (e) => { const a = actionOf[e.code]; if (!a) return; e.preventDefault(); if (!input.held.has(a)) input.pressed.add(a); input.held.add(a); audio(); });
window.addEventListener('keyup', (e) => { const a = actionOf[e.code]; if (!a) return; e.preventDefault(); input.held.delete(a); });

// 터치: 스틱 + 버튼 4개. 위치는 뷰포트 CSS px, 방향별로 다시 계산
const touchLayout = () => {
  const W = cv.clientWidth, H = cv.clientHeight;
  return {
    stick: { x: 90, y: H - 110, r: 56 },
    buttons: [
      { action: 'attack', x: W - 70, y: H - 100, r: 34 }, { action: 'dash', x: W - 140, y: H - 60, r: 28 },
      { action: 'spin', x: W - 70, y: H - 190, r: 28 }, { action: 'bolt', x: W - 150, y: H - 150, r: 28 },
    ],
  };
};
const touches = new Map(); // id → { kind:'stick'|'button', action }
function touchPos(t) { const r = cv.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }
cv.addEventListener('touchstart', (e) => {
  e.preventDefault(); audio(); const L = touchLayout();
  for (const t of e.changedTouches) {
    const p = touchPos(t);
    const b = L.buttons.find((b) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 8);
    if (b) { touches.set(t.identifier, { kind: 'button', action: b.action }); if (!input.held.has(b.action)) input.pressed.add(b.action); input.held.add(b.action); continue; }
    if (Math.hypot(p.x - L.stick.x, p.y - L.stick.y) <= L.stick.r + 20) { touches.set(t.identifier, { kind: 'stick' }); }
  }
}, { passive: false });
cv.addEventListener('touchmove', (e) => {
  e.preventDefault(); const L = touchLayout();
  for (const t of e.changedTouches) { const h = touches.get(t.identifier); if (!h || h.kind !== 'stick') continue; const p = touchPos(t); const dx = (p.x - L.stick.x) / L.stick.r, dy = (p.y - L.stick.y) / L.stick.r; const m = Math.hypot(dx, dy) || 1; const k = Math.min(1, m); input.stick.x = (dx / m) * k; input.stick.y = (dy / m) * k; }
}, { passive: false });
const endTouch = (e) => { e.preventDefault(); for (const t of e.changedTouches) { const h = touches.get(t.identifier); if (!h) continue; if (h.kind === 'stick') input.stick.x = input.stick.y = 0; else input.held.delete(h.action); touches.delete(t.identifier); } };
cv.addEventListener('touchend', endTouch, { passive: false }); cv.addEventListener('touchcancel', endTouch, { passive: false });

// ---- 게임 상태 ----
const game = { scene: 'title', stageIndex: 0, stage: null, player: null, enemies: [], projectiles: [], particles: [], progress: { stagesCleared: 0, kills: 0 }, score: 0, simTime: 0, hitstop: 0, shake: 0, clearTimer: 0, cam: { x: 0 } };
function newPlayer() { return { x: 200, y: 420, w: 40, h: 64, hp: 100, hpMax: 100, facing: 1, action: 'idle', actionT: 0, cd: { attack: 0, dash: 0, spin: 0, bolt: 0 }, inv: 0, dashV: 0 }; }
function reset(seed) { seedRng(seed || 1); game.scene = 'title'; game.stageIndex = 0; game.stage = null; game.player = newPlayer(); game.enemies = []; game.projectiles = []; game.particles = []; game.progress = { stagesCleared: 0, kills: 0 }; game.score = 0; game.simTime = 0; game.hitstop = 0; game.shake = 0; game.clearTimer = 0; }
function loadStage(i) {
  game.stageIndex = i; game.stage = { id: STAGES[i].id, index: i, cleared: false }; game.scene = 'play';
  game.player = newPlayer(); game.enemies = []; game.projectiles = []; game.particles = []; game.clearTimer = 0;
  for (const [type, n] of STAGES[i].waves) for (let k = 0; k < n; k++) spawn(type, { x: 700 + rnd() * 800, y: WORLD.floorTop + 20 + rnd() * (WORLD.floorBottom - WORLD.floorTop - 40) });
}
function begin() { loadStage(0); }
function warp(id) { const i = STAGES.findIndex((s) => s.id === id); if (i < 0) throw new Error('없는 스테이지: ' + id); loadStage(i); }
function spawn(type, opts = {}) {
  const d = ENEMY[type]; if (!d) throw new Error('없는 적: ' + type);
  const p = game.player;
  const e = { type, x: opts.near ? p.x + p.facing * 44 : (opts.x ?? 900), y: opts.near ? p.y : (opts.y ?? 420), w: d.w, h: d.h, hp: d.hp, hpMax: d.hpMax || d.hp, facing: -1, telegraph: 0, cd: 30 + Math.floor(rnd() * 30), phase: 1, flash: 0, slot: game.enemies.length * 0.8 };
  game.enemies.push(e); return e;
}

// ---- 시뮬레이션 (고정 dt) ----
function update() {
  if (game.scene !== 'play') { input.pressed.clear(); return; }
  game.simTime += DT;
  if (game.hitstop > 0) { game.hitstop--; input.pressed.clear(); return; }
  const p = game.player;
  // 이동
  let mx = (input.held.has('right') ? 1 : 0) - (input.held.has('left') ? 1 : 0) + input.stick.x;
  let my = (input.held.has('down') ? 1 : 0) - (input.held.has('up') ? 1 : 0) + input.stick.y;
  mx = Math.max(-1, Math.min(1, mx)); my = Math.max(-1, Math.min(1, my));
  for (const k in p.cd) if (p.cd[k] > 0) p.cd[k]--;
  if (p.inv > 0) p.inv--;
  if (p.actionT > 0) { p.actionT--; if (p.actionT === 0) p.action = 'idle'; }
  if (p.action === 'dash') { p.x += p.dashV; }
  else {
    if (p.action === 'idle' || p.action === 'run') { p.x += mx * 4.2; p.y += my * 3; p.action = mx || my ? 'run' : 'idle'; if (mx) p.facing = mx > 0 ? 1 : -1; }
    if (input.pressed.has('attack') && p.cd.attack === 0 && p.action !== 'spin') { p.action = 'slash'; p.actionT = 12; p.cd.attack = 20; SFX.slash(); }
    if (input.pressed.has('dash') && p.cd.dash === 0) { p.action = 'dash'; p.actionT = 12; p.dashV = p.facing * 11; p.inv = 14; p.cd.dash = 45; SFX.dash(); }
    if (input.pressed.has('spin') && p.cd.spin === 0) { p.action = 'spin'; p.actionT = 24; p.cd.spin = 90; SFX.spin(); }
    if (input.pressed.has('bolt') && p.cd.bolt === 0) { p.action = 'bolt'; p.actionT = 10; p.cd.bolt = 40; game.projectiles.push({ x: p.x + p.facing * 30, y: p.y - 30, vx: p.facing * 12, dmg: 8, friendly: true, life: 60 }); SFX.bolt(); }
  }
  p.x = Math.max(20, Math.min(WORLD.w - 20, p.x)); p.y = Math.max(WORLD.floorTop + 10, Math.min(WORLD.floorBottom - 10, p.y));
  // 플레이어 타격 판정
  const hitFrame = (p.action === 'slash' && p.actionT >= 3 && p.actionT <= 10) || (p.action === 'spin' && p.actionT % 8 === 0);
  if (hitFrame) for (const e of game.enemies) {
    const inRange = p.action === 'spin' ? Math.hypot(e.x - p.x, e.y - p.y) < 90 : ((e.x - p.x) * p.facing > 0 && Math.abs(e.x - p.x) < 70 && Math.abs(e.y - p.y) < 34);
    if (inRange && !e.hitThisSwing) { let dmg = p.action === 'spin' ? 2 : 10; if (ENEMY[e.type].guard && (e.x - p.x) * e.facing < 0) dmg *= ENEMY[e.type].guard; damageEnemy(e, dmg); e.hitThisSwing = p.action === 'slash'; }
  }
  if (p.action !== 'slash') for (const e of game.enemies) e.hitThisSwing = false;
  // 투사체
  for (const pr of game.projectiles) {
    pr.x += pr.vx; pr.life--;
    if (pr.friendly) { const e = game.enemies.find((e) => Math.abs(e.x - pr.x) < e.w / 2 + 6 && Math.abs(e.y - pr.y + 30) < e.h / 2 + 10); if (e) { damageEnemy(e, pr.dmg); pr.life = 0; } }
    else if (Math.abs(p.x - pr.x) < 26 && Math.abs(p.y - 30 - pr.y) < 40) { damagePlayer(pr.dmg); pr.life = 0; }
  }
  game.projectiles = game.projectiles.filter((pr) => pr.life > 0);
  // 적 AI: 접근 → 예고 → 타격
  for (const e of game.enemies) {
    const d = ENEMY[e.type]; const dx = p.x - e.x, dy = p.y - e.y; const dist = Math.hypot(dx, dy);
    if (e.flash > 0) e.flash--;
    if (d.boss && e.phase === 1 && e.hp < e.hpMax / 2) { e.phase = 2; SFX.telegraph(); }
    const speed = d.speed * (e.phase === 2 ? 1.6 : 1) * (e.stagger > 0 ? 0 : 1); if (e.stagger > 0) e.stagger--;
    if (e.cd > 0) e.cd--;
    if (e.telegraph > 0) {
      e.telegraph--;
      if (e.telegraph === 0) { // 타격
        if (d.ranged) game.projectiles.push({ x: e.x, y: e.y - 30, vx: Math.sign(dx || 1) * 7, dmg: d.dmg, friendly: false, life: 90 });
        else if (dist < d.range + 20 && Math.abs(dy) < 40) damagePlayer(d.dmg * (e.phase === 2 ? 1.3 : 1));
        e.cd = d.cooldown * (e.phase === 2 ? 0.6 : 1);
      }
      continue;
    }
    const want = d.ranged ? d.keep : d.range - 6;
    // 목표점은 플레이어가 아니라 플레이어 둘레의 자기 슬롯 — 겹쳐 서지 않는다
    const tx = p.x + Math.cos(e.slot) * want, ty = p.y + Math.sin(e.slot) * want * 0.5; const ddx = tx - e.x, ddy = ty - e.y, dd = Math.hypot(ddx, ddy) || 1;
    if (dist > want) { e.x += (ddx / dd) * speed; e.y += (ddy / dd) * speed * 0.7; } else if (d.ranged && dist < want - 60) { e.x -= (dx / dist) * speed; }
    if (dx) e.facing = dx > 0 ? 1 : -1;
    if (d.blink && e.cd === 0 && dist < 120) { e.x = p.x - p.facing * 220; SFX.telegraph(); e.cd = 40; }
    const canHit = d.ranged ? dist < d.range : dist < d.range && Math.abs(dy) < 40;
    if (canHit && e.cd === 0) { e.telegraph = d.telegraph; SFX.telegraph(); }
  }
  // 정리
  const before = game.enemies.length;
  game.enemies = game.enemies.filter((e) => e.hp > 0);
  game.progress.kills += before - game.enemies.length;
  if (game.shake > 0) game.shake--;
  for (const pt of game.particles) { pt.x += pt.vx; pt.y += pt.vy; pt.life--; } game.particles = game.particles.filter((pt) => pt.life > 0);
  if (!game.enemies.length && !game.stage.cleared) { game.stage.cleared = true; game.progress.stagesCleared++; game.clearTimer = 90; SFX.ui(); }
  if (game.stage.cleared) { game.clearTimer--; if (game.clearTimer <= 0) { if (game.stageIndex + 1 < STAGES.length) loadStage(game.stageIndex + 1); else game.scene = 'clear'; } }
  game.cam.x = Math.max(0, Math.min(WORLD.w - viewW(), p.x - viewW() / 2));
  input.pressed.clear();
}
function damageEnemy(e, dmg) { e.hp -= dmg; e.flash = 6; e.stagger = 10; game.hitstop = 4; game.shake = 6; game.score += 10; SFX.hit(); for (let i = 0; i < 6; i++) game.particles.push({ x: e.x, y: e.y - 30, vx: (rnd() - 0.5) * 8, vy: (rnd() - 0.8) * 8, life: 20, c: '#ffd36b' }); if (e.hp <= 0) { SFX.enemy_die(); game.score += 100; } }
function damagePlayer(dmg) { const p = game.player; if (p.inv > 0) return; p.hp -= dmg; p.inv = 18; game.shake = 8; SFX.hurt(); if (p.hp <= 0) { p.hp = 0; game.scene = 'gameover'; SFX.die(); } }

// ---- 렌더 ----
let dpr = 1;
function viewH() { return WORLD.h; }
function viewW() { return cv.clientWidth / zoom(); }
function zoom() { return cv.clientHeight / WORLD.h; }
function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); }
window.addEventListener('resize', resize);
function worldToScreen(x, y) { const z = zoom(); return { x: (x - game.cam.x) * z, y: y * z, z }; }
function render() {
  if (cv.width !== Math.round(cv.clientWidth * dpr)) resize();
  const W = cv.clientWidth, H = cv.clientHeight; const st = STAGES[game.stageIndex];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = game.shake > 0 ? (vrnd() - 0.5) * FEEL.shakePx * 2 : 0, sy = game.shake > 0 ? (vrnd() - 0.5) * FEEL.shakePx * 2 : 0;
  ctx.translate(sx, sy);
  // 배경 3레이어
  ctx.fillStyle = st.sky; ctx.fillRect(-10, -10, W + 20, H + 20);
  const z = zoom(); const far = -game.cam.x * 0.3 * z;
  ctx.fillStyle = st.far; for (let i = 0; i < 12; i++) { const bx = ((i * 260 + far) % (W + 300)) - 150; ctx.fillRect(bx, H * 0.25 + (i % 3) * 20, 120 + (i % 4) * 30, H); }
  ctx.fillStyle = st.ground; ctx.fillRect(0, WORLD.floorTop * z - 60 * z, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 20; i++) { const gx = ((i * 140 - game.cam.x * z) % (W + 140)); ctx.fillRect(gx, (WORLD.floorTop + 40 + (i % 5) * 45) * z, 60 * z, 4 * z); }
  // 엔티티 (y 정렬)
  const ents = [...game.enemies.map((e) => ({ e, kind: 'enemy' })), { e: game.player, kind: 'player' }].sort((a, b) => a.e.y - b.e.y);
  for (const { e, kind } of ents) {
    const s = worldToScreen(e.x, e.y); const w = e.w * z, h = e.h * z;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, w * 0.6, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    let color = kind === 'player' ? (e.inv > 0 && e.inv % 4 < 2 ? '#ffffff' : '#5fd3a0') : ENEMY[e.type].color;
    if (kind === 'enemy' && e.telegraph > 0) color = e.telegraph % 6 < 3 ? '#ffffff' : '#ff5050';
    if (kind === 'enemy' && e.flash > 0) color = '#fff2a0';
    if (kind === 'enemy' && e.phase === 2) color = '#ff8a2a';
    ctx.fillStyle = color; ctx.fillRect(s.x - w / 2, s.y - h, w, h * 0.72);
    ctx.fillStyle = '#111'; ctx.fillRect(s.x - w / 2, s.y - h, w, 3 * z); ctx.fillRect(s.x - w / 2, s.y - h, 3 * z, h * 0.72); ctx.fillRect(s.x + w / 2 - 3 * z, s.y - h, 3 * z, h * 0.72);
    ctx.fillStyle = kind === 'player' ? '#f5e6c8' : '#e8d8c0'; ctx.beginPath(); ctx.arc(s.x, s.y - h * 0.85, w * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(s.x + e.facing * w * 0.1, s.y - h * 0.9, 4 * z, 4 * z);
    if (kind === 'player' && e.action === 'slash') { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(s.x + (e.facing > 0 ? 0 : -70 * z), s.y - h * 0.7, 70 * z, 10 * z); }
    if (kind === 'player' && e.action === 'spin') { ctx.strokeStyle = 'rgba(180,220,255,0.9)'; ctx.lineWidth = 6 * z; ctx.beginPath(); ctx.arc(s.x, s.y - h / 2, 90 * z, 0, Math.PI * 2); ctx.stroke(); }
    if (kind === 'enemy') { ctx.fillStyle = '#300'; ctx.fillRect(s.x - w / 2, s.y - h - 10 * z, w, 5 * z); ctx.fillStyle = '#f33'; ctx.fillRect(s.x - w / 2, s.y - h - 10 * z, w * (e.hp / e.hpMax), 5 * z); }
  }
  for (const pr of game.projectiles) { const s = worldToScreen(pr.x, pr.y); ctx.fillStyle = pr.friendly ? '#9fe8ff' : '#ff9f5f'; ctx.fillRect(s.x - 8 * z, s.y - 4 * z, 16 * z, 8 * z); }
  for (const pt of game.particles) { const s = worldToScreen(pt.x, pt.y); ctx.fillStyle = pt.c; ctx.fillRect(s.x, s.y, 4 * z, 4 * z); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // HUD
  const p = game.player;
  ctx.fillStyle = '#000a'; ctx.fillRect(16, 16, 220, 22); ctx.fillStyle = '#5fd3a0'; ctx.fillRect(16, 16, 220 * (p.hp / p.hpMax), 22);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(`체력 ${Math.ceil(p.hp)}  점수 ${game.score}  스테이지 ${game.stageIndex + 1} ${st.name}  남은 적 ${game.enemies.length}`, 16, 44);
  if (game.scene === 'title') { ctx.fillStyle = '#000b'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('forge 픽스처', 40, H / 2 - 40); ctx.font = '18px sans-serif'; ctx.fillText('아무 키나 눌러 시작 · 이동 방향키 · Z 베기 · X 대시 · C 회전 · V 탄', 40, H / 2 + 20); }
  if (game.scene === 'gameover') { ctx.fillStyle = '#000b'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ff6060'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('쓰러졌다', 40, H / 2 - 20); }
  if (game.scene === 'clear') { ctx.fillStyle = '#000b'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffe680'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('왕좌를 되찾았다', 40, H / 2 - 20); }
  // 터치 조작 (터치 기기이거나 좁은 화면일 때)
  if (navigator.maxTouchPoints > 0 || W < 900) {
    const L = touchLayout(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(L.stick.x, L.stick.y, L.stick.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(L.stick.x + input.stick.x * L.stick.r * 0.6, L.stick.y + input.stick.y * L.stick.r * 0.6, 20, 0, Math.PI * 2); ctx.fill();
    const label = { attack: '베기', dash: '대시', spin: '회전', bolt: '탄' };
    for (const b of L.buttons) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label[b.action], b.x, b.y); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,255,255,0.12)'; }
  }
}

// ---- 루프: rAF + 고정 dt 누산기. __forge.step 은 이 누산기를 직접 돌린다 ----
const loop = { paused: false, acc: 0, last: performance.now() };
function frame(now) {
  if (!loop.paused) {
    loop.acc += Math.min(0.1, (now - loop.last) / 1000);
    while (loop.acc >= DT) { if (game.scene === 'title' && (input.pressed.size || input.held.size)) begin(); update(); loop.acc -= DT; }
    musicStep();
  }
  loop.last = now;
  render();
  requestAnimationFrame(frame);
}
resize(); reset(1); requestAnimationFrame(frame);

// ---- 계약 ----
window.__forge = {
  version: 1,
  reset: (seed) => reset(seed),
  begin: () => begin(),
  warp: (id) => warp(id),
  pause: () => { loop.paused = true; },
  step: (n = 1) => { for (let i = 0; i < n; i++) update(); render(); },
  resume: () => { loop.paused = false; loop.last = performance.now(); loop.acc = 0; },
  state: () => ({ scene: game.scene, stage: game.stage ? { ...game.stage } : null, player: { x: +game.player.x.toFixed(2), y: +game.player.y.toFixed(2), hp: game.player.hp, hpMax: game.player.hpMax, facing: game.player.facing, action: game.player.action }, enemies: game.enemies.map((e) => ({ type: e.type, x: +e.x.toFixed(1), y: +e.y.toFixed(1), hp: e.hp, hpMax: e.hpMax })), progress: { ...game.progress }, score: game.score, simTime: +game.simTime.toFixed(2) }),
  probe: () => { const p = game.player; const s = worldToScreen(p.x, p.y); return { canvas: { w: cv.width, h: cv.height, cssW: cv.clientWidth, cssH: cv.clientHeight }, player: { x: (s.x - p.w * s.z / 2) * dpr, y: (s.y - p.h * s.z) * dpr, w: p.w * s.z * dpr, h: p.h * s.z * dpr } }; },
  controls: () => ({ keyboard: KEYS.map((k) => ({ ...k })), touch: touchLayout() }),
  content: () => JSON.parse(JSON.stringify(CONTENT)),
  spawn: (type, opts) => { spawn(type, opts); },
  audio: () => ({ sfx: Object.keys(SFX), music: Object.keys(MUSIC) }),
  feel: () => ({ ...FEEL }),
  canvas: () => cv,
};
})();
