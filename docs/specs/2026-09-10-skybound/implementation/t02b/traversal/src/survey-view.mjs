// Original optional landmarks: no ruin or ending gates.
export function createSurveyView(T, col, terrain) {
  const root = new T.Group(); root.name = 'old wind survey stones';
  const locations = [], solidBounds = [], meshes = [], needles = [];
  const stone = new T.MeshStandardMaterial({ color: col('chalk'), roughness: .92 });
  const brass = new T.MeshStandardMaterial({ color: col('brass'), metalness: .55, roughness: .45 });
  for (const [id, label, x, z] of [
    ['west-survey', '서쪽 바람눈', -12, 0],
    ['east-survey', '동쪽 물결 표석', 12, -15],
    ['north-survey', '북단 귀환 표석', 0, -42],
  ]) {
    const heights = [-.65, .65].flatMap(dx => [-.65, .65].map(dz => terrain.heightAt(x + dx, z + dz)));
    if (!heights.every(Number.isFinite)) throw new Error(`Survey stone needs ground: ${id}`);
    const y = Math.max(...heights);
    locations.push({ id, label, position: { x, y, z } });
    const marker = new T.Group(); marker.position.set(x, y, z); root.add(marker);
    const body = new T.Mesh(new T.BoxGeometry(.8, 1.35, .8), stone);
    body.position.y = .575; body.castShadow = true; body.receiveShadow = true; marker.add(body); meshes.push(body);
    const ring = new T.Mesh(new T.TorusGeometry(.52, .055, 6, 24), brass);
    ring.position.y = 1.65; marker.add(ring);
    const needle = new T.Mesh(new T.BoxGeometry(.07, .65, .07), brass);
    needle.position.y = 1.65; needle.rotation.z = -.65; marker.add(needle); needles.push({ id, needle });
    solidBounds.push({ min: { x: x - .4, y: y - .1, z: z - .4 }, max: { x: x + .4, y: y + 1.25, z: z + .4 } });
  }
  root.updateMatrixWorld(true);
  return { root, locations, solidBounds, meshes, update(discoveries = []) {
    for (const { id, needle } of needles) needle.rotation.z = discoveries.includes(id) ? 0 : -.65;
  } };
}
