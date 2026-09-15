import { CHARGE, createCharger } from '../../../t05b/src/charger.mjs';
import { createTarget } from '../../../t05a/src/target.mjs';
import { segmentHitsBox } from '../../../t04a/src/manipulation.mjs';
import { createEnemyHealthView } from './enemy-health-view.mjs';

export function createChargerView(THREE, col, terrain, lineOfSight, blockingMeshes) {
  const home = { x: -4.5, y: terrain.heightAt(-4.5, 25), z: 25 };
  if (!Number.isFinite(home.y)) throw new Error('Charger needs meadow');
  const root = new THREE.Group(); root.name = 'slow ridge charger';
  const healthView = createEnemyHealthView(THREE, col, 1.5); root.add(healthView.root);
  const material = new THREE.MeshStandardMaterial({ color: col('slate'), roughness: 1 });
  const profile = new THREE.Shape();
  profile.moveTo(-.52, -.47); profile.lineTo(.52, -.47); profile.lineTo(.52, .47); profile.lineTo(-.52, .47); profile.closePath();
  const shell = new THREE.ExtrudeGeometry(profile, { depth: .84, steps: 1, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 1 });
  shell.translate(0, 0, -.42);
  const body = new THREE.Mesh(shell, material); body.position.y = .55; body.castShadow = true; root.add(body);
  const trim = new THREE.MeshStandardMaterial({ color: col('chalkShade'), roughness: .95 });
  for (const side of [-1, 1]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(.12, .58, .75), trim); brace.position.set(side * .55, -.05, 0); brace.castShadow = true; body.add(brace);
    const runner = new THREE.Mesh(new THREE.BoxGeometry(.14, .12, 1.05), trim); runner.position.set(side * .4, -.48, 0); body.add(runner);
  }
  const rotor = new THREE.Group(); rotor.position.set(0, .12, .545); body.add(rotor);
  const brass = new THREE.MeshStandardMaterial({ color: col('brass'), roughness: .7 });
  rotor.add(new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 6, 16), brass));
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.055, .19, .04), brass);
    const angle = i * Math.PI * 2 / 3; blade.position.set(Math.sin(angle) * .085, Math.cos(angle) * .085, 0); blade.rotation.z = -angle; rotor.add(blade);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(.08, .12, .045), trim); vent.position.set((i - 1) * .18, -.27, .52); body.add(vent);
  }
  const warningGeometry = new THREE.BufferGeometry(); warningGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(21 * 3), 3));
  const warning = new THREE.Line(warningGeometry, new THREE.LineBasicMaterial({ color: col('ochre') }));
  warning.frustumCulled = false; root.add(warning);
  const laneGeometry = new THREE.BufferGeometry();
  laneGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(243 * 3), 3));
  const lane = new THREE.Mesh(laneGeometry, new THREE.MeshBasicMaterial({ color: col('ochre'), side: THREE.DoubleSide }));
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
    healthView.update(combat.snapshot().hp);
    const defeated = combat.snapshot().defeated;
    const preparation = state.phase === 'windup' ? Math.max(0, Math.min(1, 1 - state.remaining / CHARGE.windup)) : 0;
    body.scale.y = defeated ? .4 : state.phase === 'recovery' ? .82 : 1 - preparation * .18; body.position.y = .55 * body.scale.y;
    body.rotation.x = defeated ? 0 : state.phase === 'charge' ? .2 : -.18 * preparation;
    rotor.rotation.z = state.phase === 'windup' ? preparation * Math.PI / 3
      : state.phase === 'charge' ? Math.PI / 3 + (1 - state.remaining / CHARGE.duration) * Math.PI * 2
      : state.phase === 'recovery' ? state.remaining / CHARGE.recovery * Math.PI / 3 : 0;
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
        const from = length * i / 20, to = length * (i + 1) / 20;
        for (const [forward, across] of [[from, side - .035], [to, side - .035], [to, side + .035], [from, side - .035], [to, side + .035], [from, side + .035]]) {
          pointAt(laneGeometry.attributes.position, vertex++, forward, across);
        }
      }
      pointAt(laneGeometry.attributes.position, vertex++, length - .6, -.4);
      pointAt(laneGeometry.attributes.position, vertex++, length);
      pointAt(laneGeometry.attributes.position, vertex++, length - .6, .4);
      laneGeometry.attributes.position.needsUpdate = true;
      warningGeometry.attributes.position.needsUpdate = true;
    }
  }
  function resetMotion() { const state = controller.reset(); move(state); paint(state); combat.cancelSwing(); return state; }
  resetMotion();
  return { root, controller, combat, move, paint, resetMotion, healthView, reset() { combat.reset(); return resetMotion(); } };
}
