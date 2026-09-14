export function createWindAltarView(THREE, col, platform) {
  const root = new THREE.Group(); root.name = 'wind tower summit altar'; root.position.copy(platform.center);
  const material = new THREE.MeshStandardMaterial({ color: col('brass'), roughness: .55 });
  // Open arcs leave the landing centre clear and distinguish this altar from the watch device.
  for (const side of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(.8, .045, 6, 24, Math.PI), material);
    arc.rotation.z = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    arc.position.set(side * .3, .85, 0); root.add(arc);
  }
  return { root, position: platform.center, update(active) {
    material.color.copy(col(active ? 'meadow' : 'brass'));
    root.children.forEach(arc => { arc.position.y = active ? 1.1 : .85; });
  } };
}
