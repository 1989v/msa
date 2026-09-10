import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { THREE, dependencyRoot } from '../build.mjs';
import { createShrine } from '../src/model.mjs';
import { encodeGLB } from '../src/export-glb.mjs';
const disk=await readFile(new URL('../assets/wind-shrine.glb',import.meta.url));
function parse(buffer){
 assert.equal(buffer.readUInt32LE(0),0x46546c67);assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.readUInt32LE(8),buffer.length);
 const jl=buffer.readUInt32LE(12);assert.equal(jl%4,0);assert.equal(buffer.readUInt32LE(16),0x4e4f534a);
 const document=JSON.parse(buffer.subarray(20,20+jl).toString());const off=20+jl;
 assert.equal(buffer.readUInt32LE(off+4),0x004e4942);const bin=buffer.subarray(off+8);assert.equal(buffer.readUInt32LE(off),bin.length);
 return {document,bin};
}
test('artifact is deterministic and matches authored source',()=>{
 assert.deepEqual(encodeGLB(createShrine(THREE)).buffer,disk);
});
test('all GLB buffer views/accessors stay aligned, bounded and finite',()=>{
 const {document:d,bin}=parse(disk);assert.equal(d.buffers[0].byteLength,bin.length);
 const widths={SCALAR:1,VEC3:3,VEC4:4};
 for(const v of d.bufferViews){assert.equal(v.byteOffset%4,0);assert.ok(v.byteOffset+v.byteLength<=bin.length);}
 for(const a of d.accessors){const v=d.bufferViews[a.bufferView];assert.ok(a.count*widths[a.type]*4<=v.byteLength);assert.ok([5125,5126].includes(a.componentType));if(a.componentType===5126){for(let p=v.byteOffset;p<v.byteOffset+v.byteLength;p+=4)assert.ok(Number.isFinite(bin.readFloatLE(p)));}}
 for(const mesh of d.meshes)for(const p of mesh.primitives){const a=d.accessors[p.indices],v=d.bufferViews[a.bufferView],count=d.accessors[p.attributes.POSITION].count;assert.equal(a.count%3,0);for(let i=0;i<a.count;i++)assert.ok(bin.readUInt32LE(v.byteOffset+i*4)<count);}
});
test('Three GLTFLoader reloads actual exported artifact with matching geometry bounds and materials',async()=>{
 const {GLTFLoader}=await import(pathToFileURL(join(dependencyRoot,'examples/jsm/loaders/GLTFLoader.js')));
 const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(disk.buffer.slice(disk.byteOffset,disk.byteOffset+disk.byteLength),'',resolve,reject));
 // Compare actual world-space vertices. Transformed local AABBs overestimate rotated meshes.
 const expected=createShrine(THREE);const a=new THREE.Box3().setFromObject(expected,true),b=new THREE.Box3().setFromObject(gltf.scene,true);
 assert.ok(a.min.distanceTo(b.min)<1e-5);assert.ok(a.max.distanceTo(b.max)<1e-5);
 let triangles=0,meshes=0;const materials=new Set();gltf.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;materials.add(o.material.name);assert.ok(o.geometry.attributes.color);}});
 assert.equal(meshes,95);assert.equal(triangles,9624);assert.equal(materials.size,6);
});
test('exporter rejects non-finite source geometry',()=>{
 const root=new THREE.Group(),g=new THREE.BoxGeometry();g.attributes.position.array[0]=NaN;root.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial()));assert.throws(()=>encodeGLB(root),/Non-finite/);
});
test('authored palette retains distinct non-white materials through GLB export',()=>{
 const source=createShrine(THREE),materials=new Map();
 source.traverse(o=>{if(o.isMesh)materials.set(o.material.name,o.material);});
 const {document:d}=parse(encodeGLB(source).buffer);
 const colors=d.materials.map(m=>m.pbrMetallicRoughness.baseColorFactor.slice(0,3));
 assert.equal(new Set(colors.map(c=>JSON.stringify(c))).size,6);
 for(const material of d.materials){
   const actual=material.pbrMetallicRoughness.baseColorFactor.slice(0,3);
   assert.ok(actual.some(v=>v<0.9),'palette must not silently fall back to white');
   assert.deepEqual(actual,materials.get(material.name).color.toArray());
 }
});
