import { createPlatform } from './platform.mjs';
import { createUpdraft } from './updraft.mjs';

export function createFinaleView(THREE, col, terrain) {
  const floor = terrain.heightAt(0, 24);
  if (!Number.isFinite(floor)) throw new Error('Wind gate needs meadow');
  const island = createPlatform(THREE, col, terrain, { x: 8, z: 24, topY: floor + 10, size: 5 });
  island.root.name = 'final overlook island';
  const wind = createUpdraft(THREE, col, { x: 0, z: 24, radius: 2, minY: floor - .2, maxY: floor + 18, speed: 6 }, terrain);
  const volume = { ...wind.volume, requiredProgress: ['stoneRuinActive', 'watchRuinActive', 'windRuinActive'] };
  const root = new THREE.Group(); root.name = 'central wind gate'; root.add(island.root, wind.root);
  const material = new THREE.MeshStandardMaterial({ color: col('slate'), roughness: .8 });
  for (const x of [-2.2, 2.2]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(.35, 3.4, .55), material);
    pillar.position.set(x, terrain.heightAt(x, 24) + 1.7, 24); root.add(pillar);
  }
  const seal = new THREE.Mesh(new THREE.TorusGeometry(1.35, .08, 6, 32), material);
  seal.position.set(0, floor + 2, 24); root.add(seal);
  return { root, island, volume, wind, update(open, complete, time) {
    wind.root.visible = open;
    material.color.copy(col(open ? 'brass' : 'slate'));
    seal.rotation.y = open ? Math.PI / 2 : 0;
    island.setComplete(complete);
    if (open) wind.update(time);
  } };
}
