import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, MOVEMENT } from '../src/simulation.mjs';
import { stepGliding } from '../../t03a/src/gliding.mjs';
const dt = MOVEMENT.step;
const flat = { heightAt: () => 10 };
const make = options => createSimulation({ terrain: flat, checkpoint: { x: 0, z: 0 }, flight: { enabled: true }, ...options });
const ticks = (sim, count, input = {}) => { for (let i = 0; i < count; i++) sim.advance(dt, input); return sim.snapshot(); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('opt-in only: default snapshots/modes are unchanged; one ground press never deploys', () => {
  const legacy = make({ flight: null }); legacy.advance(dt, { jumpPressed: true });
  assert.equal('gliding' in legacy.snapshot(), false); assert.equal(legacy.snapshot().mode, 'rising');
  const sim = make(); sim.advance(0, { jumpPressed: true });
  sim.advance(dt / 2); assert.equal(sim.snapshot().grounded, true);
  const jumped = sim.advance(dt / 2); assert.equal(jumped.mode, 'rising'); assert.equal(jumped.gliding, false);
  sim.advance(0, { jumpPressed: true });
  assert.equal(sim.advance(dt).mode, 'gliding');
  assert.equal(sim.advance(dt).gliding, true);
  sim.advance(0, { jumpPressed: true }); sim.clearInput(); assert.equal(sim.advance(dt).gliding, true);
  assert.equal(sim.advance(dt, { jumpPressed: true }).gliding, false);
});
test('coyote and imminent folded landing prioritize one jump buffer over deployment', () => {
  const ledge = { heightAt: x => x < 1 ? 10 : null };
  const edge = make({ terrain: ledge });
  while (edge.snapshot().grounded) edge.advance(dt, { x: 1 });
  const coyote = edge.advance(dt, { jumpPressed: true }); assert.equal(coyote.mode, 'rising'); assert.equal(coyote.gliding, false);
  const sim = make(); sim.advance(dt, { jumpPressed: true });
  while (!(sim.snapshot().velocity.y < 0 && sim.snapshot().position.y < 10.3)) sim.advance(dt);
  sim.advance(0, { jumpPressed: true }); let landed = false, jumpedAgain = false;
  for (let i = 0; i < 30; i++) {
    const state = sim.advance(dt); assert.equal(state.gliding, false);
    landed ||= state.grounded; if (landed && state.mode === 'rising') jumpedAgain = true;
  }
  assert.equal(jumpedAgain, true);
});
test('shared sprint/recovery budget applies once; glide drain and midtick exhaustion split gravity', () => {
  const sim = make(); ticks(sim, 120, { x: 1, sprint: true }); near(sim.snapshot().stamina, 76);
  sim.advance(dt); near(sim.snapshot().stamina, 76 + 28 * dt);
  const tired = make(); ticks(tired, 499, { x: 1, sprint: true });
  tired.advance(dt); // 28/120 recovery leaves a nonintegral final glide tick.
  tired.advance(dt, { jumpPressed: true }); tired.advance(dt, { jumpPressed: true }); ticks(tired, 3);
  const before = tired.snapshot();
  const rules = stepGliding({ deployed: before.gliding, stamina: before.stamina, velocityY: before.velocity.y },
    { dt, grounded: false, position: before.position });
  const next = tired.advance(dt);
  assert.ok(rules.glidingTime > 0 && rules.glidingTime < dt);
  near(next.stamina, rules.stamina); near(next.velocity.y, rules.velocityY - MOVEMENT.gravity * (dt - rules.glidingTime));
  ticks(tired, 2); assert.equal(tired.snapshot().gliding, false); near(tired.snapshot().stamina, 0);
});
test('wind config is eagerly validated and copied; overlap returns maximum without double recovery', () => {
  const volumes = [{ x: 0, z: 0, radius: 100, minY: 0, maxY: 100, speed: 3 }, { x: 0, z: 0, radius: 100, minY: 0, maxY: 100, speed: 4 }];
  const sim = make({ flight: { enabled: true, volumes } });
  volumes[0].radius = 0; volumes[1].speed = 999;
  ticks(sim, 120, { x: 1, sprint: true }); sim.advance(dt, { jumpPressed: true });
  const before = sim.snapshot().stamina, state = sim.advance(dt, { jumpPressed: true });
  assert.equal(state.windSpeed, 4); near(state.stamina, before + 18 * dt);
  for (const flight of [{ enabled: 'yes' }, { enabled: true, volumes: [{}] }, { enabled: false, volumes: [{ x: 0, z: 0, radius: -1, minY: 0, maxY: 1, speed: 1 }] }]) assert.throws(() => make({ flight }));
});
test('enabled action replay is fixed-tick deterministic across frame partitions', () => {
  const a = make(), b = make();
  for (const sim of [a, b]) { sim.advance(dt, { jumpPressed: true }); sim.advance(0, { jumpPressed: true }); }
  for (let i = 0; i < 30; i++) a.advance(1 / 30, { z: -.25 });
  for (let i = 0; i < 144; i++) b.advance(1 / 144, { z: -.25 });
  assert.deepEqual(a.snapshot(), b.snapshot());
});
test('landing closes sail immediately; respawn clears flight effects and preserves progress', () => {
  const land = make(); land.advance(dt, { jumpPressed: true }); land.advance(dt, { jumpPressed: true });
  let landed = false;
  for (let i = 0; i < 500; i++) { const s = land.advance(dt); if (s.grounded) { assert.equal(s.gliding, false); assert.equal(s.windSpeed, 0); landed = true; break; } }
  assert.equal(landed, true);
  const sim = make({ terrain: { heightAt: x => x < 1 ? 10 : null }, progress: { ruin: true } });
  while (sim.snapshot().grounded) sim.advance(dt, { x: 1 }); ticks(sim, 15, { x: 1 });
  assert.equal(sim.advance(dt, { jumpPressed: true }).gliding, true);
  let respawned = false;
  for (let i = 0; i < 1800; i++) {
    const s = sim.advance(dt, { x: 1 });
    if (s.respawns) { assert.equal(s.gliding, false); assert.equal(s.windSpeed, 0); assert.equal(s.stamina, 100); assert.deepEqual(s.progress, { ruin: true }); assert.deepEqual(s.velocity, { x: 0, y: 0, z: 0 }); respawned = true; break; }
  }
  assert.equal(respawned, true);
});
test('invalid advance input leaves queued deploy intact and snapshots unchanged; backlog bound retained', () => {
  const sim = make(); sim.advance(dt, { jumpPressed: true }); sim.advance(0, { jumpPressed: true }); const before = sim.snapshot();
  for (const [time, input] of [[NaN, {}], [-1, {}], [.1, { yaw: Infinity }], [.1, { jumpPressed: 1 }]]) {
    assert.throws(() => sim.advance(time, input)); assert.deepEqual(sim.snapshot(), before);
  }
  assert.equal(sim.advance(dt).gliding, true);
  const result = sim.advance(1000); assert.equal(result.steps, 30); assert.equal(result.droppedTime, 999.75);
});
