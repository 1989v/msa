import test from 'node:test';
import assert from 'node:assert/strict';
import { activateWindRuin, ruinSnapshot } from '../src/ruins.mjs';

const route = Object.freeze({ firstAerialLanding: true, secondAerialLanding: true });
const contact = { position: { x: 0, y: 0, z: 0 }, device: { x: 0, y: 0, z: 0 }, grounded: true, onPlatform: true };

test('wind activation preserves progress, accepts inclusive distance limits, and is idempotent', () => {
  const progress = Object.freeze({ ...route, watchRuinActive: true });
  const active = activateWindRuin(progress, { ...contact, position: { x: 1.5, y: 0.1, z: 0 } });
  assert.notEqual(active, progress);
  assert.deepEqual(active, { ...progress, windRuinActive: true });
  assert.equal(activateWindRuin(active, { ...contact, paused: true }), active);
});

test('wind activation requires both route landings, platform contact, and available interaction', () => {
  for (const change of [{ firstAerialLanding: false }, { secondAerialLanding: false }, { firstAerialLanding: 1 }, { secondAerialLanding: 'true' }]) {
    const progress = { ...route, ...change };
    assert.equal(activateWindRuin(progress, contact), progress);
  }
  assert.equal(activateWindRuin({}, contact).windRuinActive, undefined);
  for (const change of [{ grounded: false }, { grounded: 1 }, { onPlatform: false }, { onPlatform: undefined }, { paused: true }, { blocked: true }]) {
    assert.equal(activateWindRuin(route, { ...contact, ...change }), route);
  }
});

test('wind activation rejects remote, nonfinite, and incomplete coordinates', () => {
  for (const value of [{ x: 1.50001, y: 0, z: 0 }, { x: 0, y: 0.10001, z: 0 }, { x: 1.1, y: 0, z: 1.1 }, { x: NaN, y: 0, z: 0 }, { x: 0, y: Infinity, z: 0 }, { x: 0, y: 0 }, null]) {
    for (const key of ['position', 'device']) {
      assert.equal(activateWindRuin(route, { ...contact, [key]: value }), route);
    }
  }
});

test('snapshot counts three ruins in every order and ignores invalid wind completion', () => {
  assert.deepEqual(ruinSnapshot({}), { stone: false, watch: false, wind: false, count: 0, complete: false });
  for (const progress of [{ windRuinActive: true }, { ...route, firstAerialLanding: false, windRuinActive: true }, { stoneRuinActive: 1, watchRuinActive: 'true' }]) {
    assert.equal(ruinSnapshot(progress).count, 0);
  }
  const flags = ['stoneRuinActive', 'watchRuinActive', 'windRuinActive'];
  for (const first of flags) {
    for (const second of flags.filter(flag => flag !== first)) {
      const third = flags.find(flag => flag !== first && flag !== second);
      const progress = { ...route };
      [first, second, third].forEach((flag, index) => {
        progress[flag] = true;
        assert.equal(ruinSnapshot(progress).count, index + 1);
        assert.equal(ruinSnapshot(progress).complete, index === 2);
      });
      assert.deepEqual(ruinSnapshot(progress), { stone: true, watch: true, wind: true, count: 3, complete: true });
    }
  }
});
