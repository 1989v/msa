import { segmentHitsBox } from '../../../t04a/src/manipulation.mjs';

// Live committed objects extend support and horizontal collision, never safe checkpoints.
export function createSolidTerrain(base, getSolids) {
  return {
    heightAt: (x, z) => base.heightAt(x, z),
    supportHeightAt(x, z, feetY) {
      let floor = base.supportHeightAt ? base.supportHeightAt(x, z, feetY) : base.heightAt(x, z);
      for (const box of getSolids()) {
        if (feetY >= box.max.y - 1e-8 && x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) floor = Math.max(floor ?? -Infinity, box.max.y);
      }
      return floor;
    },
    ceilingHeightAt(x, z, headY, rise) {
      let ceiling = base.ceilingHeightAt?.(x, z, headY, rise) ?? null;
      for (const box of getSolids()) {
        if (box.min.y >= headY - 1e-6 && box.min.y <= headY + rise && x >= box.min.x - .22 && x <= box.max.x + .22 && z >= box.min.z - .22 && z <= box.max.z + .22) ceiling = Math.min(ceiling ?? Infinity, box.min.y);
      }
      return ceiling;
    },
    canMove(from, to) {
      if (base.canMove && !base.canMove(from, to)) return false;
      return getSolids().every(box => !segmentHitsBox(from, to, {
        min: { x: box.min.x - .3, y: box.min.y - 1.68, z: box.min.z - .3 },
        max: { x: box.max.x + .3, y: box.max.y, z: box.max.z + .3 },
      }));
    },
  };
}
