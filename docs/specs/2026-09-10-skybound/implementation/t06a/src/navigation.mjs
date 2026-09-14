export function suggestedDestination(progress) {
  if (progress.journeyComplete) return 'camp';
  if (!progress.stoneRuinActive) return 'stone';
  if (!progress.watchRuinActive) return 'watch';
  if (!progress.windRuinActive) return 'wind';
  return 'gate';
}

// Bearings use the camera view, not the character's last movement heading.
export function destinationBearing(position, target, cameraYaw) {
  if (![position?.x, position?.y, position?.z, target?.x, target?.y, target?.z, cameraYaw].every(Number.isFinite)) throw new TypeError('Finite navigation positions and yaw required');
  const dx = target.x - position.x, dz = target.z - position.z;
  const distance = Math.hypot(dx, dz), height = target.y - position.y;
  const forward = -dx * Math.sin(cameraYaw) - dz * Math.cos(cameraYaw);
  const right = dx * Math.cos(cameraYaw) - dz * Math.sin(cameraYaw);
  const sector = (Math.round(Math.atan2(right, forward) / (Math.PI / 4)) + 8) % 8;
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const labels = ['앞', '오른쪽 앞', '오른쪽', '오른쪽 뒤', '뒤', '왼쪽 뒤', '왼쪽', '왼쪽 앞'];
  return { distance, height, arrow: distance < .5 ? '●' : arrows[sector], direction: distance < .5 ? '바로 이곳' : labels[sector], elevation: height > 1.5 ? '위쪽' : height < -1.5 ? '아래쪽' : '비슷한 높이' };
}
