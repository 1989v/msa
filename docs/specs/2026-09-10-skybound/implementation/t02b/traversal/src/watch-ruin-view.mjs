export function createWatchRuinView(THREE, col, terrain) {
  const position = Object.freeze({ x: 5.8, y: terrain.heightAt(5.8, 32), z: 32 });
  if (!Number.isFinite(position.y)) throw new Error('Watch ruin device needs meadow');
  const root = new THREE.Group(); root.name = 'watch ruin activation device'; root.position.copy(position);
  const material = new THREE.MeshStandardMaterial({ color: col('slate'), roughness: .8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.5, .65, .22, 8), material);
  base.position.y = .11; root.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.38, .055, 8, 24), new THREE.MeshStandardMaterial({ color: col('brass'), roughness: .5 }));
  ring.position.y = .85; root.add(ring);
  function update({ active, defeated }) {
    ring.material.color.copy(col(active ? 'meadow' : defeated ? 'brass' : 'slate'));
    ring.rotation.x = active ? -Math.PI / 2 : 0;
    ring.position.y = active ? 1.25 : .85;
  }
  return { root, position, update };
}
