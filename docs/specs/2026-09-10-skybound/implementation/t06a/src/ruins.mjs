const point = value => value && ['x', 'y', 'z'].every(key => Number.isFinite(value[key]));

// Both points use feet coordinates on the upper landing platform.
export function activateWindRuin(progress, {
  position, device, grounded, onPlatform, paused = false, blocked = false,
}) {
  if (progress.windRuinActive === true || progress.firstAerialLanding !== true || progress.secondAerialLanding !== true) return progress;
  if (grounded !== true || onPlatform !== true || paused || blocked) return progress;
  if (!point(position) || !point(device)) return progress;
  if (Math.hypot(position.x - device.x, position.z - device.z) > 1.5 || Math.abs(position.y - device.y) > 0.1) return progress;
  return { ...progress, windRuinActive: true };
}

export function ruinSnapshot(progress) {
  const stone = progress.stoneRuinActive === true;
  const watch = progress.watchRuinActive === true;
  const wind = progress.windRuinActive === true && progress.firstAerialLanding === true && progress.secondAerialLanding === true;
  const count = Number(stone) + Number(watch) + Number(wind);
  return { stone, watch, wind, count, complete: count === 3 };
}
