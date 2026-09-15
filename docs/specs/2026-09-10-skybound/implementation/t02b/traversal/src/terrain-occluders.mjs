// Ray queries use compact patches of the same triangles, never an alternate surface.
export function createTerrainOccluders(T, surfaces, size = 8) {
  const entries=[];
  for(const surface of surfaces){
    surface.updateWorldMatrix(true,false);
    const groups=new Map(),position=surface.geometry.attributes.position,index=surface.geometry.index;
    for(let i=0;i<index.count;i+=3){
      const points=[0,1,2].map(offset=>new T.Vector3().fromBufferAttribute(position,index.getX(i+offset)).applyMatrix4(surface.matrixWorld));
      const x=points.reduce((sum,p)=>sum+p.x,0)/3,z=points.reduce((sum,p)=>sum+p.z,0)/3;
      const key=`${Math.floor(x/size)},${Math.floor(z/size)}`;
      if(!groups.has(key))groups.set(key,[]);
      for(const point of points)groups.get(key).push(point.x,point.y,point.z);
    }
    for(const vertices of groups.values()){
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,surface.material);mesh.name=surface.name;
      entries.push({mesh,box:geometry.boundingBox});
    }
  }
  return {nearbyMeshes(x,z,radius){
    return entries.filter(({box})=>box.max.x>=x-radius&&box.min.x<=x+radius&&box.max.z>=z-radius&&box.min.z<=z+radius).map(entry=>entry.mesh);
  }};
}
