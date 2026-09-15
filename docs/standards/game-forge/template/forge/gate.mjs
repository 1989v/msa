#!/usr/bin/env node
// 완성의 정의 판정기. 게임을 헤드리스 크롬에서 실제 입력으로 돌려 값을 재고,
// forge/thresholds.json 의 하한과 비교해 verifications/gate-report.{json,md} 를 쓴다.
//
//   node forge/gate.mjs                 # 전체 (완성 판정에 쓰는 유일한 형태)
//   node forge/gate.mjs --only HIT,FPS  # 축 일부만 — 리포트에 partial 표시, Stop 훅은 받지 않는다
//   node forge/gate.mjs --seed 7
//
// 판정 근거는 전부 게임이 내놓은 값이거나 드라이버가 심은 계측기의 값이다. 자기 보고(feel·boss phases)는
// basis:"self-reported" 로 표시해 측정값과 섞이지 않게 한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, Page, serveDir, sleep } from './cdp.mjs';
import { sourceHash } from './hash.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VER = path.join(ROOT, 'verifications');
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'forge/thresholds.json'), 'utf8'));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = arg('--only', '') ? arg('--only').split(',').map((s) => s.trim().toUpperCase()) : null;
const SEED = Number(arg('--seed', 20260915));
const want = (axis) => !ONLY || ONLY.some((o) => axis.startsWith(o) || o.startsWith(axis)); // 'MOBILE' 그룹 검사와 'MOBILE_TOUCH' 개별 지정 양쪽

const ALL_AXES = ['BOOT', 'CONSOLE', 'CONTROLS_KEY', 'FPS_DESKTOP', 'DIFF_IDLE', 'DIFF_MASH', 'CONTENT_STAGES', 'CONTENT_ENEMIES',
  'CONTENT_BOSS', 'CONTENT_SKILLS', 'AUDIO', 'FEEL', 'HIT', 'MOBILE_PORTRAIT', 'MOBILE_TOUCH', 'MOBILE_LANDSCAPE', 'MOBILE_FPS'];
const MOVE_ACTIONS = /^(left|right|up|down|jump|move|walk|run|forward|back|backward)$/i;

const report = { startedAt: new Date().toISOString(), seed: SEED, partial: !!ONLY, sourceHash: sourceHash(ROOT), thresholds: T, axes: [], screenshots: [] };
const axisMap = new Map();
function axis(id, patch) {
  const a = axisMap.get(id) || { id, status: 'SKIP', basis: 'measured', measured: {}, threshold: {}, evidence: [], note: '' };
  Object.assign(a, patch);
  if (patch?.measured) a.measured = { ...(axisMap.get(id)?.measured || {}), ...patch.measured };
  axisMap.set(id, a);
  return a;
}
function shot(page, name) { const f = path.join(VER, name); report.screenshots.push(name); return page.screenshot(f); }
const playerKey = (s) => JSON.stringify(s.player);
// 15 스텝을 3·5·7 로 나눠 세 점을 찍는다 — 12프레임짜리 공격이 끝나 원상복귀하면 끝점 하나로는 못 잡는다
async function playerSig(page) { const parts = []; for (const n of [3, 5, 7]) { await page.forge('step', n); parts.push(playerKey(await page.forge('state'))); } return parts.join('|'); }
const rng = mulberry32(SEED);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
function thumbDiff(a, b) { let s = 0, n = 0; for (let i = 0; i < a.length; i += 4) { s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n += 3; } return s / n; }
function thumbStd(a) { const v = []; for (let i = 0; i < a.length; i += 4) v.push((a[i] + a[i + 1] + a[i + 2]) / 3); const m = v.reduce((x, y) => x + y, 0) / v.length; return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / v.length); }

