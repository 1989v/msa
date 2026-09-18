import { WORLD, RUNES, LANDMARKS, PLATFORMS } from '../world.mjs';

// A route adapter exposes only state() and step(frames, heldInput). Routes never
// write state, teleport, grant rewards, remove enemies, or restore checkpoints.
// window.WINDWAKE implements this adapter; the CLI uses the same simulation.
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const position = p => [p.x, p.y, p.z].map(n => Number(n.toFixed(3)));
const ensure = (condition, message) => { if (!condition) throw new Error(message); };

export function checkpoint(driver, stage) {
  const s = driver.state();
  const result = { stage, frame: s.frame, position: position(s.player), hp: s.player.hp,
    sigils: [...s.progress.sigils], crystals: s.player.crystals, jumps: s.metrics.jumps,
    kills: s.metrics.kills, parries: s.metrics.parries, falls: s.metrics.falls, mode: s.mode };
  driver.onCheckpoint?.(result);
  return result;
}

function tick(driver, frames, input = {}) {
  const s = driver.step(frames, input) || driver.state();
  ensure(s.mode !== 'dead', `Route died at frame ${s.frame}, position ${position(s.player)}`);
  return s;
}

export function press(driver, action, moving = {}) {
  tick(driver, 1, moving);
  return tick(driver, 1, { ...moving, [action]: true });
}

function toward(player, target, scale = 1) {
  const d = gap(player, target);
  return { cameraYaw: 0, moveX: (target.x - player.x) / Math.max(.001, d) * scale,
    moveZ: (target.z - player.z) / Math.max(.001, d) * scale };
}

function nearestThreat(s, radius = 11) {
  return s.enemies.filter(e => e.hp > 0 && (e.type !== 'boss' || s.progress.sigils.length === 3) &&
    Math.abs(e.y - s.player.y) < 3.5 && gap(e, s.player) < radius)
    .sort((a, b) => gap(a, s.player) - gap(b, s.player))[0];
}

export function fight(driver, { radius = 12, frames = 4200 } = {}) {
  let lastAttack = -100;
  for (let i = 0; i < frames; i += 3) {
    const s = driver.state(), p = s.player, enemy = nearestThreat(s, radius);
    if (!enemy || s.mode === 'won') { tick(driver, 12); return checkpoint(driver, 'combat-clear'); }
    const d = gap(p, enemy);
    const input = toward(p, enemy, d > 2.15 ? 1 : .1);
    const soon = enemy.state === 'telegraph' && enemy.timer < .19;
    if (p.hp <= 55 && p.flasks > 0 && !s.previousInput.heal) input.heal = true;
    if (soon && p.parryCooldown <= 0 && p.stamina >= 10 && !s.previousInput.parry) input.parry = true;
    else if (d < 6.4 && p.energy >= 35 && p.skillCooldown <= 0 && !s.previousInput.skill) input.skill = true;
    else if (d < 3 && s.frame - lastAttack >= 13 && !s.previousInput.attack) {
      input.attack = true; lastAttack = s.frame;
    }
    tick(driver, 3, input);
  }
  const s = driver.state();
  throw new Error(`Combat did not finish: ${JSON.stringify({ player: position(s.player), enemies: s.enemies.filter(e => e.hp > 0 && gap(e, s.player) < radius).map(e => ({ id: e.id, hp: e.hp, at: position(e), state: e.state })) })}`);
}

// Explicit routes use this proportional steering only between their waypoints.
// A stall is reported with coordinates rather than silently changing state.
export function navigate(driver, x, z, { tolerance = .35, combat = true, frames = 4200,
  sprint = false, settle = true } = {}) {
  const target = { x, z };
  let old = driver.state().player, stationaryFrames = 0;
  for (let i = 0; i < frames; i += 3) {
    let s = driver.state(), p = s.player;
    if (gap(p, target) < tolerance) {
      if (settle) tick(driver, 12);
      return driver.state();
    }
    if (combat && nearestThreat(s, 9)) { fight(driver); s = driver.state(); p = s.player; }
    const input = toward(p, target, clamp(gap(p, target) / 1.8, .12, 1));
    input.sprint = sprint && gap(p, target) > 4;
    tick(driver, 3, input);
    const next = driver.state().player;
    stationaryFrames = gap(next, old) < .012 ? stationaryFrames + 3 : 0; old = next;
    if (stationaryFrames > 90) throw new Error(`Navigation blocked toward (${x},${z}) at ${position(next)}`);
  }
  throw new Error(`Navigation timeout toward (${x},${z}) at ${position(driver.state().player)}`);
}

