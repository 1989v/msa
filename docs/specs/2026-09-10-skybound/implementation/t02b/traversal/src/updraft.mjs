// One original Skybound meadow wind marker; physics receives this same definition.
export function insideUpdraft(volume, point) {
  return (point.x - volume.x) ** 2 + (point.z - volume.z) ** 2 <= volume.radius ** 2
    && point.y >= volume.minY && point.y < volume.maxY;
}

export function createUpdraft(THREE, col, source, terrain) {
  const { x, z, radius, minY, maxY, speed } = source;
  if (![x, z, radius, minY, maxY, speed].every(Number.isFinite)
    || radius <= .2 || maxY - minY <= .4 || speed < 0) throw new RangeError('Invalid visual wind cylinder');
  const volume = Object.freeze({ x, z, radius, minY, maxY, speed });
  const root = new THREE.Group(); root.name = 'meadow updraft';
  const boundary = [], ground = [];
  for (let i = 0; i < 64; i++) {
    for (const a of [i / 64 * Math.PI * 2, (i + 1) / 64 * Math.PI * 2]) {
      const px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
      boundary.push(px, minY, pz, px, maxY, pz);
      const floor = terrain.heightAt(px, pz);
      if (!Number.isFinite(floor)) throw new RangeError('Wind ground mark must lie on meadow');
      ground.push(px, floor + .035, pz);
    }
  }
  // Separate bottom/top rings: their extent is exactly the shared cylinder.
  const rings = [];
  for (let i = 0; i < boundary.length; i += 12) {
    rings.push(...boundary.slice(i, i + 3), ...boundary.slice(i + 6, i + 9),
      ...boundary.slice(i + 3, i + 6), ...boundary.slice(i + 9, i + 12));
  }
  function lines(name, positions, color, opacity) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: col(color), transparent: true, opacity, depthWrite: false }));
    mesh.name = name; root.add(mesh); return mesh;
  }
  lines('wind cylinder boundary', rings, 'cloud', .45);
  lines('wind ground mark', ground, 'brass', 1);
  const particles = new THREE.InstancedMesh(new THREE.ConeGeometry(.07, .28, 4),
    new THREE.MeshBasicMaterial({ color: col('cloud'), transparent: true, opacity: .7, depthWrite: false }), 48);
  particles.name = 'rising wind arrows'; particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particles.frustumCulled = false; root.add(particles);
  const scratch = new THREE.Object3D(), height = maxY - minY - .3;
  function update(time) {
    if (!Number.isFinite(time) || time < 0) throw new RangeError('Wind time must be finite and nonnegative');
    for (let i = 0; i < particles.count; i++) {
      const angle = i * 2.399963229728653, r = (radius - .1) * Math.sqrt((i + .5) / particles.count);
      const phase = (i * .618033988749895 + time * speed / height) % 1;
      scratch.position.set(x + Math.cos(angle) * r, minY + .15 + phase * height, z + Math.sin(angle) * r);
      scratch.updateMatrix(); particles.setMatrixAt(i, scratch.matrix);
    }
    particles.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { root, volume, update, stats: Object.freeze({ instances: 48, meshes: 1, lineObjects: 2, triangles: 384 }) };
}
