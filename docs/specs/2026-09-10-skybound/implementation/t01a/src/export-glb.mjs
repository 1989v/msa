// Deliberately narrow exporter: static triangle meshes, vertex color, PBR materials.
// Excludes textures, skins and animation. All offsets are relative to one BIN chunk.
export function encodeGLB(root) {
  const document = {asset:{version:'2.0',generator:'Skybound original static-prop exporter v1'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
  const pieces=[]; let offset=0, triangles=0, vertices=0;
  const mats=new Map();
  function accessor(array,type,componentType,target,bounds=false) {
    const padding=(4-offset%4)%4;if(padding){pieces.push(Buffer.alloc(padding));offset+=padding;}
    const raw=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
    const view=document.bufferViews.push({buffer:0,byteOffset:offset,byteLength:raw.length,target})-1;
    pieces.push(raw);offset+=raw.length;
    const width={SCALAR:1,VEC3:3,VEC4:4}[type];
    const item={bufferView:view,componentType,count:array.length/width,type};
    if(bounds){item.min=Array(width).fill(Infinity);item.max=Array(width).fill(-Infinity);for(let i=0;i<array.length;i++){const k=i%width;item.min[k]=Math.min(item.min[k],array[i]);item.max[k]=Math.max(item.max[k],array[i]);}}
    return document.accessors.push(item)-1;
  }
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(Array.isArray(mesh.material))throw new Error('Multi-material geometry unsupported');
    const geom=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if(!geom.attributes.normal)geom.computeVertexNormals();
    const pos=geom.attributes.position;
    if(!pos||pos.count===0)throw new Error('Empty geometry');
    for(const value of pos.array)if(!Number.isFinite(value))throw new Error('Non-finite geometry');
    const attributes={POSITION:accessor(new Float32Array(pos.array),'VEC3',5126,34962,true),NORMAL:accessor(new Float32Array(geom.attributes.normal.array),'VEC3',5126,34962)};
    if(geom.attributes.color)attributes.COLOR_0=accessor(new Float32Array(geom.attributes.color.array),'VEC3',5126,34962);
    const indices=geom.index?new Uint32Array(geom.index.array):Uint32Array.from({length:pos.count},(_,i)=>i);
    if(indices.length%3!==0||indices.some(i=>i>=pos.count))throw new Error('Invalid triangle indices');
    const material=mesh.material;
    if(!mats.has(material)){
      const item={name:material.name,pbrMetallicRoughness:{baseColorFactor:[material.color.r,material.color.g,material.color.b,1],metallicFactor:material.metalness??0,roughnessFactor:material.roughness??1}};
      if(material.emissive){item.emissiveFactor=[material.emissive.r,material.emissive.g,material.emissive.b].map(v=>v*(material.emissiveIntensity??1));}
      mats.set(material,document.materials.push(item)-1);
    }
    const mi=document.meshes.push({name:mesh.name,primitives:[{attributes,indices:accessor(indices,'SCALAR',5125,34963),material:mats.get(material),mode:4}]})-1;
    document.scenes[0].nodes.push(document.nodes.push({name:mesh.name,mesh:mi})-1);
    triangles+=indices.length/3;vertices+=pos.count;geom.dispose();
  });
  const endPad=(4-offset%4)%4;if(endPad){pieces.push(Buffer.alloc(endPad));offset+=endPad;}
  document.buffers[0].byteLength=offset;
  const json=Buffer.from(JSON.stringify(document));const jsonChunk=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const binary=Buffer.concat(pieces);const total=12+8+jsonChunk.length+8+binary.length;
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);
  const jh=Buffer.alloc(8);jh.writeUInt32LE(jsonChunk.length,0);jh.writeUInt32LE(0x4e4f534a,4);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
  return {buffer:Buffer.concat([header,jh,jsonChunk,bh,binary]),stats:{triangles,vertices,meshes:document.meshes.length,materials:document.materials.length,bytes:total}};
}
