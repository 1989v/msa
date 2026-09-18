import test from 'node:test';
import assert from 'node:assert/strict';
import { DT, createGame, stepGame, snapshot, restoreSnapshot, spawnEnemy, awardSigil,
  interact, interaction, upgrade, exportSave, loadSave, respawn, fastTravel } from '../sim.mjs';
import { WORLD, LANDMARKS, RUNES, PLATE, BLOCK_SPAWN, PLATFORMS, OBSTACLES, heightAt } from '../world.mjs';

// These are controlled simulation scenarios, not evidence of a complete player
// journey. Browser verification separately covers travel from a fresh start.
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${actual} differs from ${expected} by more than ${tolerance}`);
function isolated(seed = 8123) { const s = createGame(seed); s.enemies = []; return s; }
function place(s, x, z, y = heightAt(x, z)) {
  Object.assign(s.player, { x, y, z, vx: 0, vy: 0, vz: 0, grounded: true, coyote: .12,
    safeX: x, safeY: y, safeZ: z, yaw: 0 });
  return s.player;
}
function advance(s, frames, input = {}) {
  const events = [];
  for (let i = 0; i < frames; i++) { stepGame(s, input); events.push(...s.events); }
  return events;
}
function press(s, button) { stepGame(s, {}); stepGame(s, { [button]: true }); }
function stationaryEnemy(s, type, x, z, y) {
  const e = spawnEnemy(s, type, x, z, y); e.state = 'recover'; e.timer = 20; return e;
}
function incomingMelee(s, front = true) {
  const p = s.player;
  const e = spawnEnemy(s, 'stalker', p.x, p.z + (front ? 1.7 : -1.7), p.y);
  Object.assign(e, { state: 'telegraph', timer: DT / 2, pattern: 'slam', yaw: front ? Math.PI : 0 });
  return e;
}
function allSigils(s) { for (const id of ['quarry', 'forest', 'ruins']) awardSigil(s, id); }

test('same seed and inputs replay the entire state deterministically', () => {
  const a = createGame(938), b = createGame(938);
  for (let i = 0; i < 480; i++) {
    const input = { moveZ: i < 240 ? 1 : 0, moveX: i > 250 ? -.5 : 0,
      cameraYaw: .2, jump: i % 91 === 0, attack: i % 37 === 0, skill: i % 149 === 0 };
    stepGame(a, input); stepGame(b, input);
  }
  assert.deepEqual(a, b);
  assert.equal(a.time, a.frame * DT);
});

test('snapshots are independent copies and continue with held-input history', () => {
  const a = isolated(); advance(a, 12, { attack: true });
  const saved = snapshot(a), b = restoreSnapshot(saved);
  b.player.crystals = 777;
  assert.notEqual(saved.player.crystals, 777);
  b.player.crystals = a.player.crystals;
  advance(a, 70, { attack: true, moveX: .2 }); advance(b, 70, { attack: true, moveX: .2 });
  assert.deepEqual(a, b);
  assert.throws(() => restoreSnapshot({ version: 9 }), /snapshot/i);
});

test('a real jump ascends, reaches an apex, falls and lands only once', () => {
  const s = isolated(), ground = s.player.y, phases = new Set();
  stepGame(s, { jump: true });
  let apex = s.player.y;
  for (let i = 0; i < 90; i++) {
    phases.add(s.player.airState); apex = Math.max(apex, s.player.y); stepGame(s, {});
  }
  assert.ok(apex - ground > 2 && apex - ground < 2.6);
  for (const phase of ['ASCENDING', 'APEX', 'FALLING', 'LAND']) assert.ok(phases.has(phase), phase);
  assert.equal(s.metrics.jumps, 1); assert.equal(s.metrics.landings, 1);
  near(s.player.y, ground); assert.equal(s.player.grounded, true);
});

test('movement is camera-relative and diagonal input is normalized', () => {
  const a = isolated(), b = isolated(), c = isolated();
  advance(a, 60, { moveZ: 1, cameraYaw: Math.PI / 2 });
  assert.ok(a.player.x > 4); near(a.player.z, WORLD.spawn.z);
  advance(b, 60, { moveZ: 1 }); advance(c, 60, { moveZ: 1, moveX: 1 });
  const db = Math.hypot(b.player.x, b.player.z - WORLD.spawn.z);
  const dc = Math.hypot(c.player.x, c.player.z - WORLD.spawn.z);
  assert.ok(Math.abs(dc - db) < .5, 'diagonal movement cannot be sqrt(2) faster');
});

test('solid walls block lateral motion instead of lifting the player through them', () => {
  const s = isolated(), wall = OBSTACLES.find(b => b.id === 'wall-west');
  place(s, wall.x - 3, wall.z);
  advance(s, 120, { moveX: 1 });
  assert.ok(s.player.x <= wall.x - wall.w / 2 - .3);
  near(s.player.z, wall.z, .001);
  assert.ok(s.player.y < wall.y + wall.h - 1);
});

test('falling lands on an elevated platform, then leaving its edge causes a fall', () => {
  const s = isolated(), platform = PLATFORMS.find(b => b.id === 'step-2');
  const top = platform.y + platform.h;
  place(s, platform.x, platform.z, top + 3); s.player.grounded = false; s.player.coyote = 0;
  advance(s, 60);
  near(s.player.y, top); assert.equal(s.player.grounded, true);
  advance(s, 70, { moveX: -1 });
  assert.ok(s.player.y < top - 1); assert.ok(s.metrics.landings >= 1);
});

test('coyote jump works shortly after an edge and buffered jump fires after landing', () => {
  const coyote = isolated(), p = coyote.player;
  p.y += .2; p.grounded = false; p.coyote = .09;
  stepGame(coyote, { jump: true }); assert.ok(p.vy > 0); assert.equal(coyote.metrics.jumps, 1);
  const buffered = isolated(), q = buffered.player;
  q.y += .22; q.vy = -5; q.grounded = false; q.coyote = 0;
  stepGame(buffered, { jump: true }); advance(buffered, 5);
  assert.equal(buffered.metrics.jumps, 1); assert.ok(q.vy > 0);
});

test('gliding requires a sigil, slows descent and ends when stamina is exhausted', () => {
  const s = isolated(); place(s, 0, -72, heightAt(0, -72) + 12);
  s.player.grounded = false; s.player.coyote = 0; s.player.vy = -8;
  press(s, 'jump'); assert.equal(s.player.gliding, false);
  awardSigil(s, 'forest'); press(s, 'jump');
  assert.equal(s.player.gliding, true); assert.ok(s.player.vy >= -2.2);
  s.player.stamina = .05; stepGame(s, {}); assert.equal(s.player.gliding, false);
});

test('sword damages a forward target but not targets behind or on a higher floor', () => {
  const s = isolated(), p = s.player;
  const front = stationaryEnemy(s, 'stalker', p.x, p.z + 2, p.y);
  const back = stationaryEnemy(s, 'stalker', p.x, p.z - 2, p.y);
  const above = stationaryEnemy(s, 'stalker', p.x, p.z + 2, p.y + 5);
  press(s, 'attack'); advance(s, 10);
  assert.ok(front.hp < front.maxHp); assert.equal(back.hp, back.maxHp); assert.equal(above.hp, above.maxHp);
});

test('sword, pulse and enemy melee cannot damage through the solid quarry wall', () => {
  const s = isolated(); place(s, -57.4, 0); s.player.yaw = Math.PI / 2;
  const enemy = stationaryEnemy(s, 'stalker', -54.6, 0, heightAt(-54.6, 0));
  press(s, 'attack'); advance(s, 9);
  assert.equal(enemy.hp, enemy.maxHp, 'wall-west separates the two actors');
  press(s, 'skill'); assert.equal(enemy.hp, enemy.maxHp, 'pulse must also respect cover');
  Object.assign(enemy, { state: 'telegraph', timer: DT / 2, yaw: -Math.PI / 2, pattern: 'slam' });
  stepGame(s, {}); assert.equal(s.player.hp, s.player.maxHp, 'enemy cannot hit through cover');
});

test('held attack fires once; separate buffered presses produce a three-hit combo', () => {
  const held = isolated(), events = advance(held, 100, { attack: true });
  assert.deepEqual(events.filter(e => /^attack[123]$/.test(e.type)).map(e => e.type), ['attack1']);
  const s = isolated(), attacks = [];
  for (let frame = 0; frame < 95; frame++) {
    stepGame(s, { attack: [0, 12, 36].includes(frame) });
    attacks.push(...s.events.filter(e => /^attack[123]$/.test(e.type)).map(e => e.type));
  }
  assert.deepEqual(attacks, ['attack1', 'attack2', 'attack3']); assert.equal(s.metrics.combos, 1);
});

test('pulse spends energy, staggers a shielded charger, and cannot ignore its cooldown', () => {
  const s = isolated(), p = s.player;
  const enemy = stationaryEnemy(s, 'charger', p.x, p.z + 3, p.y); enemy.yaw = Math.PI;
  stepGame(s, { skill: true });
  const hp = enemy.hp; assert.ok(hp < enemy.maxHp - 15); assert.equal(enemy.state, 'hit');
  assert.ok(p.energy < 75); assert.ok(p.skillCooldown > 0); assert.ok(Math.abs(enemy.vz) > 1);
  press(s, 'skill'); assert.equal(enemy.hp, hp);
});

test('dodge costs stamina and protects against a timed attack for a finite window', () => {
  const s = isolated(); incomingMelee(s);
  stepGame(s, { dodge: true });
  assert.equal(s.player.hp, s.player.maxHp); assert.ok(s.player.stamina < 90);
  assert.equal(s.metrics.dodges, 1); assert.ok(s.player.invulnerable > 0);
  advance(s, 40); assert.equal(s.player.invulnerable, 0);
  incomingMelee(s); stepGame(s, {}); assert.ok(s.player.hp < s.player.maxHp);
});

test('parry blocks a facing attack, stuns the attacker, and does not protect the back', () => {
  const s = isolated(), enemy = incomingMelee(s);
  stepGame(s, { parry: true });
  assert.equal(s.player.hp, s.player.maxHp); assert.equal(s.metrics.parries, 1);
  assert.equal(enemy.state, 'hit'); assert.ok(enemy.hp < enemy.maxHp);
  const back = isolated(); incomingMelee(back, false); stepGame(back, { parry: true });
  assert.ok(back.player.hp < back.player.maxHp); assert.equal(back.metrics.parries, 0);
});

test('melee AI provides a visible telegraph, deals one hit, then recovers', () => {
  const s = isolated(), p = s.player;
  const enemy = spawnEnemy(s, 'stalker', p.x, p.z + 2, p.y);
  stepGame(s, {}); assert.equal(enemy.state, 'telegraph'); assert.ok(enemy.timer > .4);
  advance(s, 20); assert.equal(p.hp, p.maxHp);
  advance(s, 24); assert.ok(p.hp < p.maxHp); assert.equal(enemy.state, 'recover');
  const hp = p.hp; advance(s, 20); assert.equal(p.hp, hp);
});

test('ranger telegraphs and launches a projectile that can hit the player', () => {
  const s = isolated(), p = s.player;
  const enemy = spawnEnemy(s, 'ranger', p.x, p.z + 7, p.y);
  stepGame(s, {}); assert.equal(enemy.state, 'telegraph');
  let launched = false;
  for (let i = 0; i < 110; i++) { stepGame(s, {}); launched ||= s.projectiles.length > 0; }
  assert.equal(launched, true); assert.ok(p.hp < p.maxHp);
});

test('projectiles disappear on solid geometry instead of crossing a wall', () => {
  const s = isolated(), wall = OBSTACLES.find(b => b.id === 'wall-west');
  place(s, wall.x + 3, wall.z, wall.y);
  s.projectiles.push({ id: 'test-bolt', x: wall.x - 3, z: wall.z, y: wall.y + 1,
    vx: 9, vy: 0, vz: 0, damage: 30, life: 4, owner: 'fixture' });
  advance(s, 50); assert.equal(s.projectiles.length, 0); assert.equal(s.player.hp, s.player.maxHp);
});

test('charger frontal armor reduces sword damage while flanking bypasses it', () => {
  const strike = yaw => {
    const s = isolated(), p = s.player;
    const e = stationaryEnemy(s, 'charger', p.x, p.z + 2, p.y); e.yaw = yaw;
    press(s, 'attack'); advance(s, 10); return e.maxHp - e.hp;
  };
  const frontal = strike(Math.PI), flank = strike(0);
  assert.ok(frontal > 0 && flank >= frontal * 2);
});

test('solid cover blocks both aerial landing shockwaves and charger contact damage',()=>{
  const s=isolated();place(s,-57.5,0);s.player.yaw=Math.PI/2;
  const enemy=stationaryEnemy(s,'stalker',-54.5,0,heightAt(-54.5,0));
  press(s,'jump');advance(s,6);press(s,'attack');advance(s,60);
  assert.equal(enemy.hp,enemy.maxHp,'plunge must respect the quarry wall');
  const c=isolated(),trunk=OBSTACLES.find(b=>b.kind==='trunk');
  const p=place(c,trunk.x-trunk.w/2-.4,trunk.z);
  const charger=spawnEnemy(c,'charger',trunk.x+trunk.w/2+.6,trunk.z,heightAt(trunk.x+trunk.w/2+.6,trunk.z));
  Object.assign(charger,{state:'attack',timer:.5,vx:-15,vz:0,yaw:-Math.PI/2,didHit:false});
  advance(c,20);assert.equal(p.hp,p.maxHp,'tree cover must stop charging contact');
});

test('boss stays inactive before three sigils and phase two includes all attack patterns', () => {
  const s = isolated(); place(s, 0, 27, 28);
  const boss = spawnEnemy(s, 'boss', 0, 31, 28);
  advance(s, 20); assert.equal(boss.state, 'idle');
  allSigils(s); boss.hp = boss.maxHp * .4; s.player.invulnerable = 100;
  const patterns = new Set();
  for (let i = 0; i < 750; i++) { stepGame(s, {}); if (boss.state === 'telegraph') patterns.add(boss.pattern); }
  assert.equal(boss.phase, 2);
  assert.deepEqual([...patterns].sort(), ['bolt', 'ring', 'slam']);
});

test('jumping over a boss ring avoids damage while staying grounded does not', () => {
  const ring = airborne => {
    const s = isolated(); allSigils(s); place(s, 0, 27, airborne ? 29.5 : 28);
    if (airborne) { s.player.grounded = false; s.player.coyote = 0; }
    const boss = spawnEnemy(s, 'boss', 0, 31, 28);
    Object.assign(boss, { state: 'telegraph', pattern: 'ring', timer: DT / 2, yaw: Math.PI });
    stepGame(s, {}); return s.player.hp;
  };
  assert.equal(ring(true), 100); assert.ok(ring(false) < 100);
});

test('guardian resists isolated pulses but three resonance impacts open a stagger window',()=>{
  const s=isolated();place(s,0,27,28);allSigils(s);s.player.invulnerable=100;
  const boss=stationaryEnemy(s,'boss',0,31,28);
  press(s,'skill');assert.equal(boss.state,'recover');assert.equal(boss.poise,1);
  advance(s,90);press(s,'skill');assert.equal(boss.state,'recover');assert.equal(boss.poise,2);
  advance(s,90);press(s,'skill');assert.equal(boss.state,'hit');assert.equal(boss.poise,0);
});

test('quarry first-sigil scenario solves by two physical pulses and walking, without reward helpers', () => {
  const s = isolated(); place(s, -48, -11);
  const initialZ = s.blocks[0].z;
  stepGame(s, { skill: true }); advance(s, 100);
  assert.ok(s.blocks[0].z > initialZ + 3);
  advance(s, 40, { moveZ: 1 }); press(s, 'skill'); advance(s, 180);
  assert.deepEqual(s.progress.sigils, ['quarry']);
  assert.ok(Math.hypot(s.blocks[0].x - PLATE.x, s.blocks[0].z - PLATE.z) < PLATE.radius);
  assert.equal(s.progress.glider, true);
});

test('a lost quarry stone can be recovered at the plinth without paying a resource', () => {
  const s = isolated(), shrine = LANDMARKS.find(l => l.id === 'quarry');
  s.blocks[0].x += 15; s.blocks[0].z += 5;
  place(s, shrine.x, shrine.z, shrine.y); s.player.energy = 0; s.player.crystals = 0;
  assert.equal(interaction(s)?.id, 'quarry'); interact(s);
  assert.equal(s.blocks[0].x, BLOCK_SPAWN.x); assert.equal(s.blocks[0].z, BLOCK_SPAWN.z);
  assert.equal(s.player.energy, 0); assert.equal(s.player.crystals, 0);
});

test('forest first-sigil scenario retries a wrong rune then accepts the clue order', () => {
  const s = isolated();
  // Controlled rune positions test interaction/order; browser covers travel.
  place(s, RUNES[1].x, RUNES[1].z, RUNES[1].y); interact(s);
  assert.equal(s.puzzle.runeStep, 0); assert.deepEqual(s.progress.sigils, []);
  const flasks = s.player.flasks;
  for (const rune of RUNES) { place(s, rune.x, rune.z, rune.y); interact(s); }
  assert.deepEqual(s.progress.sigils, ['forest']); assert.equal(s.player.flasks, flasks);
  const crystals = s.player.crystals; interact(s); assert.equal(s.player.crystals, crystals);
});

test('ruins first-sigil platform route has no rise beyond the measured starting jump', () => {
  const s = isolated(), initialY = s.player.y;
  let apex = initialY; stepGame(s, { jump: true });
  for (let i = 0; i < 80; i++) { apex = Math.max(apex, s.player.y); stepGame(s, {}); }
  const jumpRise = apex - initialY;
  const route = PLATFORMS.filter(p => p.id.startsWith('step-') || p.id === 'observatory');
  let previous = heightAt(route[0].x, route[0].z);
  for (const platform of route) {
    const top = platform.y + platform.h;
    assert.ok(top - previous <= jumpRise, `${platform.id} rises ${(top - previous).toFixed(3)}m; base jump is ${jumpRise.toFixed(3)}m`);
    previous = top;
  }
  // Physical landing from the final jump is still needed before interaction.
  const shrine = LANDMARKS.find(l => l.id === 'ruins');
  place(s, shrine.x, shrine.z, shrine.y + .8); s.player.grounded = false; s.player.coyote = 0;
  advance(s, 30); interact(s); assert.deepEqual(s.progress.sigils, ['ruins']);
});

test('sigil rewards are unique and the final sigil improves resonance damage', () => {
  const pulseDamage = s => {
    const enemy = stationaryEnemy(s, 'charger', s.player.x, s.player.z + 3, s.player.y);
    press(s, 'skill'); return enemy.maxHp - enemy.hp;
  };
  const first = isolated(); assert.equal(awardSigil(first, 'quarry'), true);
  const crystals = first.player.crystals; assert.equal(awardSigil(first, 'quarry'), false);
  assert.equal(awardSigil(first, 'unknown'), false); assert.equal(first.player.crystals, crystals);
  const final = isolated(); allSigils(final);
  assert.ok(final.player.maxStamina > first.player.maxStamina);
  assert.ok(pulseDamage(final) > pulseDamage(first), 'later sigils must improve resonance, not only stamina');
});

test('caches grant rewards once and camp upgrades spend only available crystals', () => {
  const s = isolated(), chest = LANDMARKS.find(l => l.kind === 'chest');
  place(s, chest.x, chest.z, chest.y); interact(s);
  const crystals = s.player.crystals; interact(s); assert.equal(s.player.crystals, crystals);
  assert.equal(s.progress.chests.length, 1);
  const camp = LANDMARKS.find(l => l.id === 'camp'); place(s, camp.x, camp.z, camp.y);
  assert.equal(upgrade(s, 'health'), true); assert.ok(s.player.maxHp > 100);
  assert.equal(upgrade(s, 'health'), false); assert.ok(s.player.crystals >= 0);
});

test('save loading rejects bad envelopes and normalizes contradictory progression safely', () => {
  assert.throws(() => loadSave(null)); assert.throws(() => loadSave({ version: 2 }));
  const save = exportSave(isolated());
  Object.assign(save.progress, { sigils: ['forest', 'forest', 'fake'], glider: false, bossDefeated: true,
    upgrades: { health: 999, power: -100 }, chests: ['fake'] });
  save.crystals = Infinity; save.checkpoint = 'fake';
  const loaded = loadSave(save);
  assert.deepEqual(loaded.progress.sigils, ['forest']); assert.equal(loaded.progress.glider, true);
  assert.equal(loaded.progress.bossDefeated, false); assert.deepEqual(loaded.progress.chests, []);
  assert.ok(loaded.progress.upgrades.health <= 3); assert.equal(loaded.progress.upgrades.power, 0);
  assert.equal(loaded.player.crystals, 0); assert.equal(loaded.player.checkpoint, 'camp');
  assert.ok(Number.isFinite(loaded.player.hp));
});

test('lethal water fall offers death and respawn preserves progress while clearing transient state', () => {
  const s = isolated(); awardSigil(s, 'forest'); s.player.hp = 10;
  Object.assign(s.player, { x: 52, z: -41, y: -4, grounded: false, vy: -3 });
  stepGame(s, {}); assert.equal(s.mode, 'dead'); assert.equal(s.player.hp, 0);
  s.projectiles.push({ id: 'transient' }); s.puzzle.runeStep = 2;
  respawn(s); assert.equal(s.mode, 'playing'); assert.equal(s.player.hp, s.player.maxHp);
  assert.deepEqual(s.progress.sigils, ['forest']); assert.equal(s.projectiles.length, 0);
  assert.equal(s.puzzle.runeStep, 0); assert.equal(s.player.checkpoint, 'camp');
});

test('boss defeat rewards once and completed saves resume free roam with the boss defeated', () => {
  const s = isolated(); allSigils(s); place(s, 0, 27, 28);
  const boss = spawnEnemy(s, 'boss', 0, 30, 28); boss.hp = 1;
  stepGame(s, { skill: true }); assert.equal(s.mode, 'won'); assert.equal(s.progress.bossDefeated, true);
  const crystals = s.player.crystals; advance(s, 100, { skill: true }); assert.equal(s.player.crystals, crystals);
  const loaded = loadSave(exportSave(s)); assert.equal(loaded.mode, 'playing');
  assert.equal(loaded.enemies.find(e => e.type === 'boss').hp, 0);
  const before = loaded.frame; stepGame(loaded, { moveZ: 1 }); assert.equal(loaded.frame, before + 1);
});

test('fast travel requires a discovered camp and is unavailable during nearby combat', () => {
  const s = isolated(); assert.equal(fastTravel(s, 'camp-east'), false);
  s.progress.discovered.push('camp-east');
  const enemy = spawnEnemy(s, 'stalker', s.player.x, s.player.z + 3, s.player.y); enemy.state = 'chase';
  assert.equal(fastTravel(s, 'camp-east'), false);
  enemy.hp = 0; assert.equal(fastTravel(s, 'camp-east'), true);
  assert.equal(s.player.checkpoint, 'camp-east'); assert.equal(fastTravel(s, 'forest'), false);
});
