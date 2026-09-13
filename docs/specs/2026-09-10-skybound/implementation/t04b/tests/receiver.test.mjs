import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createReceiver } from '../src/receiver.mjs';
import { createWorld } from '../../t01b/src/world.mjs';
import { createTerrain } from '../../t02a/src/terrain.mjs';
import { createManipulation } from '../../t04a/src/manipulation.mjs';
import { sampleGroundSupport } from '../../t02b/traversal/src/ground-support.mjs';
import { createManipulationView } from '../../t02b/traversal/src/manipulation-view.mjs';
import { createReceiverView } from '../../t02b/traversal/src/receiver-view.mjs';
const prism = { id:'prism',kind:'prism',size:{x:1.2,y:1,z:.7},position:{x:1.6,y:.5,z:33},yaw:90 };
const create = () => createReceiver({prismId:prism.id,x:1.6,z:33,width:1.15,depth:1.65,baseY:0});
const committed = object => ({objects:[object],held:null,preview:null,paused:false});

test('held, invalid preview and pause never activate even with a valid committed pose', () => {
  const r=create(), m=committed(prism);
  assert.equal(r.evaluate(null,{...m,held:prism}).reason,'held');
  assert.equal(r.evaluate(null,{...m,preview:{valid:false,pose:prism}}).reason,'preview');
  assert.equal(r.evaluate(null,m,{paused:true}).reason,'paused');
  assert.equal(r.evaluate(null,{...m,paused:true}).complete,false);
  assert.equal(r.evaluate(null,{...m,objects:[],preview:{valid:true,pose:prism}}).complete,false);
  assert.equal(r.evaluate(null,m).complete,true);
});

test('matching ID, whole footprint, quarter-turn and base height are all required', () => {
  const r=create();
  for(const [patch,reason] of [[{id:'other'},'object'],[{yaw:0},'orientation'],[{yaw:45},'orientation'],
    [{position:{...prism.position,x:2}},'footprint'],[{position:{...prism.position,y:.56}},'height']]) {
    assert.equal(r.evaluate(null,committed({...prism,...patch})).reason,reason);
  }
  assert.equal(r.evaluate(null,committed({...prism,yaw:270,position:{...prism.position,x:1.825,y:.55}})).complete,true);
});

test('completion remains latched through pause/absence and only explicit reset clears it', () => {
  const r=create(), m=Object.freeze(committed(Object.freeze(prism)));
  const first=r.evaluate(null,m); assert.ok(Object.isFrozen(first));
  assert.equal(r.evaluate(first,null,{paused:true}).complete,true);
  assert.equal(r.evaluate(first,{objects:[]}).complete,true);
  assert.equal(r.evaluate(first,m,{reset:true}).complete,false);
  assert.equal(r.evaluate(null,committed({...prism,yaw:0})).complete,false);
  assert.equal(prism.yaw,90);
});

test('actual meadow supports a reachable rotated core drop; completion locks view actions and reset releases', () => {
  const world=createWorld(THREE);world.root.updateMatrixWorld(true);
  const surfaces=[world.root.getObjectByName('continuous meadow'),world.root.children.find(o=>o.name.startsWith('walkable-looking'))];
  const vertex=new THREE.Vector3();
  const terrain=createTerrain(surfaces.map(mesh=>{
    const positions=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++) positions.push(...vertex.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld).toArray());
    return {positions,indices:mesh.geometry.index.array};
  }));
  const view=createManipulationView(THREE,world.col,terrain,surfaces), original=view.snapshot().objects[0];
  const receiver=createReceiverView(THREE,world.col,terrain,original), config=receiver.snapshot().receiver;
  const wallY=terrain.heightAt(-1.5,32);
  const c=createManipulation({objects:[original],walls:[{min:{x:-2,y:wallY,z:31.8},max:{x:-1,y:wallY+1.6,z:32.2}}],resolvePlacement:(o,at)=>sampleGroundSupport(terrain,o,at)});
  const y=terrain.heightAt(0,35), frame={eye:{x:0,y:y+1.35,z:35},player:{min:{x:-.3,y,z:34.7},max:{x:.3,y:y+1.68,z:35.3}}};
  assert.equal(c.dispatch({type:'select',id:original.id},frame).ok,true);
  assert.equal(c.dispatch({type:'grab'},frame).ok,true);
  assert.equal(c.dispatch({type:'rotate',yaw:90},frame).ok,true);
  const target={x:config.center.x,y:config.baseY+.5,z:config.center.z};
  assert.ok(Math.hypot(target.x,target.z-35)<=3);
  assert.equal(c.dispatch({type:'move',position:target},frame).ok,true);
  assert.equal(receiver.update(c.snapshot(),false).complete,false);
  assert.equal(c.dispatch({type:'drop'},frame).ok,true);
  assert.equal(receiver.update(c.snapshot(),true).complete,false);
  assert.equal(receiver.update(c.snapshot(),false).complete,true);
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,y+3,40);camera.lookAt(0,y+1,35);
  view.update({camera,position:{x:0,y,z:35},grounded:true,paused:false,yaw:0,pitch:.29});
  view.setLocked(true);const before=view.snapshot().objects;
  assert.equal(view.action('toggle').lastReason,'complete');assert.equal(view.snapshot().objects,before);assert.equal(view.snapshot().held,null);
  view.reset();assert.equal(view.snapshot().locked,false);assert.equal(receiver.reset().complete,false);
});
