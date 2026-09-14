import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createWorld } from '../../t01b/src/world.mjs';
import { createTerrain } from '../../t02a/src/terrain.mjs';
import { createChargerView } from '../../t02b/traversal/src/charger-view.mjs';
import { createGuardian } from '../../t05a/src/guardian.mjs';
test('charger on actual meadow synchronizes combat pose, deals damage, and preserves defeat on respawn', () => {
  const world = createWorld(THREE); world.root.updateMatrixWorld(true);
  const surfaces = [world.root.getObjectByName('continuous meadow'), world.root.children.find(o => o.name.startsWith('walkable-looking'))];
  const terrain = createTerrain(surfaces.map(mesh => {
    const positions = [];
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) positions.push(...new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld).toArray());
    return { positions, indices: mesh.geometry.index.array };
  }));
  const view = createChargerView(THREE, world.col, terrain, () => true, () => surfaces);
  const guardian = createGuardian({ position: { x: 20, y: 0, z: 20 } });
  const player = { x: -1.5, y: terrain.heightAt(-1.5, 25), z: 25 };
  for (let i = 0; i < 240; i++) {
    const motion = view.controller.advance(1 / 120, player); view.move(motion); view.paint(motion);
    guardian.advance(1 / 120, player, { extraHits: motion.hits.map(hit => hit.offset) });
  }
  assert.equal(guardian.snapshot().player.hp, 2);
  assert.equal(view.root.position.x, view.combat.snapshot().target.x);
  assert.equal(view.root.position.y + .65, view.combat.snapshot().target.y);
  for (let i = 0; i < 3; i++) {
    view.combat.beginSwing(); view.combat.advance(.3, { position: { ...view.controller.snapshot().position }, yaw: 0 }); view.combat.cancelSwing();
  }
  assert.equal(view.combat.snapshot().defeated, true);
  view.resetMotion(); assert.equal(view.combat.snapshot().hp, 0);
  assert.deepEqual(view.controller.advance(.25, player, { defeated: true }).hits, []);
  view.reset(); assert.equal(view.combat.snapshot().hp, 3);
});
