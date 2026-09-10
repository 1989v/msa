// Accept the actual indexed meadow/path mesh data, without a renderer dependency.
export function createTerrain(surfaces) {
  if (!Array.isArray(surfaces) || !surfaces.length) throw new TypeError('Terrain surfaces required');
  const triangles = [];
  for (const { positions, indices } of surfaces) {
    if (!positions?.length || positions.length % 3 || !indices?.length || indices.length % 3) throw new TypeError('Indexed triangles required');
    if (!Array.from(positions).every(Number.isFinite)) throw new TypeError('Finite terrain positions required');
    if (!Array.from(indices).every(i => Number.isInteger(i) && i >= 0 && i < positions.length / 3)) throw new TypeError('Invalid terrain index');
    for (let i = 0; i < indices.length; i += 3) {
      const vertices = Array.from(indices.slice(i, i + 3), index => Array.from(positions.slice(index * 3, index * 3 + 3)));
      const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] = vertices;
      const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(denominator) < 1e-10) continue; // center-ring degenerate triangles
      triangles.push({ ax, ay, az, bx, by, bz, cx, cy, cz, denominator,
        minX: Math.min(ax, bx, cx), maxX: Math.max(ax, bx, cx), minZ: Math.min(az, bz, cz), maxZ: Math.max(az, bz, cz) });
    }
  }
  if (!triangles.length) throw new TypeError('Terrain has no ground triangles');
  return Object.freeze({
    heightAt(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) throw new TypeError('Finite coordinates required');
      let height = null;
      for (const t of triangles) {
        if (x < t.minX - 1e-8 || x > t.maxX + 1e-8 || z < t.minZ - 1e-8 || z > t.maxZ + 1e-8) continue;
        const a = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) / t.denominator;
        const b = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) / t.denominator;
        const c = 1 - a - b;
        if (Math.min(a, b, c) >= -1e-8) height = Math.max(height ?? -Infinity, a * t.ay + b * t.by + c * t.cy);
      }
      return height;
    },
  });
}
