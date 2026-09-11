import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import {createCharacter} from '../src/model.mjs';

test('both authored LODs retain a grounded adult silhouette and shared rig',()=>{
  const a=createCharacter(THREE),b=createCharacter(THREE,{lod:1});
  assert.ok(a.stats.triangles>=8000&&a.stats.triangles<=15000);
  assert.ok(b.stats.triangles<a.stats.triangles*.5);
  assert.deepEqual(a.skeleton.bones.map(b=>b.name),b.skeleton.bones.map(b=>b.name));
  for(const c of [a,b]){assert.ok(c.mesh.isSkinnedMesh);assert.ok(Math.abs(c.mesh.geometry.boundingBox.min.y)<1e-6);assert.ok(c.stats.height>1.65&&c.stats.height<1.75);assert.equal(c.stats.atlasSize,1024);}
});
test('all topology, UVs and normalized skin weights survive both LODs',()=>{
  for(const lod of [0,1]){const c=createCharacter(THREE,{lod}),g=c.mesh.geometry;
    for(const n of ['position','normal','uv','skinWeight'])assert.ok([...g.attributes[n].array].every(Number.isFinite),n);
    assert.ok([...g.attributes.uv.array].every(x=>x>=0&&x<=1));
    assert.ok([...g.index.array].every(x=>x<g.attributes.position.count));
    const w=g.attributes.skinWeight,i=g.attributes.skinIndex;
    for(let k=0;k<w.count;k++){assert.ok(Math.abs(w.getX(k)+w.getY(k)+w.getZ(k)+w.getW(k)-1)<1e-6);for(let j=0;j<4;j++){assert.ok(w.array[k*4+j]>=0);assert.ok(i.array[k*4+j]<c.skeleton.bones.length);}}
  }
});
test('forearm rotation bends bound skin by the expected independent pivot rotation and leaves boots fixed',()=>{
  const c=createCharacter(THREE),part=c.stats.parts.find(p=>p.name==='forearm-wrap-L'),boot=c.stats.parts.find(p=>p.name==='boot-upper-R');
  const index=part.start+Math.floor(part.count/2),before=c.mesh.getVertexPosition(index,new THREE.Vector3()),fixed=c.mesh.getVertexPosition(boot.start,new THREE.Vector3());
  const fore=c.skeleton.getBoneByName('forearm_L'),pivot=fore.getWorldPosition(new THREE.Vector3()),angle=-.55;
  const expected=before.clone().sub(pivot).applyAxisAngle(new THREE.Vector3(0,0,1),angle).add(pivot);
  fore.rotation.z=angle;c.root.updateMatrixWorld(true);c.skeleton.update();
  const after=c.mesh.getVertexPosition(index,new THREE.Vector3());assert.ok(after.distanceTo(before)>.03);assert.ok(after.distanceTo(expected)<1e-6);assert.ok(c.mesh.getVertexPosition(boot.start,new THREE.Vector3()).distanceTo(fixed)<1e-6);
});
test('inspection clip moves elbow, knee and cape and reset restores bind pose',()=>{
  const c=createCharacter(THREE),mixer=new THREE.AnimationMixer(c.root),names=['forearm-wrap-L','boot-upper-R','cape-outer'];
  const points=names.map(name=>{const part=c.stats.parts.find(p=>p.name===name);return part.start+Math.floor(part.count*.97);});
  const before=points.map(i=>c.mesh.getVertexPosition(i,new THREE.Vector3()));mixer.clipAction(c.clips.find(c=>c.name==='rig-inspection')).play();mixer.setTime(1.5);c.root.updateMatrixWorld(true);c.skeleton.update();
  points.forEach((i,k)=>assert.ok(c.mesh.getVertexPosition(i,new THREE.Vector3()).distanceTo(before[k])>.01,names[k]));
  mixer.stopAllAction();c.skeleton.pose();c.root.updateMatrixWorld(true);c.skeleton.update();points.forEach((i,k)=>assert.ok(c.mesh.getVertexPosition(i,new THREE.Vector3()).distanceTo(before[k])<1e-6));
});

test('both eyes remain in front of the actual facial triangles at both LODs',()=>{
  for(const lod of [0,1]){
    const c=createCharacter(THREE,{lod});
    c.root.updateMatrixWorld(true);
    c.skeleton.update();
    for(const x of [-.028,.028]){
      const ray=new THREE.Raycaster(new THREE.Vector3(x,1.5665,.5),new THREE.Vector3(0,0,-1));
      const hits=ray.intersectObject(c.mesh);
      assert.ok(hits.length>1);
      let triangleEnd=0;
      const frontmostPart=c.stats.parts.find(part=>{
        triangleEnd+=part.triangles;
        return hits[0].faceIndex<triangleEnd;
      });
      assert.equal(frontmostPart.name,'iris',`LOD ${lod}, eye ${x}: skin or hair must not hide the eye`);
    }
  }
});