async function freshPlay(page, stageId) {
  await page.forge('reset', SEED);
  if (stageId) await page.forge('warp', stageId); else await page.forge('begin');
  await page.forge('pause');
  await page.forge('step', 5);
}
function findAttack(controls) {
  const ks = controls.keyboard || [];
  return ks.find((k) => k.action === 'attack') || ks.find((k) => /attack|slash|hit|fire|shoot|punch|strike/i.test(k.action)) || ks.find((k) => !MOVE_ACTIONS.test(k.action)) || null;
}

async function runDesktop(browser) {
  const page = await Page.open(browser, { width: 1280, height: 720 });
  try {
    // BOOT ---------------------------------------------------------------
    await page.navigate(report.url + 'index.html');
    const ok = await page.waitForForge();
    await sleep(300);
    await shot(page, 'boot-desktop.png');
    const required = ['reset', 'begin', 'warp', 'pause', 'step', 'resume', 'state', 'probe', 'controls', 'content', 'spawn', 'audio', 'feel'];
    const missing = ok ? await page.eval(`(${JSON.stringify(required)}).filter(m => typeof window.__forge[m] !== 'function')`) : required;
    if (!ok || missing.length) { axis('BOOT', { status: 'FAIL', measured: { forge: ok, missing }, note: ok ? '__forge 메서드 누락' : 'window.__forge 가 10초 안에 뜨지 않음', evidence: ['boot-desktop.png'] }); return page; }
    axis('BOOT', { status: 'PASS', measured: { forge: true }, evidence: ['boot-desktop.png'] });

    const controls = await page.forge('controls');
    const content = await page.forge('content');
    const attackKey = findAttack(controls);

    // CONTROLS_KEY — 같은 seed 에서 입력 없음 vs 입력 있음의 player 를 비교 ---------
    if (want('CONTROLS_KEY')) {
      await freshPlay(page);
      const base = await playerSig(page);
      const dead = [];
      for (const k of controls.keyboard || []) {
        await freshPlay(page);
        await page.keyDown(k.code); const sig = await playerSig(page); await page.keyUp(k.code);
        if (sig === base) dead.push(`${k.code}(${k.action})`);
      }
      const total = (controls.keyboard || []).length;
      axis('CONTROLS_KEY', { status: total > 0 && dead.length === 0 ? 'PASS' : 'FAIL', measured: { keys: total, dead }, threshold: { dead: 0, keys: '>=1' }, note: dead.length ? '죽은 키 입력' : total ? '' : '키보드 조작 선언 없음' });
    }

    // CONTENT_STAGES — warp 로 전부 가고, 화면이 서로 달라야 한다 -----------------
    const stages = content.stages || [];
    if (want('CONTENT_STAGES')) {
      const thumbs = []; const unreachable = []; const blank = [];
      for (const st of stages) {
        await freshPlay(page, st.id); await page.forge('step', 30);
        const s = await page.forge('state');
        if (s.stage?.id !== st.id || s.scene !== 'play') unreachable.push(st.id);
        await shot(page, `stage-${st.id}.png`);
        const th = await page.thumb(); thumbs.push(th);
        if (!th || thumbStd(th) < 4) blank.push(st.id);
      }
      let minDiff = Infinity, minPair = null;
      for (let i = 0; i < thumbs.length; i++) for (let j = i + 1; j < thumbs.length; j++) { if (!thumbs[i] || !thumbs[j]) continue; const d = thumbDiff(thumbs[i], thumbs[j]); if (d < minDiff) { minDiff = d; minPair = [stages[i].id, stages[j].id]; } }
      const okCount = stages.length >= T.stages_min, okDiff = stages.length < 2 || minDiff >= T.stage_distinct_diff_min;
      axis('CONTENT_STAGES', { status: okCount && okDiff && !unreachable.length && !blank.length ? 'PASS' : 'FAIL',
        measured: { stages: stages.length, minPairDiff: minDiff === Infinity ? null : +minDiff.toFixed(1), minPair, unreachable, blank },
        threshold: { stages: `>=${T.stages_min}`, minPairDiff: `>=${T.stage_distinct_diff_min}` }, evidence: stages.map((s) => `stage-${s.id}.png`),
        note: !okCount ? '스테이지 수 미달' : !okDiff ? '스테이지 화면이 서로 같다' : unreachable.length ? 'warp 불가 스테이지' : blank.length ? '빈 화면 스테이지' : '' });
    }

    // CONTENT_ENEMIES — spawn 이 전부 되고 state 에 그 type 이 나타나야 한다 -----------
    const types = content.enemyTypes || [];
    if (want('CONTENT_ENEMIES')) {
      const cannot = [];
      for (const t of types) {
        await freshPlay(page);
        await page.forge('spawn', t, { near: true }); await page.forge('step', 2);
        const s = await page.forge('state');
        if (!(s.enemies || []).some((e) => e.type === t)) cannot.push(t);
        await shot(page, `enemy-${t}.png`);
      }
      axis('CONTENT_ENEMIES', { status: types.length >= T.enemy_types_min && !cannot.length ? 'PASS' : 'FAIL', measured: { enemyTypes: types.length, cannotSpawn: cannot }, threshold: { enemyTypes: `>=${T.enemy_types_min}` }, evidence: types.map((t) => `enemy-${t}.png`), note: cannot.length ? 'spawn 되지 않는 적 종' : types.length < T.enemy_types_min ? '적 종 수 미달' : '' });
    }

    // CONTENT_BOSS — 보스 스테이지에서 보스가 보여야 한다. phases 는 자기 보고 ---------
    const bosses = content.bosses || [];
    if (want('CONTENT_BOSS')) {
      const absent = [];
      for (const b of bosses) {
        await freshPlay(page, b.stage); await page.forge('step', 30);
        let s = await page.forge('state');
        if (!(s.enemies || []).some((e) => e.type === b.id)) { try { await page.forge('spawn', b.id, { near: true }); await page.forge('step', 2); s = await page.forge('state'); } catch {} }
        if (!(s.enemies || []).some((e) => e.type === b.id)) absent.push(b.id);
        await shot(page, `boss-${b.id}.png`);
      }
      const phasesOk = bosses.every((b) => (b.phases || 0) >= T.boss_phases_min);
      axis('CONTENT_BOSS', { status: bosses.length >= T.bosses_min && !absent.length && phasesOk ? 'PASS' : 'FAIL', basis: 'measured+self-reported(phases)', measured: { bosses: bosses.length, absent, phases: bosses.map((b) => b.phases) }, threshold: { bosses: `>=${T.bosses_min}`, phases: `>=${T.boss_phases_min}` }, evidence: bosses.map((b) => `boss-${b.id}.png`), note: absent.length ? '보스가 나타나지 않음' : !phasesOk ? '보스 페이즈 미달' : bosses.length < T.bosses_min ? '보스 수 미달' : '' });
    }

    if (want('CONTENT_SKILLS')) {
      const n = (content.skills || []).length;
      axis('CONTENT_SKILLS', { status: n >= T.skills_min ? 'PASS' : 'FAIL', basis: 'self-reported', measured: { skills: n, items: (content.items || []).length, secrets: content.secrets ?? 0 }, threshold: { skills: `>=${T.skills_min}` } });
    }

    // HIT — 사거리 안 적에게 공격키 → hp 가 줄어야 한다. 3장 연속 촬영은 사람이 손맛을 볼 근거 -------
    if (want('HIT')) {
      if (!attackKey || !types.length) axis('HIT', { status: 'FAIL', note: '공격 키 또는 적 종이 없다' });
      else {
        await freshPlay(page);
        await page.forge('spawn', types[0], { near: true }); await page.forge('step', 1);
        // 스테이지에 같은 type 이 이미 있을 수 있으니 "그 type 의 hp 합" 으로 본다 (죽어서 사라져도 합은 준다)
        const sumHp = (s) => (s.enemies || []).filter((e) => e.type === types[0]).reduce((a, e) => a + e.hp, 0);
        const s0 = await page.forge('state'); const near = (s0.enemies || []).some((e) => e.type === types[0]);
        const hpBefore = near ? sumHp(s0) : null;
        await page.keyDown(attackKey.code); await page.forge('step', 2); await shot(page, 'hit-0.png');
        await page.forge('step', 3); await shot(page, 'hit-1.png'); await page.keyUp(attackKey.code);
        await page.forge('step', 10); await shot(page, 'hit-2.png');
        const hpAfter = sumHp(await page.forge('state'));
        axis('HIT', { status: hpBefore != null && hpAfter < hpBefore ? 'PASS' : 'FAIL', measured: { key: attackKey.code, enemy: types[0], hpBefore, hpAfter }, threshold: { hpAfter: '< hpBefore (type 합)' }, evidence: ['hit-0.png', 'hit-1.png', 'hit-2.png'], note: hpBefore == null ? '근접 spawn 이 안 됨' : hpAfter < hpBefore ? '' : '공격이 적에게 닿지 않음' });
      }
    }

    // DIFF_IDLE — 가만히 있으면 맞고, 죽어야 한다 ----------------------------------
    if (want('DIFF_IDLE')) {
      await freshPlay(page);
      let firstHitSec = null, deadSec = null; const limit = Math.max(T.idle_dead_within_sec, T.idle_damage_within_sec);
      for (let sec = 1; sec <= limit; sec++) {
        await page.forge('step', 60);
        const s = await page.forge('state');
        if (firstHitSec == null && s.player.hp < s.player.hpMax) firstHitSec = sec;
        if (s.player.hp <= 0 || s.scene === 'gameover') { deadSec = sec; break; }
      }
      await shot(page, 'idle-end.png');
      const okHit = T.idle_damage_within_sec === 0 || (firstHitSec != null && firstHitSec <= T.idle_damage_within_sec);
      const okDead = T.idle_dead_within_sec === 0 || (deadSec != null && deadSec <= T.idle_dead_within_sec);
      axis('DIFF_IDLE', { status: okHit && okDead ? 'PASS' : 'FAIL', measured: { firstHitSec, deadSec }, threshold: { firstHitSec: `<=${T.idle_damage_within_sec}`, deadSec: `<=${T.idle_dead_within_sec}` }, evidence: ['idle-end.png'], note: !okHit ? '가만히 있어도 안 맞는다' : !okDead ? '가만히 있어도 안 죽는다' : '' });
    }

    // DIFF_MASH — 아무 키나 마구 누르면 1스테이지를 못 깨야 한다 (죽으면 다시 시작해 계속) ----
    if (want('DIFF_MASH')) {
      const keys = (controls.keyboard || []).map((k) => k.code);
      await freshPlay(page);
      let held = []; let deaths = 0; let cleared = false; let clearedAtSec = null;
      const totalSteps = T.mash_no_clear_sec * 60;
      for (let step = 0; step < totalSteps && keys.length; step += 4) {
        if (rng() < 0.5) { const k = pick(keys); if (held.includes(k)) { await page.keyUp(k); held = held.filter((h) => h !== k); } else if (held.length < 3) { await page.keyDown(k); held.push(k); } }
        await page.forge('step', 4);
        if (step % 60 === 0) {
          const s = await page.forge('state');
          if ((s.progress?.stagesCleared || 0) > 0 || s.stage?.cleared) { cleared = true; clearedAtSec = step / 60; break; }
          if (s.player.hp <= 0 || s.scene === 'gameover') { deaths++; for (const h of held) await page.keyUp(h); held = []; await page.forge('begin'); await page.forge('pause'); }
        }
      }
      for (const h of held) await page.keyUp(h);
      await shot(page, 'mash-end.png');
      axis('DIFF_MASH', { status: keys.length && !cleared ? 'PASS' : 'FAIL', measured: { simSec: T.mash_no_clear_sec, deaths, cleared, clearedAtSec }, threshold: { cleared: false }, evidence: ['mash-end.png'], note: cleared ? '난타로 1스테이지 클리어됨' : '' });
    }

    // FPS_DESKTOP + AUDIO — 실시간으로 6초 난타하며 프레임·소리 start 를 드라이버가 센다 ----
    if (want('FPS_DESKTOP') || want('AUDIO')) {
      const keys = (controls.keyboard || []).map((k) => k.code);
      await page.forge('reset', SEED); await page.forge('begin'); await page.forge('resume');
      await sleep(300); // 재개 직후 워밍업 히치 제외
      const a0 = await page.audioStats();
      await page.frameRecord(true);
      const t0 = Date.now(); let held = [];
      while (Date.now() - t0 < 6000) {
        if (keys.length) { const k = pick(keys); if (held.includes(k)) { await page.keyUp(k); held = held.filter((h) => h !== k); } else if (held.length < 3) { await page.keyDown(k); held.push(k); } }
        await sleep(66);
      }
      await page.frameRecord(false); for (const h of held) await page.keyUp(h);
      const fps = await page.frameStats(); const a1 = await page.audioStats();
      await page.forge('pause');
      await shot(page, 'play-desktop.png');
      if (want('FPS_DESKTOP')) axis('FPS_DESKTOP', { status: fps.avgFps >= T.fps_avg_min_desktop && fps.low1Fps >= T.fps_low1_min_desktop ? 'PASS' : 'FAIL', measured: fps, threshold: { avgFps: `>=${T.fps_avg_min_desktop}`, low1Fps: `>=${T.fps_low1_min_desktop}` }, evidence: ['play-desktop.png'], note: '헤드리스 소프트웨어 렌더 기준 — 실기기는 더 빠르다' });
      if (want('AUDIO')) {
        const decl = await page.forge('audio');
        const starts = (a1.starts - a0.starts) + (a1.mediaPlays - a0.mediaPlays);
        const sfx = (decl.sfx || []).length, music = (decl.music || []).length;
        axis('AUDIO', { status: starts > 0 && sfx >= T.sfx_min && music >= T.music_min ? 'PASS' : 'FAIL', basis: 'measured(starts)+self-reported(lists)', measured: { soundStartsIn6s: starts, sfxDeclared: sfx, musicDeclared: music, audioContexts: a1.contexts }, threshold: { soundStartsIn6s: '>0', sfx: `>=${T.sfx_min}`, music: `>=${T.music_min}` }, note: starts === 0 ? '6초 난타 동안 소리가 한 번도 안 남 (무음 = 미완성)' : '' });
      }
    }

    if (want('FEEL')) {
      const f = await page.forge('feel');
      const ok = (f.hitstopMs || 0) >= T.hitstop_ms_min && (f.shakePx || 0) >= T.shake_px_min && (f.telegraphMs || 0) >= T.telegraph_ms_min;
      axis('FEEL', { status: ok ? 'PASS' : 'FAIL', basis: 'self-reported', measured: f, threshold: { hitstopMs: `>=${T.hitstop_ms_min}`, shakePx: `>=${T.shake_px_min}`, telegraphMs: `>=${T.telegraph_ms_min}` }, note: '자기 보고 — hit-*.png 로 사람이 확인' });
    }
    return page;
  } catch (e) {
    axis('BOOT', { status: axisMap.get('BOOT')?.status === 'PASS' ? 'PASS' : 'FAIL', note: (axisMap.get('BOOT')?.note || '') });
    axis('RUNTIME_ERROR', { status: 'FAIL', note: '데스크톱 시나리오 예외: ' + (e.stack || e.message) });
    return page;
  }
}

