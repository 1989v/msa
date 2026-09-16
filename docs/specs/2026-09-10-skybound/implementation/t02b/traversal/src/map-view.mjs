import { mapPoint, MAP_AREAS } from '../../../t06a/src/exploration.mjs';

export function createMapView(canvas, terrain, col, locations, platforms) {
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas'); background.width = 420; background.height = 600;
  const base = background.getContext('2d');
  let prepared = null, area = MAP_AREAS.home;
  const point = position => mapPoint(position, area);
  function prepare(key) {
    area = MAP_AREAS[key] ?? MAP_AREAS.home;
    const scale = 420 / area.width, step = area.width / 35;
    base.fillStyle = col('sea').getStyle(); base.fillRect(0, 0, 420, 600);
    base.fillStyle = col('meadow').getStyle();
    for (let z = area.minZ; z < area.minZ + area.height; z += step) for (let x = area.minX; x < area.minX + area.width; x += step) {
      if (Number.isFinite(terrain.heightAt(x + step / 2, z + step / 2))) { const p = point({ x, z }); base.fillRect(p.x, p.y, 12, 12); }
    }
    base.fillStyle = col('chalk').getStyle();
    for (const platform of platforms) {
      const p = point({ x: platform.bounds.minX, z: platform.bounds.minZ });
      base.fillRect(p.x, p.y, (platform.bounds.maxX - platform.bounds.minX) * scale, (platform.bounds.maxZ - platform.bounds.minZ) * scale);
    }
    prepared = key;
  }
  function draw(position, yaw, discoveries, target, threats = [], areaKey = 'home') {
    if (prepared !== areaKey) prepare(areaKey);
    ctx.drawImage(background, 0, 0);
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    locations.forEach((location, index) => {
      if (!discoveries.includes(location.id)) return;
      const p = point(location.position);
      ctx.fillStyle = col('slate').getStyle(); ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col('cloud').getStyle(); ctx.fillText(String(index + 1), p.x, p.y + 5);
    });
    for (const threat of threats) {
      const p = point(threat.position);
      ctx.fillStyle = col('ochre').getStyle(); ctx.strokeStyle = col('slate').getStyle(); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x + 7, p.y); ctx.lineTo(p.x, p.y + 8); ctx.lineTo(p.x - 7, p.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const goal = point(target), player = point(position);
    ctx.strokeStyle = col('brass').getStyle(); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(goal.x, goal.y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(-yaw);
    ctx.fillStyle = col('cloud').getStyle(); ctx.strokeStyle = col('slate').getStyle(); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  return { draw };
}
