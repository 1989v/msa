export const DISCOVERY_IDS = Object.freeze(['camp', 'stone', 'watch', 'wind', 'gate', 'overlook', 'ridge']);

export function discoverLocations(progress, position, locations) {
  if (![position?.x, position?.y, position?.z].every(Number.isFinite)) throw new TypeError('Finite explorer position required');
  const found = new Set(progress.discoveries ?? []);
  const before = found.size;
  for (const location of locations) {
    if (DISCOVERY_IDS.includes(location.id) && Math.hypot(position.x - location.position.x, position.z - location.position.z) <= 6
      && Math.abs(position.y - location.position.y) <= 4) found.add(location.id);
  }
  return found.size === before ? progress : { ...progress, discoveries: DISCOVERY_IDS.filter(id => found.has(id)) };
}

export function mapPoint(position) {
  return { x: (position.x + 35) * 6, y: (position.z + 50) * 6 };
}
