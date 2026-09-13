import { createManipulation, objectBounds, overlaps } from '../../../t04a/src/manipulation.mjs';

import { sampleGroundSupport } from './ground-support.mjs';

export function carryTarget(terrain, position, yaw, pitch, size, objectYaw = 0) {
  const distance = Math.max(.5, Math.min(3, 1.05 / Math.tan(pitch)));
  const x = position.x - Math.sin(yaw) * distance, z = position.z - Math.cos(yaw) * distance;
  const floor = terrain.heightAt(x, z);
  if (!Number.isFinite(floor)) return null;
  const result = sampleGroundSupport(terrain, { size }, { position: { x, y: floor + size.y / 2, z }, yaw: objectYaw });
  return result.reason ? null : result.pose.position;
}

export function createManipulationView(THREE, col, terrain, surfaces = []) {
  const floor = terrain.heightAt(0, 33);
  if (!Number.isFinite(floor)) throw new Error('Prism needs actual meadow');
  const original = { id: 'meadow-prism', kind: 'prism', size: { x: 1.2, y: 1, z: .7 }, position: { x: 0, y: floor + .5, z: 33 }, yaw: 0 };
  const initialSupport = sampleGroundSupport(terrain, original);
  if (initialSupport.reason) throw new Error('Prism initial footprint lacks support');
  original.position = initialSupport.pose.position;
  const ray = new THREE.Raycaster(), origin = new THREE.Vector3(), direction = new THREE.Vector3();
  const blockerFloor = terrain.heightAt(-1.5, 32);
  if (!Number.isFinite(blockerFloor)) throw new Error('Blocker needs meadow');
  const blockerBounds = { min: { x: -2, y: blockerFloor, z: 31.8 }, max: { x: -1, y: blockerFloor + 1.6, z: 32.2 } };
  const controller = createManipulation({ objects: [original], resolvePlacement: (object, at) => sampleGroundSupport(terrain, object, at), walls: [blockerBounds], lineOfSight(from, to) {
    origin.set(from.x, from.y, from.z); direction.set(to.x, to.y, to.z).sub(origin);
    const length = direction.length(); ray.set(origin, direction.normalize()); ray.near = .001; ray.far = Math.max(.001, length - .001);
    return ray.intersectObjects(surfaces, false).length === 0;
  } });
  const root = new THREE.Group(); root.name = 'manipulation prism';
  const blocker = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, .4), new THREE.MeshStandardMaterial({ color: col('slate'), roughness: 1 }));
  blocker.name = 'solid carry blocker'; blocker.position.set(-1.5, blockerFloor + .8, 32); blocker.castShadow = true; blocker.receiveShadow = true; root.add(blocker);
  const geometry = new THREE.BoxGeometry(original.size.x, original.size.y, original.size.z);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: col('chalk'), roughness: .8 }));
  mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: col('brass') }));
  outline.scale.setScalar(1.015); mesh.add(outline);
  const ghost = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: col('ochre'), wireframe: true, depthTest: false }));
  ghost.visible = false; root.add(ghost);
  let frame = null, targetId = null, lastReason = null, lastTarget = null;
  function context() {
    const p = frame.position;
    return { eye: { x: p.x, y: p.y + 1.35, z: p.z }, player: {
      min: { x: p.x - .3, y: p.y, z: p.z - .3 }, max: { x: p.x + .3, y: p.y + 1.68, z: p.z + .3 },
    } };
  }
  function paint() {
    const s = snapshot(), at = s.held ?? s.objects[0];
    mesh.position.copy(at.position); mesh.rotation.y = at.yaw * Math.PI / 180;
    outline.visible = !!s.held || targetId !== null || s.selected !== null;
    outline.material.color.copy(col(s.held ? s.preview?.valid === false ? 'ochre' : 'meadow' : 'brass'));
    ghost.visible = !!s.held && s.preview?.valid === false;
    if (ghost.visible) { ghost.position.copy(s.preview.pose.position); ghost.rotation.y = s.preview.pose.yaw * Math.PI / 180; }
    root.updateMatrixWorld(true);
  }
  function snapshot() {
    const s = controller.snapshot();
    return { ...s, ...(s.held && lastReason === 'terrain' && s.preview?.valid !== false ? { preview: { pose: { position: s.held.position, yaw: s.held.yaw }, valid: false, reason: 'terrain' } } : {}), targetId, lastReason };
  }
  function update(value) {
    frame = value;
    const s = controller.snapshot();
    if (s.paused !== frame.paused) controller.dispatch({ type: frame.paused ? 'pause' : 'resume' });
    if (s.held && !frame.paused) {
      const target = carryTarget(terrain, frame.position, frame.yaw, frame.pitch, original.size, s.held.yaw);
      if (target && (!lastTarget || ['x', 'y', 'z'].some(k => Math.abs(target[k] - lastTarget[k]) > 1e-8))) {
        const result = controller.dispatch({ type: 'move', position: target }, context()); lastReason = result.reason ?? null; lastTarget = target;
      }
      else if (!target) { lastReason = 'terrain'; lastTarget = null; }
    }
    paint();
    frame.camera.updateMatrixWorld(true);
    ray.near = 0; ray.far = Infinity; ray.setFromCamera({ x: 0, y: 0 }, frame.camera);
    targetId = !s.held && ray.intersectObject(mesh, false).length ? original.id : null;
    paint(); return snapshot();
  }
  function action(type) {
    if (!frame || frame.paused) { lastReason = 'paused'; return snapshot(); }
    const s = controller.snapshot();
    if (!frame.grounded) { lastReason = 'grounded'; return snapshot(); }
    let result;
    if (type === 'toggle') {
      if (s.held) {
        if (lastReason === 'terrain') return snapshot();
        result = controller.dispatch({ type: 'drop' }, context());
      } else if (targetId) {
        result = controller.dispatch({ type: 'select', id: targetId }, context());
        if (result.ok) { result = controller.dispatch({ type: 'grab' }, context()); lastTarget = null; }
      } else lastReason = 'aim';
    } else if (type === 'rotate' && s.held) result = controller.dispatch({ type: 'rotate', yaw: s.held.yaw + 90 }, context());
    else if (type === 'cancel' && s.held) {
      if (overlaps(objectBounds(s.objects[0]), context().player)) { lastReason = 'overlap'; return snapshot(); }
      result = controller.dispatch({ type: 'cancel' });
    }
    if (result) lastReason = result.reason ?? null;
    paint(); return snapshot();
  }
  function reset() { controller.dispatch({ type: 'reset' }); targetId = null; lastReason = null; lastTarget = null; paint(); return snapshot(); }
  paint();
  return { root, update, action, reset, snapshot };
}
