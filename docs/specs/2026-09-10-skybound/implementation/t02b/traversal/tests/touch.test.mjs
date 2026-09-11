import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchInput } from '../src/touch.mjs';
test('move/look own separate IDs, reject duplicates/extras, and release independently', () => {
  const t = createTouchInput();
  assert.equal(t.begin('move', 1, 100, 100), true);
  assert.equal(t.begin('look', 2, 300, 100), true);
  assert.equal(t.begin('move', 3), false); assert.equal(t.begin('look', 1), false);
  t.move(1, 140, 60); assert.deepEqual(t.move(2, 315, 95), { dx: 15, dy: -5 });
  assert.ok(Math.abs(Math.hypot(t.snapshot().x, t.snapshot().z) - 1) < 1e-9);
  assert.equal(t.end(99), false); assert.equal(t.snapshot().moveId, 1);
  t.end(2, { cancel: true }); assert.equal(t.snapshot().lookId, null); assert.equal(t.snapshot().moveId, 1);
  t.end(1); assert.equal(t.snapshot().x, 0); assert.equal(t.snapshot().z, 0);
});
test('analog strength preserved, unrelated pointers cannot move the joystick', () => {
  const t = createTouchInput(); t.begin('move', 1, 0, 0); t.move(1, 10, -20);
  assert.equal(t.snapshot().x, .25); assert.equal(t.snapshot().z, -.5);
  t.move(7, 1000, 1000); assert.equal(t.snapshot().x, .25);
  assert.throws(() => t.move(1, NaN, 0), TypeError); assert.equal(t.snapshot().x, .25);
});
test('sprint hold and jump pulse are independent; held/duplicate jump never repeats', () => {
  const t = createTouchInput(); t.begin('sprint', 4); t.begin('jump', 5);
  assert.equal(t.consumeJump(), true); assert.equal(t.consumeJump(), false);
  assert.equal(t.begin('jump', 5), false); assert.equal(t.consumeJump(), false);
  t.end(5); assert.equal(t.snapshot().sprint, true);
  t.begin('jump', 6); t.end(6); assert.equal(t.consumeJump(), true);
  t.begin('jump', 7); t.end(7, { cancel: true }); assert.equal(t.consumeJump(), false);
  t.end(4); assert.equal(t.snapshot().sprint, false);
});
test('lifecycle clear cancels every owner, held button and buffered jump', () => {
  const t = createTouchInput(); ['move', 'look', 'sprint', 'jump'].forEach((role, i) => t.begin(role, i)); t.move(0, 40, 40); t.clear();
  assert.deepEqual(t.snapshot(), { x: 0, z: 0, sprint: false, moveId: null, lookId: null, sprintId: null, jumpId: null, jumpPending: false });
  const copy = t.snapshot(); copy.moveId = 20; assert.equal(t.snapshot().moveId, null);
});
