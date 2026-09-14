import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createPlatform } from '../../t02b/traversal/src/platform.mjs';
import { createWindAltarView } from '../../t02b/traversal/src/wind-altar-view.mjs';
import { activateWindRuin, ruinSnapshot } from '../../t06a/src/ruins.mjs';
import { createProgressSave } from '../../t07a/src/save.mjs';

test('altar uses actual landing top and all three ruins survive save reload', () => {
  const col = () => new THREE.Color();
  const platform = createPlatform(THREE, col, { heightAt: () => 0 }, { x: 14, z: 30, topY: 3.12345 });
  const altar = createWindAltarView(THREE, col, platform);
  const flags = { stoneRuinActive: true, watchRuinActive: true, firstAerialLanding: true, secondAerialLanding: true };
  const activate = position => activateWindRuin(flags, { position, device: altar.position, grounded: true, onPlatform: platform.supports(position) });
  assert.equal(activate({ ...altar.position, y: 0 }), flags);
  const progress = activate(altar.position);
  assert.equal(ruinSnapshot(progress).complete, true);
  let raw = null;
  const save = createProgressSave(() => ({ getItem: () => raw, setItem: (key, value) => { raw = value; } }));
  assert.equal(save.save(progress).ok, true);
  const restored = ruinSnapshot(save.load().progress);
  assert.equal(restored.count, 3);
  altar.update(restored.wind);
  assert.equal(altar.root.position.y, platform.topY);
  assert.equal(altar.root.children[0].position.y, 1.1);
});