export function waypoints(driver, points, options = {}) {
  for (const [x, z] of points) navigate(driver, x, z, options);
  return driver.state();
}

function rest(driver, id) {
  const camp = LANDMARKS.find(l => l.id === id);
  navigate(driver, camp.x, camp.z);
  fight(driver, { radius: 12 }); press(driver, 'interact');
  ensure(driver.state().player.checkpoint === id, `Failed to rest at ${id}`);
  return checkpoint(driver, id);
}

export function approachQuarry(driver) {
  waypoints(driver, [[-13, -53], [-22, -32], [-47, -24], [-48, -11]]);
  fight(driver, { radius: 13 });
  return checkpoint(driver, 'quarry-approach');
}

export function solveQuarry(driver) {
  // First align with the plinth to reset any incidental combat pulse displacement.
  waypoints(driver, [[-51, -9], [-51, -4]], { combat: false });
  press(driver, 'interact');
  waypoints(driver, [[-51, -11], [-48, -11]], { combat: false, tolerance: .08 });
  tick(driver, 150);
  press(driver, 'skill'); tick(driver, 105);
  navigate(driver, -48, -7.1, { combat: false, tolerance: .08 });
  tick(driver, 90); press(driver, 'skill'); tick(driver, 190);
  const s = driver.state();
  ensure(s.progress.sigils.includes('quarry'), `Quarry failed: stone ${position(s.blocks[0])}, charge ${s.puzzle.plateCharge}, player ${position(s.player)}`);
  return checkpoint(driver, 'quarry-solved');
}

export function approachForest(driver) {
  waypoints(driver, [[0, -30], [-18, -6], [-25, 24]]);
  rest(driver, 'camp-forest');
  waypoints(driver, [[-29, 38], [-44, 43]]);
  fight(driver, { radius: 13 });
  return checkpoint(driver, 'forest-approach');
}

export function solveForest(driver) {
  for (const rune of RUNES) {
    navigate(driver, rune.x, rune.z, { tolerance: .3 }); press(driver, 'interact');
    checkpoint(driver, `rune-${rune.id}`);
  }
  ensure(driver.state().progress.sigils.includes('forest'), 'Rune sequence did not award the forest sigil');
  return checkpoint(driver, 'forest-solved');
}

export function approachRuins(driver) {
  waypoints(driver, [[0, -30], [15, -15], [29, 6]]);
  rest(driver, 'camp-east');
  navigate(driver, 30.8, 7.8, { combat: false });
  return checkpoint(driver, 'ruins-approach');
}

export function jumpTo(driver, x, z, top, label = 'platform') {
  let s = driver.state();
  ensure(s.player.grounded, `Jump ${label} needs a grounded launch: ${position(s.player)}`);
  press(driver, 'jump', toward(s.player, { x, z }));
  let peaked = false;
  for (let i = 0; i < 95; i++) {
    s = driver.state();
    if (s.player.vy <= 0) peaked = true;
    if (peaked && s.player.grounded) {
      ensure(Math.abs(s.player.y - top) < .2, `Missed ${label}: landed ${position(s.player)}, expected top ${top}`);
      tick(driver, 6);
      return checkpoint(driver, label);
    }
    const d = gap(s.player, { x, z });
    tick(driver, 1, toward(s.player, { x, z }, clamp(d / 1.2, 0, 1)));
  }
  throw new Error(`Jump timeout ${label}: ${position(driver.state().player)}`);
}

export function solveRuins(driver) {
  const route = PLATFORMS.filter(p => p.id.startsWith('step-') || p.id === 'observatory');
  for (let i = 0; i < route.length; i++) {
    const platform = route[i];
    if (i) {
      const previous = route[i - 1], p = driver.state().player;
      const dx = platform.x - p.x, dz = platform.z - p.z, length = Math.hypot(dx, dz);
      const ux = dx / length, uz = dz / length;
      // Stop before the next riser, even where adjacent platform footprints overlap.
      const entry = Math.max(Math.abs(ux) > .001 ? (Math.abs(dx) - platform.w / 2 - .37) / Math.abs(ux) : 0,
        Math.abs(uz) > .001 ? (Math.abs(dz) - platform.d / 2 - .37) / Math.abs(uz) : 0);
      const edgeX = Math.abs(ux) > .001 ? (previous.w / 2 - .35 - (p.x - previous.x) * Math.sign(ux)) / Math.abs(ux) : Infinity;
      const edgeZ = Math.abs(uz) > .001 ? (previous.d / 2 - .35 - (p.z - previous.z) * Math.sign(uz)) / Math.abs(uz) : Infinity;
      const walk = Math.max(0, Math.min(entry - .2, edgeX, edgeZ));
      if (walk > .1) navigate(driver, p.x + ux * walk, p.z + uz * walk,
        { combat: false, tolerance: .08 });
    }
    jumpTo(driver, platform.x, platform.z, platform.y + platform.h, platform.id);
  }
  navigate(driver, 48, 33, { combat: false }); press(driver, 'interact');
  ensure(driver.state().progress.sigils.includes('ruins'), 'Observatory interaction did not award the ruins sigil');
  return checkpoint(driver, 'ruins-solved');
}

