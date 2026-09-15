// Three discrete health pips, facing the camera; no combat state is owned here.
export function createEnemyHealthView(THREE, col, height) {
  const root = new THREE.Group(); root.name = 'guardian health'; root.position.y = height;
  const backing = new THREE.MeshBasicMaterial({ color: col('slate'), depthWrite: false });
  const filled = new THREE.MeshBasicMaterial({ color: col('brass'), depthWrite: false });
  const rim = new THREE.CircleGeometry(.095, 12), dot = new THREE.CircleGeometry(.06, 12);
  const pips = [];
  for (let i = 0; i < 3; i++) {
    const border = new THREE.Mesh(rim, backing); border.position.x = (i - 1) * .24;
    const pip = new THREE.Mesh(dot, filled); pip.position.z = .005; border.add(pip);
    root.add(border); pips.push(pip);
  }
  return {
    root,
    update(hp) { root.visible = hp > 0; pips.forEach((pip, i) => { pip.visible = i < hp; }); },
    faceCamera(camera) { root.quaternion.copy(camera.quaternion); },
  };
}
