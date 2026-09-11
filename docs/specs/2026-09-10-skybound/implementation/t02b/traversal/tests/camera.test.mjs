import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_DEFAULTS, updateCamera, cameraOffset } from '../src/camera.mjs';
test('drag and wheel clamp pitch/distance, wrap yaw, and reset without changing input', () => {
  const before = { ...CAMERA_DEFAULTS };
  const dragged = updateCamera(before, { type: 'drag', dx: 4000, dy: 4000 });
  assert.ok(dragged.yaw >= -Math.PI && dragged.yaw <= Math.PI); assert.equal(dragged.pitch, 1.15);
  assert.equal(updateCamera(dragged, { type: 'drag', dx: 0, dy: -4000 }).pitch, .08);
  assert.equal(updateCamera(before, { type: 'zoom', delta: 10000 }).distance, 8);
  assert.equal(updateCamera(before, { type: 'zoom', delta: -10000 }).distance, 3);
  assert.deepEqual(updateCamera(dragged, { type: 'reset' }), CAMERA_DEFAULTS);
  assert.deepEqual(before, CAMERA_DEFAULTS);
});
test('camera behind vector opposes the simulation forward vector at quarter-turns', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const view = updateCamera(CAMERA_DEFAULTS, { type: 'set', yaw });
    const offset = cameraOffset(view);
    assert.ok(Math.abs(Math.hypot(offset.x, offset.y, offset.z) - view.distance) < 1e-9);
    const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    assert.ok(offset.x * forward.x + offset.z * forward.z < -3);
    assert.ok(offset.y > 0);
  }
});
test('unknown commands and nonfinite input reject without partial mutation', () => {
  for (const command of [{ type: 'fly' }, { type: 'set', yaw: NaN }, { type: 'set', pitch: Infinity }, { type: 'zoom', delta: Infinity }, { type: 'drag', dx: 1, dy: NaN }]) {
    const before = { ...CAMERA_DEFAULTS };
    assert.throws(() => updateCamera(before, command), TypeError);
    assert.deepEqual(before, CAMERA_DEFAULTS);
  }
});
