import test from 'node:test';
import assert from 'node:assert/strict';
import { createManipulation, objectBounds, overlaps, segmentHitsBox } from '../src/manipulation.mjs';
const v = (x, y = 1, z = 0) => ({ x, y, z });
const b = (min, max) => ({ min, max });
const stone = { id: 'stone-a', kind: 'stone', size: v(1, 1, 1), position: v(2), yaw: 0 };
const frame = () => ({ eye: v(0), player: b(v(-.3, 0, -.3), v(.3, 1.8, .3)) });
const create = options => createManipulation({ objects: [stone], ...options });
function grab(c, f = frame()) { assert.equal(c.dispatch({ type: 'select', id: stone.id }, f).ok, true); assert.equal(c.dispatch({ type: 'grab' }, f).ok, true); }

test('allowlist, positive finite dimensions, yaw and IDs validate before use', () => {
  for (const patch of [{ kind: 'tree' }, { size: v(0) }, { yaw: 45 }, { position: v(NaN) }]) assert.throws(() => create({ objects: [{ ...stone, ...patch }] }));
  assert.throws(() => create({ objects: [stone, stone] }));
  const input = structuredClone(stone), c = create({ objects: [input] }); input.position.x = 99;
  assert.equal(c.snapshot().objects[0].position.x, 2); assert.ok(Object.isFrozen(c.snapshot().objects[0].position));
});

test('selection and grab revalidate actual walls, stale range, and single ownership', () => {
  const c = create(), f = frame();
  assert.equal(c.dispatch({ type: 'select', id: 'unknown' }, f).reason, 'unknown');
  assert.equal(c.dispatch({ type: 'select', id: stone.id }, { ...f, eye: v(-8) }).reason, 'range');
  c.dispatch({ type: 'select', id: stone.id }, f);
  const wall = b(v(.8, 0, -1), v(1, 3, 1));
  assert.equal(c.dispatch({ type: 'grab' }, { ...f, walls: [wall] }).reason, 'occluded');
  assert.equal(c.dispatch({ type: 'grab' }, { ...f, eye: v(-8) }).reason, 'range');
  assert.equal(c.dispatch({ type: 'grab' }, f).ok, true);
  assert.equal(c.dispatch({ type: 'select', id: stone.id }, f).reason, 'held');
  assert.equal(c.dispatch({ type: 'grab' }, f).reason, 'held');
});

test('open AABB contact and slab boundaries distinguish touching from crossing', () => {
  const cube = b(v(1, 0, -1), v(2, 2, 1));
  assert.equal(segmentHitsBox(v(0), v(3), cube), true);
  assert.equal(segmentHitsBox(v(0, 2), v(3, 2), cube), false);
  assert.equal(overlaps(cube, b(v(2, 0, -1), v(3, 2, 1))), false);
  assert.equal(overlaps(cube, b(v(1.99, 0, -1), v(3, 2, 1))), true);
});

test('invalid preview never commits; player/object overlap and swept crossing block transport', () => {
  const other = { ...stone, id: 'prism-b', kind: 'prism', position: v(3.5) };
  const c = create({ objects: [stone, other], reach: 10 }); grab(c);
  const committed = c.committedSnapshot();
  assert.equal(c.dispatch({ type: 'move', position: v(0) }, frame()).reason, 'overlap');
  assert.equal(c.snapshot().preview.valid, false); assert.equal(c.dispatch({ type: 'drop' }, frame()).ok, false);
  assert.equal(c.dispatch({ type: 'move', position: v(3.5) }, frame()).reason, 'overlap');
  assert.equal(c.dispatch({ type: 'move', position: v(5) }, frame()).reason, 'sweep');
  assert.equal(c.committedSnapshot(), committed); assert.equal(c.snapshot().held.position.x, 2);
  const thinWall = b(v(1.8, 0, .9), v(2.2, 2, 1.1));
  assert.equal(c.dispatch({ type: 'move', position: v(2, 1, 2) }, { ...frame(), walls: [thinWall] }).reason, 'sweep');
  assert.equal(c.snapshot().held.position.z, 0); assert.equal(c.committedSnapshot(), committed);
  assert.equal(c.dispatch({ type: 'move', position: v(2, 1, 2) }, frame()).ok, true);
  assert.equal(c.committedSnapshot(), committed);
});

test('rotation swaps extents and conservatively blocks swept corners', () => {
  const prism = { ...stone, size: v(2, 1, .5) };
  const bounds = objectBounds(prism, { position: v(2), yaw: 90 });
  assert.equal(bounds.max.x - bounds.min.x, .5); assert.equal(bounds.max.z - bounds.min.z, 2);
  const c = create({ objects: [prism] }); grab(c);
  assert.equal(c.dispatch({ type: 'rotate', yaw: 90 }, frame()).ok, true);
  const before = c.snapshot(); assert.throws(() => c.dispatch({ type: 'rotate', yaw: 12 }, frame())); assert.equal(c.snapshot(), before);
  const wall = b(v(2.8, 0, .8), v(3, 2, 1));
  assert.equal(c.dispatch({ type: 'rotate', yaw: 180 }, { ...frame(), walls: [wall] }).reason, 'sweep');
});

test('drop revalidates newly blocked LOS/current actor and valid drop alone commits', () => {
  const c = create(); grab(c); c.dispatch({ type: 'move', position: v(3) }, frame());
  const before = c.snapshot();
  assert.equal(c.dispatch({ type: 'drop' }, { ...frame(), walls: [b(v(1, 0, -1), v(1.2, 3, 1))] }).reason, 'occluded');
  assert.equal(c.snapshot(), before);
  assert.equal(c.dispatch({ type: 'drop' }, { ...frame(), eye: v(-5) }).reason, 'range');
  assert.equal(c.dispatch({ type: 'drop' }, frame()).ok, true);
  assert.equal(c.committedSnapshot()[0].position.x, 3); assert.equal(c.snapshot().held, null);
});

test('pause freezes transport; cancel returns last commit; reset originals; invalid inputs atomic', () => {
  const c = create(); grab(c); c.dispatch({ type: 'move', position: v(3) }, frame()); c.dispatch({ type: 'drop' }, frame());
  grab(c); c.dispatch({ type: 'move', position: v(3, 1, 1) }, frame());
  const paused = c.dispatch({ type: 'pause' }).state;
  for (const type of ['move', 'rotate', 'drop', 'cancel']) assert.equal(c.dispatch({ type }, frame()).reason, 'paused');
  assert.equal(c.snapshot(), paused); c.dispatch({ type: 'resume' });
  const before = c.snapshot(); assert.throws(() => c.dispatch({ type: 'move', position: v(Infinity) }, frame())); assert.equal(c.snapshot(), before);
  c.dispatch({ type: 'cancel' }); assert.equal(c.committedSnapshot()[0].position.x, 3); assert.equal(c.snapshot().held, null);
  c.dispatch({ type: 'reset' }); assert.equal(c.committedSnapshot()[0].position.x, 2);
});
