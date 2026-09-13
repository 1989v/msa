import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createDodge, isDodgeInvulnerableAt } from '../src/dodge.mjs';
import { createSimulation, MOVEMENT } from '../src/simulation.mjs';
import { createGuardian } from '../../t05a/src/guardian.mjs';
import { createCharacter } from '../../t02b/character/src/model.mjs';
import { createDodgePose } from '../../t02b/traversal/src/dodge-pose.mjs';
const sim=terrain=>createSimulation({terrain:terrain??{heightAt:()=>0},checkpoint:{x:0,z:0},flight:{enabled:true,volumes:[]}});

test('ground/reach budget gates, cooldown and exact invulnerability interval',()=>{
  const d=createDodge(),input={grounded:true,stamina:100,x:1,z:1};
  assert.equal(d.request(0,{...input,grounded:false}),false);
  assert.equal(d.request(0,{...input,blocked:true}),false);
  assert.equal(d.request(0,{...input,stamina:19.99}),false);
  assert.equal(d.request(0,input),true);assert.equal(d.request(.3,input),false);
  assert.ok(Math.abs(d.snapshot(.1).direction.x-Math.SQRT1_2)<1e-9);
  assert.equal(isDodgeInvulnerableAt(d.snapshot(0),.179),true);
  assert.equal(isDodgeInvulnerableAt(d.snapshot(0),.18),false);
  assert.equal(d.snapshot(.28).active,false);assert.equal(d.request(.6,input),true);
  d.reset();assert.equal(d.snapshot(.6).active,false);
});

test('fixed-tick dodge costs20 once and travels7*.28m regardless frame partition',()=>{
  const a=sim(),b=sim();
  a.advance(0,{dodgePressed:true,x:1});b.advance(0,{dodgePressed:true,x:1});
  assert.equal(a.advance(MOVEMENT.step,{}).stamina,80);
  for(let i=1;i<34;i++)a.advance(MOVEMENT.step,{});
  b.advance(.25,{});b.advance(4*MOVEMENT.step,{});
  assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(a.snapshot().dodge.active,false);
  assert.ok(Math.abs(a.snapshot().position.x-1.96)<1e-8);
  assert.equal(a.snapshot().stamina,80);
});

test('existing uphill step rejection blocks dash and jump input cannot queue through dodge; reset clears pending',()=>{
  const c=sim({heightAt:x=>x>.5?2:0});
  c.advance(.25,{x:1,dodgePressed:true,jumpPressed:true});
  assert.ok(c.snapshot().position.x<.5);assert.equal(c.snapshot().position.y,0);assert.equal(c.snapshot().grounded,true);
  c.advance(.1,{jumpPressed:true});assert.equal(c.snapshot().position.y,0);
  c.setProgress({firstAerialLanding:true});const reset=c.respawn();assert.equal(reset.dodge.active,false);assert.equal(reset.stamina,100);assert.equal(reset.progress.firstAerialLanding,true);
  c.advance(0,{dodgePressed:true});c.clearInput();c.advance(MOVEMENT.step,{});assert.equal(c.snapshot().dodge.active,false);
});

test('guardian tests evasion at strike time rather than end of frame and grants no hit iframe',()=>{
  const g=createGuardian({position:{x:0,y:.8,z:0}}),player={x:0,y:0,z:1};
  g.advance(.7,player);
  let s=g.advance(.2,player,{invulnerableAt:offset=>isDodgeInvulnerableAt({startedAt:0},offset)});
  assert.equal(s.player.hp,3);assert.equal(s.player.invulnerable,0);
  g.advance(1.1,player);g.advance(.7,player);
  s=g.advance(.2,player,{invulnerableAt:offset=>isDodgeInvulnerableAt({startedAt:-.08},offset)});
  assert.equal(s.player.hp,2);
});

test('dodge torso overlay restores original quaternions and never translates character root',()=>{
  const {root}=createCharacter(THREE),pose=createDodgePose(THREE,root),spine=root.getObjectByName('spine'),before=spine.quaternion.clone();
  pose.apply({active:true,elapsed:.14});assert.ok(spine.quaternion.angleTo(before)>.2);assert.equal(root.position.length(),0);
  pose.restore();assert.ok(spine.quaternion.angleTo(before)<1e-8);pose.restore();assert.equal(root.position.length(),0);
});
