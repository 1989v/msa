// Original technical sail based only on Skybound's ochre triangular sail brief.
export function createGlider(THREE, color) {
  const root = new THREE.Group(); root.name = 'Naru technical wind sail'; root.visible = false;
  const cloth = new THREE.MeshStandardMaterial({ color: color('ochre'), side: THREE.DoubleSide, roughness: .95 });
  const frame = new THREE.MeshStandardMaterial({ color: color('slate'), roughness: .9 });
  const brass = new THREE.MeshStandardMaterial({ color: color('brass'), roughness: .6, metalness: .25 });
  const nose = [0, 2.48, .92], left = [-1.35, 2.2, -.68], right = [1.35, 2.2, -.68], tail = [0, 2.35, -.45];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...nose, ...left, ...tail, ...right], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
  root.add(new THREE.Mesh(geometry, cloth));
  function spar(a, b, radius, material = frame) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), material);
    mesh.position.copy(from).add(to).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); root.add(mesh);
  }
  spar(nose, left, .018); spar(nose, right, .018); spar(nose, tail, .022);
  const gripL = [-.42, 1.93, .12], gripR = [.42, 1.93, .12];
  spar(left, gripL, .012, brass); spar(right, gripR, .012, brass); spar(gripL, gripR, .025);
  let triangles = 0;
  root.traverse(object => { if (object.isMesh) { object.castShadow = true; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; } });
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  return { root, stats: { triangles, meshes: root.children.length, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, technicalPose: true } };
}
