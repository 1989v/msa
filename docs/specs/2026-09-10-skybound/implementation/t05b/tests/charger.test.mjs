import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharger } from '../src/charger.mjs';
const home = { x: 0, y: 0, z: 0 }, target = { x: 3, y: 0, z: 0 };
const create = options => createCharger({ home, terrain: { heightAt: () => 0 }, ...options });
function steps(charger, count, player = target) { return Array.from({ length: count }, () => charger.advance(1 / 120, player)); }
test('long warning locks direction, permits sidestep, then returns home', () => {
  const c = create(); steps(c, 60);
  assert.equal(c.snapshot().phase, 'windup'); assert.deepEqual(c.snapshot().position, home);
  const missed = steps(c, 180, { x: 3, y: 0, z: 3 });
  assert.equal(missed.flatMap(s => s.hits).length, 0);
  assert.ok(c.snapshot().position.x > 3.9); assert.equal(c.snapshot().position.z, 0);
  steps(c, 700, { x: 30, y: 0, z: 30 });
  assert.equal(c.snapshot().phase, 'idle'); assert.ok(Math.hypot(c.snapshot().position.x, c.snapshot().position.z) < .02);
});
test('a charge emits at most one damage event with a frame-relative timestamp', () => {
  const c = create(); const hits = steps(c, 240).flatMap(s => s.hits);
  assert.equal(hits.length, 1); assert.equal(hits[0].sequence, 1); assert.ok(hits[0].offset <= 1 / 120);
});
test('terrain gaps, high ledges and walls stop a charge before crossing', () => {
  for (const options of [{ terrain: { heightAt: x => x > 1 ? null : 0 } }, { terrain: { heightAt: x => x > 1 ? 2 : 0 } }, { canMove: (from, to) => to.x < .6 }]) {
    const c = create(options); steps(c, 240);
    assert.equal(c.snapshot().phase, 'recovery'); assert.ok(c.snapshot().position.x <= .6);
  }
});
test('pause, defeated latch, LOS, height and detection gates are respected', () => {
  const c = create(); c.advance(.2, target); const before = c.snapshot();
  assert.deepEqual(c.advance(.25, target, { paused: true }), { ...before, hits: [] });
  c.advance(.1, target, { defeated: true }); assert.equal(c.advance(.25, target).phase, 'defeated');
  assert.deepEqual(c.reset().position, home);
  for (const player of [{ x: 9, y: 0, z: 0 }, { x: 1, y: 4, z: 0 }]) assert.equal(c.advance(.25, player).phase, 'idle');
  assert.equal(create({ lineOfSight: () => false }).advance(.25, target).phase, 'idle');
});

test('phase transitions preserve time across uneven frame partitions', () => {
  const a = create(), b = create();
  for (let i = 0; i < 100; i++) a.advance(.017, target);
  for (let i = 0; i < 6; i++) b.advance(.25, target);
  b.advance(.2, target);
  assert.equal(a.snapshot().phase, b.snapshot().phase);
  assert.ok(Math.abs(a.snapshot().position.x - b.snapshot().position.x) < 1e-8);
});
