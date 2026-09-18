// Render-only camera boom clipping against the game's existing solid meshes.
export function createCameraObstruction(THREE, getMeshes) {
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(), right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), origin = new THREE.Vector3();
  const offsets = [[0, 0], [-.12, 0], [.12, 0], [0, -.12], [0, .12]];
  let previousDistance=null,previousRequest=null;
  const previousTarget=new THREE.Vector3();
  return {
    reset(){previousDistance=null;previousRequest=null;},
    resolve(target, desired, output, dt) {
      if (dt !== undefined && (!Number.isFinite(dt) || dt < 0)) throw new RangeError('Finite nonnegative camera time required');
      direction.subVectors(desired, target);
      const requested = direction.length();
      if (requested < .001) return output.copy(desired);
      direction.divideScalar(requested); right.crossVectors(direction, up).normalize();
      const meshes = getMeshes().filter(mesh => mesh.visible);
      for (const mesh of meshes) mesh.updateWorldMatrix(true, false);
      let distance = requested;
      for (const [horizontal, vertical] of offsets) {
        origin.copy(target).addScaledVector(right, horizontal).addScaledVector(up, vertical);
        ray.set(origin, direction); ray.near = .01; ray.far = requested;
        const hit = ray.intersectObjects(meshes, false)[0];
        if (hit) distance = Math.min(distance, Math.max(.15, hit.distance - .2));
      }
      const snap = dt === undefined || previousDistance === null || Math.abs(requested-previousRequest)>.001 || previousTarget.distanceTo(target)>3;
      if (!snap && distance > previousDistance) {
        distance = previousDistance + (distance-previousDistance) * (1-Math.exp(-8*Math.min(dt,.25)));
      }
      previousDistance=distance;previousRequest=requested;previousTarget.copy(target);
      return output.copy(target).addScaledVector(direction, distance);
    },
  };
}
