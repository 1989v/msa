import { createTerrain } from '../../../t02a/src/terrain.mjs';

// Original small chalk landing stone. Only the visible top's actual triangles collide.
export function createPlatform(THREE, col, baseTerrain, { x = 8, z = 30, topY, size = 4 } = {}) {
  if (![x, z, topY, size].every(Number.isFinite) || size <= 0) throw new RangeError('Finite positive platform dimensions required');
  const half = size / 2, root = new THREE.Group(); root.name = 'first aerial landing stone';
  const positions = [x-half, topY, z-half, x-half, topY, z+half, x+half, topY, z+half, x+half, topY, z-half];
  const indices = [0, 1, 2, 0, 2, 3];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const top = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: col('chalk'), roughness: 1 }));
  top.name = 'one-way landing top'; top.receiveShadow = true; top.castShadow = true; root.add(top);
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(size * .5, size * .28, .7, 4, 1, false, Math.PI / 4),
    new THREE.MeshStandardMaterial({ color: col('chalkShade'), roughness: 1 }));
  stone.position.set(x, topY - .36, z); stone.castShadow = true; root.add(stone);
  const mark = new THREE.Mesh(new THREE.RingGeometry(.4, .5, 24), new THREE.MeshBasicMaterial({ color: col('brass'), side: THREE.DoubleSide }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(x, topY + .005, z); root.add(mark);
  const collision = createTerrain([{ positions: geometry.attributes.position.array, indices: geometry.index.array }]);
  const actualTop = collision.heightAt(x, z);
  const terrain = Object.freeze({
    heightAt: (px, pz) => baseTerrain.heightAt(px, pz),
    supportHeightAt(px, pz, feetY) {
      if (!Number.isFinite(feetY)) throw new TypeError('Finite previous feet required');
      const ground = baseTerrain.heightAt(px, pz), pad = collision.heightAt(px, pz);
      return pad !== null && pad <= feetY + 1e-8 ? Math.max(ground ?? -Infinity, pad) : ground;
    },
  });
  const bounds = Object.freeze({ minX: x-half, maxX: x+half, minZ: z-half, maxZ: z+half });
  return { root, terrain, topY: actualTop, bounds, center: Object.freeze({ x, y: actualTop, z }),
    supports: position => collision.heightAt(position.x, position.z) !== null && Math.abs(position.y - actualTop) < 1e-6 };
}
