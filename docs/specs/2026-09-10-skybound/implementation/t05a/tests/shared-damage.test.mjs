import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuardian } from '../src/guardian.mjs';
const far = { x: 10, y: 0, z: 0 }, near = { x: 0, y: 0, z: 0 };
const create = () => createGuardian({ position: { x: 0, y: .8, z: 0 } });
test('external strikes share one invulnerability clock, including after guardian defeat', () => {
  const g = create();
  const s = g.advance(.25, far, { defeated: true, extraHits: [.2, .1] });
  assert.equal(s.player.hp, 2); assert.ok(Math.abs(s.player.invulnerable - .85) < 1e-8);
  assert.equal(g.advance(.25, far, { defeated: true, extraHits: [.1] }).player.hp, 2);
  g.advance(.6, far, { defeated: true });
  assert.equal(g.advance(.2, far, { defeated: true, extraHits: [.1] }).player.hp, 1);
});
test('counterattack and charger strike at the same instant cause one hit', () => {
  const g = create();
  g.advance(.6, near);
  assert.equal(g.advance(.25, near, { extraHits: [.2] }).player.hp, 2);
});
test('dodge is evaluated at each strike time; pause and respawn discard pending damage', () => {
  const g = create();
  assert.equal(g.advance(.25, far, { extraHits: [.1, .2], invulnerableAt: offset => offset < .18 }).player.hp, 2);
  assert.equal(g.advance(.25, far, { extraHits: [.2], paused: true }).player.hp, 2);
  assert.equal(g.advance(.25, far, { extraHits: [.2], respawned: true }).player.hp, 3);
  assert.throws(() => g.advance(.1, far, { extraHits: [.2] }));
});