export function runFirstShrine(driver, name) {
  const start = driver.state();
  ensure(start.frame === 0 && start.progress.sigils.length === 0 &&
    gap(start.player, WORLD.spawn) < .001, 'First-shrine route requires a fresh unmodified starting state');
  checkpoint(driver, `start-${name}`);
  if (name === 'quarry') { approachQuarry(driver); solveQuarry(driver); }
  else if (name === 'forest') { approachForest(driver); solveForest(driver); }
  else if (name === 'ruins') { approachRuins(driver); solveRuins(driver); }
  else throw new Error(`Unknown shrine: ${name}`);
  const s = driver.state();
  ensure(s.progress.sigils.length === 1 && s.progress.sigils[0] === name, 'Expected exactly the requested first sigil');
  return checkpoint(driver, `complete-first-${name}`);
}

export function ascendSummit(driver) {
  ensure(driver.state().progress.sigils.length === 3, 'Summit route requires the three legitimately earned sigils');
  // Walk off the observatory toward the south-west, then travel on the ground.
  waypoints(driver, [[36, 19], [29, 6], [16, 3], [0, 5]], { combat: true });
  for (let i = 0; i < 260 && driver.state().player.y < 33; i += 3) tick(driver, 3);
  ensure(driver.state().player.y >= 33, 'Activated updraft did not lift the player');
  checkpoint(driver, 'updraft-ascent');
  tick(driver, 64, { moveZ: 1, cameraYaw: 0 });
  press(driver, 'jump', { moveZ: 1, cameraYaw: 0 });
  ensure(driver.state().player.gliding, 'Sail failed to open after leaving the updraft');
  navigate(driver, 0, 22, { combat: false, tolerance: .3 });
  for (let i = 0; i < 550 && !driver.state().player.grounded; i += 3) tick(driver, 3);
  const p = driver.state().player;
  ensure(p.grounded && Math.abs(p.y - 28) < .1, `Failed to land on summit: ${position(p)}`);
  return checkpoint(driver, 'summit-arrival');
}

export function defeatGuardian(driver) {
  ensure(driver.state().player.y > 23, 'Guardian must be fought from the arena');
  fight(driver, { radius: 35, frames: 12000 });
  const s = driver.state();
  ensure(s.mode === 'won' && s.progress.bossDefeated, 'Guardian was not defeated');
  return checkpoint(driver, 'guardian-defeated');
}

export function runJourney(driver) {
  runFirstShrine(driver, 'quarry');
  waypoints(driver, [[-51, -6], [-51, 9], [-30, 16], [-25, 24]]);
  rest(driver, 'camp-forest');
  waypoints(driver, [[-29, 38], [-44, 43]]); fight(driver, { radius: 13 }); solveForest(driver);
  waypoints(driver, [[-25, 24], [-10, 14], [17, 1], [29, 6]]);
  rest(driver, 'camp-east'); navigate(driver, 30.8, 7.8, { combat: false }); solveRuins(driver);
  ascendSummit(driver); defeatGuardian(driver);
  return checkpoint(driver, 'journey-complete');
}

export function collectCache(driver, id) {
  const cache = LANDMARKS.find(l => l.id === id && l.kind === 'chest');
  ensure(cache, `Unknown cache ${id}`);
  navigate(driver, cache.x, cache.z, { tolerance: .25 });
  press(driver, 'interact');
  ensure(driver.state().progress.chests.includes(id), `Cache ${id} was not collected at ${position(driver.state().player)}`);
  return checkpoint(driver, id);
}

