import test from 'node:test';
import assert from 'node:assert/strict';
import { THREE } from '../../t01b/build.mjs';
import { createWorld, pathX } from '../../t01b/src/world.mjs';
import { createTerrain } from '../src/terrain.mjs';
import { createSimulation, MOVEMENT } from '../src/simulation.mjs';

const world = createWorld(THREE);
const meadow = world.root.children.find(o => o.name === 'continuous meadow');
const path = world.root.children.find(o => o.name.startsWith('walkable-looking'));
const surface = mesh => ({ positions: mesh.geometry.attributes.position.array, indices: mesh.geometry.index.array });
const terrain = createTerrain([surface(meadow), surface(path)]);
const flat = createTerrain([{ positions: [-10, 10, -10, 10, 10, -10, 10, 10, 10, -10, 10, 10], indices: [0, 1, 2, 0, 2, 3] }]);
const make = (options = {}) => createSimulation({ terrain: flat, checkpoint: { x: 0, z: 0 }, ...options });
function advance(sim, duration, input = {}, hz = 60) {
  for (let i = 0; i < Math.round(duration * hz); i++) sim.advance(1 / hz, input);
  return sim.snapshot();
}
const near = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

test('actual meadow triangle centroids and route vertices match terrain contact, not an ellipse approximation', () => {
  const { positions, indices } = surface(meadow);
  for (let i = 480; i < indices.length; i += 297) {
    const ids = Array.from(indices.slice(i, i + 3));
    const x = ids.reduce((v, n) => v + positions[n * 3], 0) / 3;
    const z = ids.reduce((v, n) => v + positions[n * 3 + 2], 0) / 3;
    const y = ids.reduce((v, n) => v + positions[n * 3 + 1], 0) / 3;
    const meadowOnly = createTerrain([surface(meadow)]);
    near(meadowOnly.heightAt(x, z), y);
  }
  const p = surface(path).positions;
  for (let i = 0; i < p.length; i += 33) near(terrain.heightAt(p[i], p[i + 2]), p[i + 1]);
  // Outermost jagged mesh vertices define the true shoreline.
  for (let i = 20 * 161; i < 21 * 161; i += 13) {
    const x = positions[i * 3], z = positions[i * 3 + 2];
    assert.notEqual(terrain.heightAt(x * .999, z * .999), null);
    assert.equal(terrain.heightAt(x * 1.001, z * 1.001), null);
  }
});

test('fixed ticks produce identical outcome across frame subdivisions, including jump and landing', () => {
  const a = make(), b = make();
  for (const sim of [a, b]) sim.advance(0, { jumpPressed: true });
  advance(a, 1, { z: -.5 }, 30); advance(b, 1, { z: -.5 }, 144);
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.equal(a.snapshot().grounded, true);
});

test('diagonal input is normalized and yaw rotates camera-relative movement', () => {
  const straight = advance(make(), 1, { x: 1 });
  const diagonal = advance(make(), 1, { x: 1, z: 1 });
  near(Math.hypot(diagonal.position.x, diagonal.position.z), straight.position.x);
  const rotated = advance(make(), 1, { z: -1, yaw: Math.PI / 2 });
  near(rotated.position.x, -MOVEMENT.walk); near(rotated.position.z, 0);
  const analog = advance(make(), 1, { x: .25 }); near(analog.position.x, MOVEMENT.walk / 4);
});

test('walking follows THIS island winding route and terrace slopes without ground penetration', () => {
  const sim = make({ terrain, checkpoint: { x: pathX(38), z: 38 } });
  for (let i = 0; i < 3000 && sim.snapshot().position.z > -30; i++) {
    const { position } = sim.snapshot();
    const targetZ = position.z - .15;
    const dx = pathX(targetZ) - position.x;
    const state = sim.advance(MOVEMENT.step, { x: dx / Math.hypot(dx, .15), z: -.15 / Math.hypot(dx, .15) });
    assert.equal(state.grounded, true); near(state.position.y, terrain.heightAt(state.position.x, state.position.z));
  }
  assert.ok(sim.snapshot().position.z < -30); assert.equal(sim.snapshot().respawns, 0);
});

test('jump buffer survives render frames with no physics tick and fires just after landing', () => {
  const sim = make();
  sim.advance(0, { jumpPressed: true });
  sim.advance(MOVEMENT.step);
  assert.equal(sim.snapshot().mode, 'rising');
  while (!(sim.snapshot().velocity.y < 0 && sim.snapshot().position.y < 10.3)) sim.advance(MOVEMENT.step);
  sim.advance(0, { jumpPressed: true });
  let landed = false, roseAgain = false;
  for (let i = 0; i < 20; i++) {
    const state = sim.advance(MOVEMENT.step);
    landed ||= state.grounded;
    if (landed && state.mode === 'rising') roseAgain = true;
  }
  assert.equal(roseAgain, true);
});

test('coyote jump works shortly after leaving edge and expires; early airborne buffer expires', () => {
  function leaveEdge() {
    const sim = make({ checkpoint: { x: 9.5, z: 0 } });
    while (sim.snapshot().grounded) sim.advance(MOVEMENT.step, { x: 1 });
    return sim;
  }
  const early = leaveEdge();
  assert.equal(early.advance(MOVEMENT.step, { jumpPressed: true }).mode, 'rising');
  const late = leaveEdge(); advance(late, .15);
  assert.equal(late.advance(MOVEMENT.step, { jumpPressed: true }).mode, 'falling');
  const buffered = make(); buffered.advance(MOVEMENT.step, { jumpPressed: true });
  advance(buffered, .2); buffered.advance(MOVEMENT.step, { jumpPressed: true });
  advance(buffered, 1); assert.equal(buffered.snapshot().grounded, true);
});

