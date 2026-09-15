// Render-only camera boom clipping against the game's existing solid meshes.
export function createCameraObstruction(THREE, getMeshes) {
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(), right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), origin = new THREE.Vector3();
  const offsets = [[0, 0], [-.12, 0], [.12, 0], [0, -.12], [0, .12]];
  return {
    resolve(target, desired, output) {
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
      return output.copy(target).addScaledVector(direction, distance);
    },
  };
}
