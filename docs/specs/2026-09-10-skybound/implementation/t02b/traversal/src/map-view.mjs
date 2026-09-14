import { mapPoint } from '../../../t06a/src/exploration.mjs';

export function createMapView(canvas, terrain, col, locations, platforms) {
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas'); background.width = 420; background.height = 600;
  const base = background.getContext('2d');
  let prepared = false;
  function prepare() {
    base.fillStyle = col('sea').getStyle(); base.fillRect(0, 0, 420, 600);
    base.fillStyle = col('meadow').getStyle();
    for (let z = -50; z < 50; z += 2) for (let x = -35; x < 35; x += 2) {
      if (Number.isFinite(terrain.heightAt(x + 1, z + 1))) { const p = mapPoint({ x, z }); base.fillRect(p.x, p.y, 12, 12); }
    }
    base.fillStyle = col('chalk').getStyle();
    for (const platform of platforms) {
      const p = mapPoint({ x: platform.bounds.minX, z: platform.bounds.minZ });
      base.fillRect(p.x, p.y, (platform.bounds.maxX - platform.bounds.minX) * 6, (platform.bounds.maxZ - platform.bounds.minZ) * 6);
    }
    prepared = true;
  }
  function draw(position, yaw, discoveries, target) {
    if (!prepared) prepare();
    ctx.drawImage(background, 0, 0);
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    locations.forEach((location, index) => {
      if (!discoveries.includes(location.id)) return;
      const p = mapPoint(location.position);
      ctx.fillStyle = col('slate').getStyle(); ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col('cloud').getStyle(); ctx.fillText(String(index + 1), p.x, p.y + 5);
    });
    const goal = mapPoint(target), player = mapPoint(position);
    ctx.strokeStyle = col('brass').getStyle(); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(goal.x, goal.y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(-yaw);
    ctx.fillStyle = col('cloud').getStyle(); ctx.strokeStyle = col('slate').getStyle(); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  return { draw };
}
