export const DISCOVERY_IDS = Object.freeze(['camp', 'stone', 'watch', 'wind', 'gate', 'overlook', 'ridge', 'west-survey', 'east-survey', 'north-survey', 'north-launch', 'relay-one', 'relay-two', 'relay-three', 'west-harbor', 'relay-four', 'relay-five', 'high-archive']);

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

export const MAP_AREAS = Object.freeze({
  home: Object.freeze({ minX: -35, minZ: -50, width: 70, height: 100 }),
  western: Object.freeze({ minX: -100, minZ: -145, width: 140, height: 200 }),
});
export function mapPoint(position, area = MAP_AREAS.home) {
  return { x: (position.x - area.minX) * 420 / area.width, y: (position.z - area.minZ) * 600 / area.height };
}