export function exploreGrotto(driver) {
  waypoints(driver, [[-51, -6], [-51, 9], [-59, 16], [-69, 18]]);
  collectCache(driver, 'chest-grotto');
  // Exit by walking back through the actual opening, not by restoring a save.
  waypoints(driver, [[-69, 18], [-59, 16], [-51, 9]]);
  return checkpoint(driver, 'grotto-exited');
}

export function crossLake(driver) {
  waypoints(driver, [[-45, -15], [-22, -32], [10, -41], [14, -41]]);
  fight(driver, { radius: 13 }); navigate(driver, 14, -41, { combat: false });
  const stones = PLATFORMS.filter(p => p.id.startsWith('lake')).sort((a, b) => a.x - b.x);
  for (const stone of stones) {
    const p = driver.state().player, dx = stone.x - p.x, dz = stone.z - p.z;
    const distance = Math.hypot(dx, dz), ux = dx / distance, uz = dz / distance;
    // Move towards the edge of the current stone before the next ordinary jump.
    const current = stones.find(b => Math.abs(p.y - b.y - b.h) < .15 &&
      Math.abs(p.x - b.x) <= b.w / 2 + .3 && Math.abs(p.z - b.z) <= b.d / 2 + .3);
    if (current) {
      const edgeX = Math.abs(ux) > .001 ? (current.w / 2 - .5 - (p.x - current.x) * Math.sign(ux)) / Math.abs(ux) : Infinity;
      const edgeZ = Math.abs(uz) > .001 ? (current.d / 2 - .5 - (p.z - current.z) * Math.sign(uz)) / Math.abs(uz) : Infinity;
      const forward = Math.max(0, Math.min(edgeX, edgeZ));
      if (forward > .1) navigate(driver, p.x + ux * forward, p.z + uz * forward,
        { combat: false, tolerance: .06 });
    }
    jumpTo(driver, stone.x, stone.z, stone.y + stone.h, stone.id);
  }
  collectCache(driver, 'chest-lake');
  return checkpoint(driver, 'lake-cache-collected');
}

export function verifyLakeRecovery(driver) {
  const before = driver.state(), falls = before.metrics.falls;
  ensure(before.progress.chests.includes('chest-lake'), 'Recovery check starts after collecting the lake cache');
  for (let i = 0; i < 180 && driver.state().metrics.falls === falls; i++)
    tick(driver, 1, { moveX: 1, cameraYaw: 0 });
  const recovered = driver.state();
  ensure(recovered.metrics.falls === falls + 1, 'Walking off the lake stone did not invoke water recovery');
  ensure(recovered.player.hp < before.player.hp && recovered.mode === 'playing', 'Water recovery must charge health and remain playable');
  navigate(driver, 60, -46, { combat: false, tolerance: .3 });
  ensure(driver.state().metrics.falls === falls + 1, 'Walking back from the recovery point caused another fall');
  ensure(driver.state().progress.chests.includes('chest-lake'), 'Water recovery lost the collected cache');
  return checkpoint(driver, 'lake-water-recovered');
}

export function runOptionalCaches(driver) {
  const initial = driver.state();
  ensure(initial.frame === 0 && initial.progress.sigils.length === 0 && gap(initial.player, WORLD.spawn) < .001,
    'Optional exploration must begin from a fresh starting state');
  collectCache(driver, 'chest-meadow');
  approachQuarry(driver); solveQuarry(driver);
  exploreGrotto(driver); crossLake(driver); verifyLakeRecovery(driver);
  const s = driver.state();
  for (const id of ['chest-meadow', 'chest-grotto', 'chest-lake'])
    ensure(s.progress.chests.includes(id), `Missing optional reward ${id}`);
  return checkpoint(driver, 'optional-exploration-complete');
}

if (typeof process !== 'undefined' && process.argv?.[1] &&
    import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { createGame, stepGame, snapshot } = await import('../sim.mjs');
  for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['quarry', 'forest', 'ruins']) {
    const s = createGame();
    const driver = { state: () => snapshot(s),
      step(frames, input) { for (let i = 0; i < frames; i++) stepGame(s, input); return snapshot(s); },
      onCheckpoint: result => console.log(JSON.stringify(result)) };
    try {
      if (name === 'journey') runJourney(driver);
      else if (name === 'optional') runOptionalCaches(driver);
      else runFirstShrine(driver, name);
    }
    catch (error) { console.error(`${name.toUpperCase()} FAIL: ${error.message}`); process.exitCode = 1; }
  }
}
