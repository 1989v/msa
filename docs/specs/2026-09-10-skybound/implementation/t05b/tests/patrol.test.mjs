import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import {createPatrol} from '../src/patrol.mjs';
import {createTargetView} from '../../t02b/traversal/src/target-view.mjs';
import {createGuardian} from '../../t05a/src/guardian.mjs';
const terrain={heightAt:()=>0},home={x:0,y:0,z:0},far={x:20,y:0,z:20};
test('patrol approaches without overshoot, then returns inside its leash',()=>{
  const p=createPatrol({home,terrain});
  p.advance(.25,far);assert.equal(p.snapshot().mode,'patrol');assert.notDeepEqual(p.snapshot().position,home);
  for(let i=0;i<20;i++)p.advance(.25,{x:3,y:0,z:0});
  assert.equal(p.snapshot().mode,'approach');assert.ok(Math.abs(Math.hypot(p.snapshot().position.x-3,p.snapshot().position.z)-1.8)<1e-8);
  p.advance(.25,far);assert.equal(p.snapshot().mode,'return');
  for(let i=0;i<20;i++)p.advance(.25,far);
  assert.equal(p.snapshot().mode,'patrol');assert.ok(Math.hypot(p.snapshot().position.x,p.snapshot().position.z)<2);
});
test('pause and attack phases freeze movement; defeat and reset are explicit',()=>{
  const p=createPatrol({home,terrain});p.advance(.2,far);const before=p.snapshot();
  assert.deepEqual(p.advance(.2,far,{paused:true}),before);
  assert.deepEqual(p.advance(.2,far,{stopped:true}),before);
  assert.equal(p.advance(.2,far,{defeated:true}).mode,'defeated');assert.deepEqual(p.snapshot().position,before.position);
  assert.deepEqual(p.reset().position,home);
});
test('terrain edges, high steps and swept blockers reject movement',()=>{
  for(const heightAt of [(x)=>x>.5?null:0,(x)=>x>.5?2:0]){
    const p=createPatrol({home,terrain:{heightAt}});for(let i=0;i<8;i++)p.advance(.25,{x:3,y:0,z:0});
    assert.ok(p.snapshot().position.x<=.05+1e-8);assert.equal(p.snapshot().blocked,true);
  }
  const p=createPatrol({home,terrain,canMove:()=>false});p.advance(.25,{x:3,y:0,z:0});assert.deepEqual(p.snapshot().position,home);
});
test('view, damage target and guardian share updated coordinates without healing',()=>{
  const col=()=>new THREE.Color();const view=createTargetView(THREE,col,terrain);
  const guardian=createGuardian({position:view.combat.snapshot().target});
  const movement=view.navigation.advance(.25,far);const position=view.moveTo(movement);guardian.setPosition(position);
  assert.deepEqual(view.root.position.toArray(),Object.values(movement.position));
  assert.deepEqual(view.combat.snapshot().target,guardian.snapshot().position);
  const attacker={position:{x:position.x,y:0,z:position.z+1},yaw:Math.PI};
  view.combat.beginSwing();assert.equal(view.combat.advance(.3,attacker).hp,2);
  view.moveTo(view.navigation.advance(.25,far));assert.equal(view.combat.snapshot().hp,2);
  view.moveTo(view.navigation.reset());assert.equal(view.root.position.x,3.8);assert.equal(view.root.position.z,32);
});