async function runMobile(browser, orientation) {
  const portrait = orientation === 'portrait';
  const [w, h] = portrait ? [390, 844] : [844, 390];
  const page = await Page.open(browser, { width: w, height: h, mobile: true, dpr: 2 });
  const id = portrait ? 'MOBILE_PORTRAIT' : 'MOBILE_LANDSCAPE';
  try {
    await page.navigate(report.url + 'index.html');
    if (!(await page.waitForForge())) { axis(id, { status: 'FAIL', note: '모바일 뷰포트에서 __forge 가 뜨지 않음' }); return page; }
    await page.forge('reset', SEED); await page.forge('begin'); await page.forge('pause'); await page.forge('step', 10);
    await shot(page, `mobile-${orientation}.png`);
    const probe = await page.forge('probe');
    const scale = probe.canvas.cssH / probe.canvas.h;
    const playerCssPx = +(probe.player.h * scale).toFixed(1);
    const overflow = await page.eval('({sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight})');
    const controls = await page.forge('controls');
    const tc = controls.touch || {};
    const zones = [...(tc.buttons || []), ...(tc.dpad || []), ...(tc.stick ? [{ action: 'stick', ...tc.stick }] : [])];
    const offscreen = zones.filter((z) => z.x - z.r < 0 || z.y - z.r < 0 || z.x + z.r > w || z.y + z.r > h).map((z) => z.action);
    const hasMove = !!(tc.stick || (tc.dpad || []).length);
    const okPx = playerCssPx >= T.player_css_px_min_mobile, okOverflow = overflow.sw <= overflow.iw + 1 && overflow.sh <= overflow.ih + 1;
    const okTouch = hasMove && (tc.buttons || []).length > 0 && offscreen.length === 0;
    axis(id, { status: okPx && okOverflow && okTouch ? 'PASS' : 'FAIL', measured: { viewport: `${w}x${h}`, playerCssPx, canvasCss: `${probe.canvas.cssW}x${probe.canvas.cssH}`, overflow: { ...overflow }, touchZones: zones.length, hasMove, offscreen }, threshold: { playerCssPx: `>=${T.player_css_px_min_mobile}`, overflow: 'none', touch: 'stick|dpad + buttons>=1, 화면 안' }, evidence: [`mobile-${orientation}.png`], note: !okPx ? '플레이어가 폰에서 너무 작다' : !okOverflow ? '페이지가 뷰포트를 넘친다' : !hasMove ? '터치 이동 수단 없음' : !(tc.buttons || []).length ? '터치 버튼 없음' : offscreen.length ? '터치 조작이 화면 밖' : '' });

    // MOBILE_TOUCH — 세로에서만. 실제 TouchEvent 로 죽은 입력 감사 ------------------
    if (portrait && want('MOBILE_TOUCH')) {
      await freshPlay(page);
      const base = await playerSig(page);
      const dead = [];
      for (const z of zones) {
        await freshPlay(page);
        if (z.action === 'stick') { await page.touchStart([{ x: z.x, y: z.y }]); await page.touchMove([{ x: z.x + z.r * 0.8, y: z.y }]); }
        else await page.touchStart([{ x: z.x, y: z.y }]);
        const sig = await playerSig(page);
        await page.touchEnd();
        if (sig === base) dead.push(z.action);
      }
      axis('MOBILE_TOUCH', { status: zones.length && !dead.length ? 'PASS' : 'FAIL', measured: { zones: zones.map((z) => z.action), dead }, threshold: { dead: 0 }, note: dead.length ? '죽은 터치 입력' : zones.length ? '' : '터치 조작 선언 없음' });
    }

    // MOBILE_FPS — 가로에서. 스틱을 잡고 5초 실시간 ----------------------------------
    if (!portrait && want('MOBILE_FPS')) {
      await page.forge('reset', SEED); await page.forge('begin'); await page.forge('resume');
      const st = tc.stick || (tc.dpad || [])[0];
      if (st) await page.touchStart([{ x: st.x, y: st.y }]); if (tc.stick) await page.touchMove([{ x: st.x + st.r * 0.8, y: st.y }]);
      await sleep(300);
      await page.frameRecord(true); await sleep(5000); await page.frameRecord(false);
      await page.touchEnd();
      const fps = await page.frameStats();
      await page.forge('pause'); await shot(page, 'play-mobile-landscape.png');
      axis('MOBILE_FPS', { status: fps.avgFps >= T.fps_avg_min_mobile ? 'PASS' : 'FAIL', measured: { ...fps, dpr: 2 }, threshold: { avgFps: `>=${T.fps_avg_min_mobile}` }, evidence: ['play-mobile-landscape.png'], note: '헤드리스 소프트웨어 렌더 · DPR 2 기준' });
    }
    return page;
  } catch (e) {
    axis(id, { status: 'FAIL', note: '모바일 시나리오 예외: ' + (e.stack || e.message) });
    return page;
  }
}

