import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createTarget, hitEligibility } from '../src/target.mjs';
import { createWorld } from '../../t01b/src/world.mjs';
import { createTerrain } from '../../t02a/src/terrain.mjs';
import { createTargetView } from '../../t02b/traversal/src/target-view.mjs';
import { createManipulationView } from '../../t02b/traversal/src/manipulation-view.mjs';
const attacker={position:{x:0,y:0,z:0},yaw:0}, position={x:0,y:.8,z:1.5};

test('crossing hit time with a skipped frame damages once; zero-time draws and later frames cannot repeat',()=>{
  const c=createTarget({position});c.beginSwing();assert.equal(c.advance(.2,attacker).hp,3);
  assert.equal(c.advance(.2,attacker).hp,2);assert.equal(c.beginSwing(),false);
  for(let i=0;i<10;i++) assert.equal(c.advance(0,attacker).hp,2);
  assert.equal(c.advance(.46,attacker).hp,2);
  for(let i=0;i<2;i++){assert.equal(c.beginSwing(),true);c.advance(.86,attacker);}
  assert.equal(c.snapshot().hp,0);assert.equal(c.snapshot().defeated,true);
  c.beginSwing();assert.equal(c.advance(.86,attacker).hp,0);
});

test('range, character-forward cone, vertical tolerance and actual mesh LOS bound hits',()=>{
  assert.equal(hitEligibility(attacker,{x:0,y:.8,z:2}),null);
  assert.equal(hitEligibility(attacker,{x:0,y:.8,z:2.01}),'range');
  assert.equal(hitEligibility(attacker,{x:Math.sqrt(3),y:.8,z:1}),null);
  assert.equal(hitEligibility(attacker,{x:0,y:.8,z:-1}),'direction');
  assert.equal(hitEligibility({...attacker,yaw:Math.PI},{x:0,y:.8,z:-1}),null);
  assert.equal(hitEligibility(attacker,{x:0,y:2.01,z:1}),'height');
  const wall=new THREE.Mesh(new THREE.BoxGeometry(2,2,.1),new THREE.MeshBasicMaterial());wall.position.set(0,1,.7);wall.updateMatrixWorld(true);
  const los=(from,to)=>{const a=new THREE.Vector3(from.x,from.y,from.z),d=new THREE.Vector3(to.x,to.y,to.z).sub(a);const ray=new THREE.Raycaster(a,d.clone().normalize(),.001,d.length()-.001);return ray.intersectObject(wall).length===0;};
  assert.equal(hitEligibility(attacker,position,los),'occluded');
  wall.position.x=4;wall.updateMatrixWorld(true);assert.equal(hitEligibility(attacker,position,los),null);
});

test('pause freezes clock, missed swings stay consumed, cancellation and full reset have distinct effects',()=>{
  const c=createTarget({position});c.beginSwing();c.advance(.2,attacker);
  const before=c.snapshot();assert.deepEqual(c.advance(.5,attacker,{paused:true}),before);
  assert.throws(()=>c.advance(NaN,attacker));assert.deepEqual(c.snapshot(),before);
  assert.equal(c.advance(.2,{...attacker,yaw:Math.PI}).hp,3);
  assert.equal(c.advance(.2,attacker).hp,3);
  c.cancelSwing();c.beginSwing();c.advance(.3,attacker);assert.equal(c.snapshot().hp,2);
  c.cancelSwing();assert.equal(c.snapshot().hp,2);assert.equal(c.snapshot().swing,null);
  assert.equal(c.reset().hp,3);assert.equal(c.snapshot().sequence,0);
});

test('actual meadow initializes target with visible blockers and paints hit/defeat/reset',()=>{
  const world=createWorld(THREE);world.root.updateMatrixWorld(true);
  const surfaces=[world.root.getObjectByName('continuous meadow'),world.root.children.find(o=>o.name.startsWith('walkable-looking'))],v=new THREE.Vector3();
  const terrain=createTerrain(surfaces.map(mesh=>{const positions=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++)positions.push(...v.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld).toArray());return{positions,indices:mesh.geometry.index.array};}));
  const manipulation=createManipulationView(THREE,world.col,terrain,surfaces);
  const blockers=()=>[...surfaces,...manipulation.root.children.filter(o=>o.isMesh&&o.visible&&!o.material.wireframe)];
  assert.equal(blockers().length,surfaces.length+2);
  const view=createTargetView(THREE,world.col,terrain,blockers),floor=terrain.heightAt(3.8,32);
  assert.equal(view.root.position.y,floor);assert.equal(view.combat.snapshot().target.y,floor+.8);
  const actor={position:{x:3.8,y:terrain.heightAt(3.8,33.5),z:33.5},yaw:Math.PI};
  for(let i=0;i<3;i++){view.combat.beginSwing();view.paint(view.combat.advance(.86,actor));}
  assert.equal(view.combat.snapshot().hp,0);assert.equal(view.root.children[0].scale.y,.45);
  view.paint(view.combat.reset());assert.equal(view.root.children[0].scale.y,1);
});