test('fall into water respawns at safe checkpoint and preserves isolated quest progress', () => {
  const progress = { activatedRuins: ['west'], windGate: false };
  const sim = make({ progress }); progress.activatedRuins.push('external-mutation');
  sim.setCheckpoint({ x: 2, z: 1 });
  let state;
  for (let i = 0; i < 1200; i++) {
    state = sim.advance(MOVEMENT.step, { x: 1 });
    if (state.respawns) break;
  }
  assert.equal(state.respawns, 1); assert.deepEqual(state.position, { x: 2, y: 10, z: 1 });
  assert.deepEqual(state.progress, { activatedRuins: ['west'], windGate: false });
  state.progress.activatedRuins.push('mutated'); assert.equal(sim.snapshot().progress.activatedRuins.length, 1);
  assert.equal(state.grounded, true);
});

test('sprint spends stamina, exhaustion stays released until fresh intent, and ground restores it', () => {
  const sim = make();
  let sprintDistance = 0;
  for (let i = 0; i < 600; i++) {
    const state = sim.advance(MOVEMENT.step, { x: i % 120 < 60 ? 1 : -1, sprint: true });
    if (i < 60) sprintDistance += Math.abs(state.velocity.x) * MOVEMENT.step;
  }
  near(sprintDistance, MOVEMENT.run / 2);
  assert.equal(sim.snapshot().sprinting, false);
  assert.ok(sim.snapshot().stamina > 0 && sim.snapshot().stamina < 100);
  advance(sim, 4); near(sim.snapshot().stamina, 100);
  assert.equal(sim.advance(MOVEMENT.step, { x: 1, sprint: true }).sprinting, true);
});

test('water contact uses scene height -18, passes y=0, and supports a validated water height override', () => {
  for (const waterHeight of [-18, 5]) {
    const sim = make({ checkpoint: { x: 9.5, z: 0 }, ...(waterHeight === -18 ? {} : { waterHeight }) });
    let passedZero = false, previous = sim.snapshot(), recovered = false;
    for (let i = 0; i < 600; i++) {
      const state = sim.advance(MOVEMENT.step, { x: 1 });
      if (state.respawns) {
        const nextY = previous.position.y + (previous.velocity.y - MOVEMENT.gravity * MOVEMENT.step) * MOVEMENT.step;
        assert.ok(previous.position.y > waterHeight);
        assert.ok(nextY <= waterHeight);
        recovered = true; break;
      }
      if (state.position.y <= 0) { passedZero = true; assert.equal(state.respawns, 0); }
      previous = state;
    }
    assert.equal(recovered, true);
    assert.equal(passedZero, waterHeight === -18);
  }
  assert.throws(() => make({ waterHeight: NaN }));
  assert.throws(() => make({ waterHeight: Infinity }));
  assert.throws(() => make({ waterHeight: 10 }));
});

test('grounded motion rejects an upward ledge above maxStep without tunneling underneath', () => {
  const ledge = { heightAt: (x, z) => x >= 1 ? 12 : 10 };
  const sim = make({ terrain: ledge });
  let before = sim.snapshot(), blocked = false;
  for (let i = 0; i < 120; i++) {
    const state = sim.advance(MOVEMENT.step, { x: 1 });
    assert.equal(state.grounded, true); assert.equal(state.position.y, 10);
    assert.ok(state.position.x < 1);
    if (state.position.x === before.position.x) {
      blocked = true; assert.deepEqual(state.position, before.position);
      assert.deepEqual(state.velocity, { x: 0, y: 0, z: 0 });
    }
    before = state;
  }
  assert.equal(blocked, true);
  const smallStep = make({ terrain: { heightAt: x => x >= 1 ? 10.25 : 10 } });
  const climbed = advance(smallStep, .5, { x: 1 });
  assert.ok(climbed.position.x > 1); assert.equal(climbed.position.y, 10.25); assert.equal(climbed.grounded, true);
});

test('bounded frame backlog, released movement, cleared jump and atomic invalid inputs', () => {
  const sim = make();
  const state = sim.advance(1000, { x: 1 }); assert.equal(state.steps, 30); assert.equal(state.droppedTime, 999.75);
  assert.ok(state.alpha < 1); near(state.position.x, MOVEMENT.walk * .25);
  const stopped = sim.advance(.1); near(stopped.position.x, state.position.x);
  sim.advance(0, { jumpPressed: true }); sim.clearInput(); assert.equal(sim.advance(.1).grounded, true);
  const before = sim.snapshot();
  for (const [dt, input] of [[NaN, {}], [-1, {}], [Infinity, {}], [.1, { x: NaN }], [.1, { yaw: Infinity }], [.1, { z: 2 }], [.1, { sprint: 1 }], [.1, { jumpPressed: 'yes' }]]) {
    assert.throws(() => sim.advance(dt, input)); assert.deepEqual(sim.snapshot(), before);
  }
  assert.throws(() => sim.setCheckpoint({ x: 100, z: 100 }));
  assert.throws(() => sim.setCheckpoint({ x: 9.9, z: 0 }));
  assert.throws(() => createTerrain([{ positions: [0, NaN, 0], indices: [0, 0, 0] }]));
  assert.throws(() => createTerrain([{ positions: [0, 0, 0], indices: [0, 1, 2] }]));
});