async function main() {
  fs.mkdirSync(VER, { recursive: true });
  for (const f of fs.readdirSync(VER)) if (/\.png$/.test(f)) fs.unlinkSync(path.join(VER, f)); // 옛 그림이 새 판정에 섞이지 않게
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) { axis('BOOT', { status: 'FAIL', note: 'index.html 이 없다' }); return finish(); }
  const { url, server } = await serveDir(ROOT); report.url = url;
  const chrome = await launchChrome({ key: ROOT });
  const pages = [];
  try {
    pages.push(await runDesktop(chrome.browser));
    if (want('MOBILE')) { pages.push(await runMobile(chrome.browser, 'portrait')); pages.push(await runMobile(chrome.browser, 'landscape')); }
    const errors = pages.flatMap((p) => p.consoleErrors);
    if (want('CONSOLE')) axis('CONSOLE', { status: errors.length <= T.console_errors_max ? 'PASS' : 'FAIL', measured: { errors: errors.length, first: errors.slice(0, 5) }, threshold: { errors: `<=${T.console_errors_max}` }, note: errors.length ? '콘솔 에러/예외' : '' });
    fs.writeFileSync(path.join(VER, 'console.log'), pages.flatMap((p) => p.consoleAll).join('\n'));
  } finally {
    for (const p of pages) await p.close();
    await chrome.close(); // 측정이 끝난 시점에 닫는다 — 결과는 파일로 읽는다
    server.close();
  }
  return finish();
}

