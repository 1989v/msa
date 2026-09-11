import test from 'node:test';
import assert from 'node:assert/strict';
import { GLIDING, stepGliding } from '../src/gliding.mjs';
const initial = { deployed: false, stamina: 50, velocityY: -8 };
const air = { dt: 1 / 120, grounded: false, position: { x: 0, y: 5, z: 0 } };
const wind = { x: 0, z: 0, radius: 3, minY: 0, maxY: 10, speed: 4 };
const step = (state = initial, frame = {}, volumes = []) => stepGliding(state, { ...air, ...frame }, volumes);
test('only a new airborne press deploys/folds; ground press/reset close sail', () => {
  const open = step(initial, { actionPressed: true }); assert.equal(open.deployed, true);
  assert.equal(step(open).deployed, true); assert.equal(step(open, { actionPressed: true }).deployed, false);
  assert.equal(step(initial, { grounded: true, actionPressed: true }).deployed, false);
  assert.equal(step(open, { grounded: true }).deployed, false);
  assert.equal(step(open, { reset: true }).deployed, false);
  assert.equal(step(initial, { dt: 0, actionPressed: true }).deployed, false);
});
test('exhaustion closes sail, wind cannot revive folded zero stamina, redeploy needs recovery and another press', () => {
  const empty = step({ ...initial, deployed: true, stamina: .01 });
  assert.equal(empty.stamina, 0); assert.equal(empty.deployed, false);
  assert.equal(step(empty, { actionPressed: true }, [wind]).deployed, false);
  assert.equal(step(empty, {}, [wind]).stamina, 0);
  const recovered = step(empty, { grounded: true });
  assert.ok(recovered.stamina > 0); assert.equal(step(recovered).deployed, false);
  assert.equal(step(recovered, { actionPressed: true }).deployed, true);
});
test('mid-tick exhaustion reports funded glide time so gravity applies only to the remainder', () => {
  const next = step({ ...initial, deployed: true, stamina: .01 });
  assert.ok(Math.abs(next.glidingTime - .01 / GLIDING.drain) < 1e-12);
  assert.ok(next.glidingTime > 0 && next.glidingTime < air.dt);
  assert.ok(Math.abs(next.velocityY - (initial.velocityY + GLIDING.acceleration * next.glidingTime)) < 1e-12);
  const integratedVelocity = next.velocityY - 20 * (air.dt - next.glidingTime);
  assert.ok(integratedVelocity > next.velocityY - 20 * air.dt);
  assert.equal(step(next).glidingTime, 0);
  assert.equal(step({ ...initial, deployed: true }, {}, [wind]).glidingTime, air.dt);
});
test('one shared stamina budget clamps and distinguishes sprint, ground recovery, glide and deployed wind', () => {
  assert.equal(step({ ...initial, stamina: 999 }, { grounded: true }).stamina, 100);
  assert.equal(step({ ...initial, stamina: -2 }).stamina, 0);
  assert.ok(step(initial, { grounded: true, sprinting: true }).stamina < initial.stamina);
  assert.ok(step(initial, { grounded: true }).stamina > initial.stamina);
  assert.equal(step(initial).stamina, initial.stamina);
  assert.equal(step(initial, {}, [wind]).stamina, initial.stamina);
  assert.ok(step({ ...initial, deployed: true }).stamina < initial.stamina);
  assert.ok(step({ ...initial, deployed: true }, {}, [wind]).stamina > initial.stamina);
});
test('wind cylinder has exact radial/bottom/top boundaries; overlap chooses capped maximum', () => {
  for (const [position, expected] of [[{ x: 3, y: 0, z: 0 }, 4], [{ x: 3.0001, y: 5, z: 0 }, 0], [{ x: 0, y: -.001, z: 0 }, 0], [{ x: 0, y: 10, z: 0 }, 0]]) {
    assert.equal(step(initial, { position }, [wind]).windSpeed, expected);
  }
  assert.equal(step(initial, {}, [wind, { ...wind, speed: 5 }]).windSpeed, 5);
  assert.equal(step(initial, {}, [{ ...wind, speed: 100 }, wind]).windSpeed, 6);
});
test('deployed speed approaches terminal/wind targets without instantaneous velocity snaps', () => {
  const falling = { ...initial, deployed: true, stamina: 100, velocityY: -60 };
  const next = step(falling);
  assert.ok(Math.abs(next.velocityY - falling.velocityY) <= GLIDING.acceleration * air.dt + 1e-9);
  let state = { ...falling, velocityY: -5 };
  for (let i = 0; i < 120; i++) state = step(state);
  assert.ok(Math.abs(state.velocityY - GLIDING.terminalDescent) < 1e-9);
  for (let i = 0; i < 120; i++) state = step(state, {}, [{ ...wind, speed: 999 }]);
  assert.equal(state.velocityY, 6);
  assert.equal(step(initial).velocityY, initial.velocityY);
});
test('constant-state intervals agree across bounded timestep partitions', () => {
  for (const volumes of [[], [wind]]) {
    let a = { ...initial, deployed: true }, b = { ...a };
    for (let i = 0; i < 120; i++) a = step(a, { dt: 1 / 120 }, volumes);
    for (let i = 0; i < 60; i++) b = step(b, { dt: 1 / 60 }, volumes);
    assert.ok(Math.abs(a.stamina - b.stamina) < 1e-9); assert.ok(Math.abs(a.velocityY - b.velocityY) < 1e-9);
    assert.equal(a.deployed, b.deployed);
  }
});
test('snapshots are frozen; invalid dt/flags/volumes reject before changing caller data', () => {
  const state = { ...initial }, frame = structuredClone(air), volumes = [{ ...wind }];
  assert.ok(Object.isFrozen(stepGliding(state, frame, volumes)));
  for (const bad of [{ dt: -.1 }, { dt: 1 }, { dt: NaN }, { grounded: 1 }, { actionPressed: 'yes' }, { position: { x: Infinity, y: 0, z: 0 } }]) assert.throws(() => step(state, bad, volumes));
  assert.throws(() => step(state, {}, [{ ...wind, radius: 0 }]));
  assert.throws(() => step(state, {}, [{ ...wind, maxY: 0 }]));
  assert.throws(() => step(state, {}, [{ ...wind, speed: -1 }]));
  assert.deepEqual(state, initial); assert.deepEqual(frame, air); assert.deepEqual(volumes, [wind]);
});
