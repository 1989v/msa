import { CHARGE, createCharger } from '../../../t05b/src/charger.mjs';
import { createTarget } from '../../../t05a/src/target.mjs';
import { segmentHitsBox } from '../../../t04a/src/manipulation.mjs';

export function createChargerView(THREE, col, terrain, lineOfSight, blockingMeshes) {
  const home = { x: -4.5, y: terrain.heightAt(-4.5, 25), z: 25 };
  if (!Number.isFinite(home.y)) throw new Error('Charger needs meadow');
  const root = new THREE.Group(); root.name = 'slow ridge charger';
  const material = new THREE.MeshStandardMaterial({ color: col('slate'), roughness: 1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1), material); body.position.y = .55; body.castShadow = true; root.add(body);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(.8, .12, .08), new THREE.MeshStandardMaterial({ color: col('ochre'), roughness: .8 }));
  crest.position.set(0, .12, .54); body.add(crest);
  const warningGeometry = new THREE.BufferGeometry(); warningGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(21 * 3), 3));
  const warning = new THREE.Line(warningGeometry, new THREE.LineBasicMaterial({ color: col('ochre') }));
  warning.frustumCulled = false; root.add(warning);
  const laneGeometry = new THREE.BufferGeometry();
  laneGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(84 * 3), 3));
  const lane = new THREE.LineSegments(laneGeometry, warning.material);
  lane.name = 'charger danger lane'; lane.frustumCulled = false; root.add(lane);
  const box = new THREE.Box3();
  const controller = createCharger({ home, terrain, lineOfSight: (from, to) => lineOfSight({ ...from, y: from.y + .7 }, { ...to, y: to.y + 1.2 }), canMove(from, to) {
    for (const mesh of blockingMeshes()) {
      if (mesh.name === 'continuous meadow' || mesh.name.startsWith('walkable-looking')) continue;
      mesh.updateWorldMatrix(true, false); box.setFromObject(mesh);
      const bounds = { min: { x: box.min.x - .6, y: box.min.y - .55, z: box.min.z - .6 }, max: { x: box.max.x + .6, y: box.max.y + .55, z: box.max.z + .6 } };
      if (segmentHitsBox({ ...from, y: from.y + .55 }, { ...to, y: to.y + .55 }, bounds)) return false;
    }
    return true;
  } });
  const combat = createTarget({ position: { ...home, y: home.y + .65 }, lineOfSight });
  function move(state) {
    root.position.copy(state.position); body.rotation.y = Math.atan2(state.direction.x, state.direction.z);
    combat.setPosition({ ...state.position, y: state.position.y + .65 });
  }
  function paint(state) {
    const defeated = combat.snapshot().defeated;
    const preparation = state.phase === 'windup' ? Math.max(0, Math.min(1, 1 - state.remaining / CHARGE.windup)) : 0;
    body.scale.y = defeated ? .4 : state.phase === 'recovery' ? .82 : 1 - preparation * .18; body.position.y = .55 * body.scale.y;
    body.rotation.x = defeated ? 0 : state.phase === 'charge' ? .2 : -.18 * preparation;
    material.color.copy(col(defeated ? 'chalkShade' : combat.snapshot().hitAge < .2 ? 'ochre' : 'slate'));
    warning.visible = !defeated && state.phase === 'windup';
    lane.visible = warning.visible;
    if (warning.visible) {
      const length = CHARGE.speed * CHARGE.duration;
      const pointAt = (attribute, index, forward, side = 0) => {
        const x = state.position.x + state.direction.x * forward + state.direction.z * side;
        const z = state.position.z + state.direction.z * forward - state.direction.x * side;
        const floor = terrain.heightAt(x, z);
        attribute.setXYZ(index, x - state.position.x, (Number.isFinite(floor) ? floor : state.position.y) + .05 - state.position.y, z - state.position.z);
      };
      for (let i = 0; i <= 20; i++) {
        pointAt(warningGeometry.attributes.position, i, length * i / 20);
      }
      let vertex = 0;
      for (const side of [-.75, .75]) for (let i = 0; i < 20; i++) {
        pointAt(laneGeometry.attributes.position, vertex++, length * i / 20, side);
        pointAt(laneGeometry.attributes.position, vertex++, length * (i + 1) / 20, side);
      }
      for (const side of [-.5, .5]) {
        pointAt(laneGeometry.attributes.position, vertex++, length - .6, side);
        pointAt(laneGeometry.attributes.position, vertex++, length);
      }
      laneGeometry.attributes.position.needsUpdate = true;
      warningGeometry.attributes.position.needsUpdate = true;
    }
  }
  function resetMotion() { const state = controller.reset(); move(state); paint(state); combat.cancelSwing(); return state; }
  resetMotion();
  return { root, controller, combat, move, paint, resetMotion, reset() { combat.reset(); return resetMotion(); } };
}
