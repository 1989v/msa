// Static rendered geometry supplies support and body sweeps. Foliage stays permeable.
export function createSceneryTerrain(T, base, worldRoot) {
  const names = new Set(['tree trunk', 'exposed shoulder outcrop', 'weathered limestone fragments',
    'shrine circular terrace', 'approach stair', 'ruined beacon courses', 'jointed wind meridian']);
  const cells = new Map(), cellSize = 4;
  const matrix = new T.Matrix4();
  const add = mesh => {
    mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
    const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    const entry = { mesh, box };
    for (let x = Math.floor(box.min.x / cellSize); x <= Math.floor(box.max.x / cellSize); x++) {
      for (let z = Math.floor(box.min.z / cellSize); z <= Math.floor(box.max.z / cellSize); z++) {
        const key = `${x},${z}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(entry);
      }
    }
  };
  worldRoot.updateMatrixWorld(true);
  worldRoot.traverse(mesh => {
    if (!mesh.isMesh || !names.has(mesh.name)) return;
    if (!mesh.isInstancedMesh) { add(mesh); return; }
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const proxy = new T.Mesh(mesh.geometry, mesh.material);
      proxy.matrixAutoUpdate = false; proxy.matrix.copy(mesh.matrixWorld).multiply(matrix);
      proxy.matrixWorld.copy(proxy.matrix); proxy.name = `${mesh.name} ${i}`; add(proxy);
    }
  });
  function nearby(x, z, radius = 0) {
    const found = new Set();
    for (let cx = Math.floor((x - radius) / cellSize); cx <= Math.floor((x + radius) / cellSize); cx++) {
      for (let cz = Math.floor((z - radius) / cellSize); cz <= Math.floor((z + radius) / cellSize); cz++) {
        for (const entry of cells.get(`${cx},${cz}`) ?? []) {
          if (entry.box.max.x >= x-radius && entry.box.min.x <= x+radius && entry.box.max.z >= z-radius && entry.box.min.z <= z+radius) found.add(entry);
        }
      }
    }
    return [...found];
  }
  const ray = new T.Raycaster(), origin = new T.Vector3(), down = new T.Vector3(0,-1,0), up = new T.Vector3(0,1,0), direction = new T.Vector3();
  const normal = new T.Vector3(), normalMatrix = new T.Matrix3();
  const terrain = {
    heightAt: (x,z) => base.heightAt(x,z),
    supportHeightAt(x,z,feetY) {
      let floor = base.supportHeightAt ? base.supportHeightAt(x,z,feetY) : base.heightAt(x,z);
      origin.set(x,feetY+.5,z); ray.set(origin,down); ray.near=0; ray.far=Infinity;
      for (const {mesh,box} of nearby(x,z)) {
        if (box.min.y > feetY+.5 || box.max.y < (floor ?? -Infinity)) continue;
        const hit = ray.intersectObject(mesh,false)[0];
        if (!hit) continue;
        normalMatrix.getNormalMatrix(mesh.matrixWorld); normal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();
        if (normal.y >= .55) floor = Math.max(floor ?? -Infinity,hit.point.y);
      }
      return floor;
    },
    ceilingHeightAt(x,z,headY,rise) {
      let ceiling = base.ceilingHeightAt?.(x,z,headY,rise) ?? null;
      const entries = nearby(x,z,.22).filter(({box})=>box.max.y >= headY && box.min.y <= headY + rise);
      if (!entries.length) return ceiling;
      ray.near=0; ray.far=rise+.001;
      for (const [dx,dz] of [[0,0],[-.22,0],[.22,0],[0,-.22],[0,.22]]) {
        origin.set(x+dx,headY-.001,z+dz);ray.set(origin,up);
        for (const {mesh} of entries) {
          const hit=ray.intersectObject(mesh,false)[0];
          if (hit && hit.point.y >= headY - 1e-6) ceiling=Math.min(ceiling ?? Infinity,hit.point.y);
        }
      }
      return ceiling;
    },
    canMove(from,to) {
      if (base.canMove && !base.canMove(from,to)) return false;
      direction.set(to.x-from.x,0,to.z-from.z); const length=direction.length();
      if (length < 1e-9) return true;
      direction.divideScalar(length);
      const entries=nearby((from.x+to.x)/2,(from.z+to.z)/2,length/2+.35)
        .filter(({box})=>box.max.y>from.y+.5 && box.min.y<from.y+1.68);
      if (!entries.length) return true;
      ray.near=0; ray.far=length+.3;
      for (const height of [.51,1.05,1.6]) for (const side of [-.22,0,.22]) {
        origin.set(from.x+direction.z*side,from.y+height,from.z-direction.x*side); ray.set(origin,direction);
        for (const {mesh} of entries) if (ray.intersectObject(mesh,false).length) return false;
      }
      return true;
    },
  };
  return { terrain, nearbyMeshes: (x,z,radius) => nearby(x,z,radius).map(entry=>entry.mesh) };
}
