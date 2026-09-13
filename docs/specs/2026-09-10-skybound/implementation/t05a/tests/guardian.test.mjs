import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createGuardian, createPlayerHealth } from '../src/guardian.mjs';
import { createTarget } from '../src/target.mjs';
import { createSimulation, MOVEMENT } from '../../t02a/src/simulation.mjs';
import { segmentHitsBox } from '../../t04a/src/manipulation.mjs';
import { createManipulationView } from '../../t02b/traversal/src/manipulation-view.mjs';
const position={x:0,y:.8,z:0}, player={x:0,y:0,z:1.5};

test('windup locks point, strikes once at crossing, then waits through recovery',()=>{
  const g=createGuardian({position});
  let s=g.advance(.4,player);assert.equal(s.phase,'windup');assert.deepEqual(s.locked,player);assert.equal(s.player.hp,3);
  s=g.advance(.45,player);assert.equal(s.phase,'recovery');assert.equal(s.player.hp,2);assert.equal(s.strikes,1);
  assert.deepEqual(g.advance(0,player),s);
  s=g.advance(1.1,player);assert.equal(s.strikes,1);assert.equal(s.player.hp,2);
  s=g.advance(.1,player);assert.equal(s.phase,'windup');assert.equal(s.strikes,1);
});

test('leaving locked point dodges; elevation and actual slab LOS prevent attack or late strike',()=>{
  const g=createGuardian({position});g.advance(.4,player);
  const dodged=g.advance(.4,{...player,x:1});assert.equal(dodged.strikes,1);assert.equal(dodged.player.hp,3);
  const high=createGuardian({position});assert.equal(high.advance(.8,{...player,y:2}).phase,'idle');
  let blocked=false;
  const wall={min:{x:-1,y:0,z:.6},max:{x:1,y:2,z:.7}};
  const occluded=createGuardian({position,lineOfSight:(a,b)=>!blocked||!segmentHitsBox(a,b,wall)});
  blocked=true;assert.equal(occluded.advance(.4,player).phase,'idle');
  blocked=false;occluded.advance(.4,player);blocked=true;
  assert.equal(occluded.advance(.4,player).player.hp,3);
});

test('one-second player invulnerability rejects overlapping hits and clamps health at zero',()=>{
  const health=createPlayerHealth();assert.equal(health.hit(),true);assert.equal(health.hit(),false);
  health.advance(.999);assert.equal(health.hit(),false);
  health.advance(.001);assert.equal(health.hit(),true);assert.equal(health.snapshot().hp,1);
  health.advance(1);assert.equal(health.hit(),true);assert.equal(health.snapshot().hp,0);
  health.advance(1);assert.equal(health.hit(),false);assert.equal(health.restore().hp,3);
});

test('pause freezes warning; defeat cancels strike; respawn has recovery grace and invalid dt is atomic',()=>{
  const g=createGuardian({position});const before=g.advance(.5,player);
  assert.deepEqual(g.advance(1,player,{paused:true}),before);
  assert.throws(()=>g.advance(NaN,player));assert.deepEqual(g.snapshot(),before);
  let s=g.advance(.4,player,{defeated:true});assert.equal(s.phase,'defeated');assert.equal(s.strikes,0);assert.equal(s.player.hp,3);
  s=g.advance(0,player,{respawned:true});assert.equal(s.phase,'recovery');assert.equal(s.locked,null);
  assert.equal(g.advance(.8,player).strikes,0);
});

test('fatal counterattack requests safe respawn while movement progress and target damage persist',()=>{
  const sim=createSimulation({terrain:{heightAt:()=>0},checkpoint:{x:0,z:0},flight:{enabled:true,volumes:[]},progress:{firstAerialLanding:true,secondAerialLanding:true,puzzleComplete:true}});
  const g=createGuardian({position}),target=createTarget({position});
  target.beginSwing();target.advance(.3,{position:player,yaw:Math.PI});assert.equal(target.snapshot().hp,2);
  let s;
  for(let i=0;i<3;i++){s=g.advance(.8,player);if(i<2)g.advance(1.2,player);}
  assert.equal(s.respawnRequested,true);assert.equal(s.player.hp,0);
  sim.advance(.2,{x:1,jumpPressed:true});sim.advance(MOVEMENT.step/2,{});sim.advance(0,{jumpPressed:true});
  const progress=sim.snapshot().progress,restored=sim.respawn();
  assert.deepEqual(restored.position,{x:0,y:0,z:0});assert.deepEqual(restored.velocity,{x:0,y:0,z:0});assert.deepEqual(restored.progress,progress);
  assert.equal(restored.stamina,100);assert.equal(restored.gliding,false);assert.equal(restored.respawns,1);
  const next=sim.advance(MOVEMENT.step/2,{});assert.equal(next.steps,0);assert.equal(next.grounded,true);
  assert.equal(g.advance(0,restored.position,{respawned:true}).player.hp,3);
  assert.equal(target.snapshot().hp,2);assert.deepEqual(target.snapshot().target,position);
  const view=createManipulationView(THREE,()=>new THREE.Color(.5,.5,.5),{heightAt:()=>0});
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,3,40);camera.lookAt(0,.5,33);
  const frame={camera,position:{x:0,y:0,z:36.5},grounded:true,paused:false,yaw:0,pitch:Math.atan(1.05/1.5)};
  view.update(frame);assert.ok(view.action('toggle').held);
  view.update(frame);assert.equal(view.action('toggle').held,null);
  assert.ok(Math.abs(view.snapshot().objects[0].position.z-35)<1e-8);
  camera.lookAt(0,.5,35);view.update(frame);assert.ok(view.action('toggle').held);
  // The preserved commit would overlap spawn; restore only the unfinished prism.
  const recovered=view.recoverCarry({x:0,y:0,z:35});assert.equal(recovered.held,null);
  assert.equal(recovered.objects[0].position.z,33);assert.equal(recovered.locked,false);
  assert.equal(g.reset().phase,'idle');assert.equal(g.snapshot().strikes,0);
});