function finish() {
  for (const id of ALL_AXES) if (want(id) && !axisMap.has(id)) axis(id, { status: 'SKIP', note: 'BOOT 실패로 미실행' });
  report.axes = [...axisMap.values()];
  const failed = report.axes.filter((a) => a.status === 'FAIL' || (a.status === 'SKIP' && !ONLY));
  report.status = failed.length ? 'FAIL' : 'PASS';
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(VER, 'gate-report.json'), JSON.stringify(report, null, 2));
  const md = [`# gate-report — ${report.status}${report.partial ? ' (partial: ' + ONLY.join(',') + ')' : ''}`, '', `- 시각: ${report.finishedAt}  seed: ${report.seed}  sourceHash: ${report.sourceHash.slice(0, 12)}`, '',
    '| 축 | 판정 | 근거 | 측정 | 문턱 | 비고 |', '|---|---|---|---|---|---|',
    ...report.axes.map((a) => `| ${a.id} | ${a.status} | ${a.basis} | ${JSON.stringify(a.measured)} | ${JSON.stringify(a.threshold)} | ${a.note || ''} |`),
    '', '## 스크린샷 (전부 눈으로 보고 verifications/visual-review.md 에 한 줄씩)', ...report.screenshots.map((s) => `- ${s}`), ''].join('\n');
  fs.writeFileSync(path.join(VER, 'gate-report.md'), md);
  console.log(`gate: ${report.status}  (${report.axes.filter((a) => a.status === 'PASS').length} PASS / ${failed.length} FAIL·SKIP)  → verifications/gate-report.md`);
  for (const a of report.axes) if (a.status !== 'PASS') console.log(`  ${a.status.padEnd(4)} ${a.id.padEnd(16)} ${a.note || ''}  ${JSON.stringify(a.measured)}`);
  process.exit(report.status === 'PASS' ? 0 : 1);
}

main().catch((e) => { console.error('gate 실행 실패:', e); axis('RUNTIME_ERROR', { status: 'FAIL', note: e.stack || String(e) }); finish(); });
