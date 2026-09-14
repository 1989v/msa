import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressSave } from '../../t07a/src/save.mjs';
import { createSimulation } from '../../t02a/src/simulation.mjs';
import { createTarget } from '../../t05a/src/target.mjs';
import { createGuardian } from '../../t05a/src/guardian.mjs';

test('reload restores completed ruin at safe spawn and prevents its guardian retaliating', () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const save = createProgressSave(() => storage);
  assert.equal(save.save({ watchRuinActive: true, firstAerialLanding: true, secondAerialLanding: true }).ok, true);
  const progress = createProgressSave(() => storage).load().progress;
  const simulation = createSimulation({ terrain: { heightAt: () => 2 }, progress });
  assert.deepEqual(simulation.snapshot().position, { x: 0, y: 2, z: 35 });
  const target = createTarget({ position: { x: 0, y: 2.8, z: 35 } });
  const combat = target.reset({ defeated: progress.watchRuinActive });
  assert.equal(combat.hp, 0);
  const guardian = createGuardian({ position: combat.target });
  const state = guardian.advance(2, simulation.snapshot().position, { defeated: combat.defeated });
  assert.equal(state.player.hp, 3);
  assert.equal(simulation.respawn().progress.watchRuinActive, true);
  save.clear();
  assert.deepEqual(save.load().progress, {});
  assert.equal(target.reset().hp, 3);
});
