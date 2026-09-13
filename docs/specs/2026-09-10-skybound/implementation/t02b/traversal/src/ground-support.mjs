// Approximate support: nine rotated footprint samples, not continuous surface coverage.
export function sampleGroundSupport(terrain, object, at = object) {
  const size = object?.size, p = at?.position, yaw = at?.yaw ?? 0;
  if (typeof terrain?.heightAt !== 'function' || !size || !p
    || !['x', 'y', 'z'].every(k => Number.isFinite(size[k]) && size[k] > 0 && Number.isFinite(p[k]))
    || !Number.isFinite(yaw) || yaw % 90 !== 0) throw new TypeError('Finite box pose and quarter-turn yaw required');
  const angle = yaw * Math.PI / 180, c = Math.round(Math.cos(angle)), s = Math.round(Math.sin(angle));
  let low = Infinity, high = -Infinity;
  for (const u of [-.5, 0, .5]) for (const v of [-.5, 0, .5]) {
    const dx = u * size.x, dz = v * size.z;
    const y = terrain.heightAt(p.x + c * dx + s * dz, p.z - s * dx + c * dz);
    if (!Number.isFinite(y)) return { pose: at, reason: 'terrain' };
    low = Math.min(low, y); high = Math.max(high, y);
  }
  if (high - low > .2 + 1e-9) return { pose: at, reason: 'terrain' };
  return { pose: { position: { ...p, y: high + size.y / 2 }, yaw }, reason: null };
}
