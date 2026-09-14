const point = p => p && ['x', 'y', 'z'].every(k => Number.isFinite(p[k]));

// Position and device use feet coordinates; activation itself is the reward.
export function activateWatchRuin(progress, {
  defeated, position, device, grounded, blocked = false, paused = false,
  lineOfSight = () => true,
}) {
  if (progress.watchRuinActive === true || defeated !== true || grounded !== true || blocked || paused) return progress;
  if (!point(position) || !point(device)) return progress;
  if (Math.hypot(position.x - device.x, position.z - device.z) > 2 || Math.abs(position.y - device.y) > 1.2) return progress;
  if (lineOfSight(position, device) !== true) return progress;
  return { ...progress, watchRuinActive: true };
}
