// Naru's authored palm centers relative to hand bones (model.mjs palm/hand anchors).
// Rotations and arm lengths are solved from the live rig, not animation constants.
export function createFlightPose(THREE, character, targets) {
  const arms = [['left', 'L', 1], ['right', 'R', -1]].map(([side, suffix, sign]) => {
    const bones = ['upperArm_', 'forearm_', 'hand_'].map(prefix => character.getObjectByName(prefix + suffix));
    if (bones.some(bone => !bone?.isBone)) throw new Error(`Missing ${side} arm rig`);
    return { side, sign, bones, palm: new THREE.Vector3(sign * .012, -.033, .004) };
  });
  let saved = null;
  function restore() {
    if (!saved) return;
    for (const [bone, quaternion] of saved) bone.quaternion.copy(quaternion);
    saved = null; character.updateMatrixWorld(true);
  }
  function aim(bone, localAxis, worldAxis) {
    const desired = new THREE.Quaternion().setFromUnitVectors(localAxis.clone().normalize(), worldAxis.clone().normalize());
    const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parent.invert().multiply(desired));
    character.updateMatrixWorld(true);
  }
  return { restore,
    apply() {
      restore(); character.updateMatrixWorld(true);
      saved = arms.flatMap(arm => arm.bones.map(bone => [bone, bone.quaternion.clone()]));
      const rootRotation = character.getWorldQuaternion(new THREE.Quaternion());
      const errors = {};
      for (const { side, sign, bones: [upper, fore, hand], palm } of arms) {
        targets[side].updateWorldMatrix(true, false);
        const target = targets[side].getWorldPosition(new THREE.Vector3());
        const wrist = target.clone().sub(palm.clone().applyQuaternion(rootRotation));
        const shoulder = upper.getWorldPosition(new THREE.Vector3());
        const first = fore.getWorldPosition(new THREE.Vector3()).distanceTo(shoulder);
        const second = hand.getWorldPosition(new THREE.Vector3()).distanceTo(fore.getWorldPosition(new THREE.Vector3()));
        const delta = wrist.clone().sub(shoulder), distance = delta.length();
        if (distance >= first + second || distance <= Math.abs(first - second)) throw new Error(`${side} sail grip out of reach`);
        const axis = delta.normalize();
        const pole = new THREE.Vector3(sign, 0, .5).applyQuaternion(rootRotation);
        pole.addScaledVector(axis, -pole.dot(axis)).normalize();
        const along = (first * first - second * second + distance * distance) / (2 * distance);
        const elbow = shoulder.clone().addScaledVector(axis, along).addScaledVector(pole, Math.sqrt(Math.max(0, first * first - along * along)));
        aim(upper, fore.position, elbow.clone().sub(shoulder));
        aim(fore, hand.position, wrist.clone().sub(elbow));
        const parentRotation = hand.parent.getWorldQuaternion(new THREE.Quaternion());
        hand.quaternion.copy(parentRotation.invert().multiply(rootRotation));
        character.updateMatrixWorld(true);
        errors[side] = hand.localToWorld(palm.clone()).distanceTo(target);
      }
      return errors;
    },
  };
}
