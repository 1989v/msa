import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createSceneryTerrain } from '../src/scenery-terrain.mjs';
import { createSolidTerrain } from '../src/solid-terrain.mjs';
import { createSimulation } from '../../../t02a/src/simulation.mjs';

const mesh = (geometry,name,x,y,z) => { const value=new T.Mesh(geometry,new T.MeshBasicMaterial());value.name=name;value.position.set(x,y,z);return value; };
test('rendered trunk blocks walking and dodge while low steps provide support',()=>{
  const root=new T.Group();root.add(mesh(new T.CylinderGeometry(.2,.2,3,12),'tree trunk',2,1.5,0));
  root.add(mesh(new T.BoxGeometry(2,.3,2),'approach stair',0,.15,-3));
  const scenery=createSceneryTerrain(T,{heightAt:()=>0},root);
  const terrain=createSolidTerrain(scenery.terrain,()=>[]);
  const sim=createSimulation({terrain,checkpoint:{x:0,z:0}});
  for(let i=0;i<6;i++)sim.advance(.25,{x:1});
  assert.ok(sim.snapshot().position.x<1.6 && sim.snapshot().position.x>1.4);
  sim.advance(.25,{x:1,dodgePressed:true});assert.ok(sim.snapshot().position.x<1.6);
  sim.advance(.25,{x:-1});assert.ok(sim.snapshot().position.x<1.3);
  assert.ok(Math.abs(terrain.supportHeightAt(0,-3,0)-.3)<1e-6);
  assert.equal(terrain.heightAt(0,-3),0,'checkpoints stay on approved base terrain');
});
test('instanced rocks use individual transformed geometry; leaves stay permeable',()=>{
  const root=new T.Group();
  const rocks=new T.InstancedMesh(new T.BoxGeometry(1,2,1),new T.MeshBasicMaterial(),2);rocks.name='weathered limestone fragments';
  rocks.setMatrixAt(0,new T.Matrix4().makeTranslation(-2,1,0));rocks.setMatrixAt(1,new T.Matrix4().makeTranslation(2,1,0));root.add(rocks);
  root.add(mesh(new T.BoxGeometry(4,4,4),'windswept crown',0,2,0));
  const {terrain}=createSceneryTerrain(T,{heightAt:()=>0},root);
  assert.equal(terrain.canMove({x:0,y:0,z:0},{x:0,y:0,z:2}),true);
  assert.equal(terrain.canMove({x:0,y:0,z:0},{x:2,y:0,z:0}),false);
  assert.equal(terrain.supportHeightAt(-2,0,3),2);
  assert.equal(terrain.supportHeightAt(0,0,3),0);
});
