import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import {CHECKPOINTS,reachedCheckpoint,restoreCheckpoint} from '../src/checkpoints.mjs';
import {createWorld} from '../../t01b/src/world.mjs';
import {createTerrain} from '../../t02a/src/terrain.mjs';
import {createSimulation} from '../../t02a/src/simulation.mjs';
import {createProgressSave} from '../../t07a/src/save.mjs';
const complete={stoneRuinActive:true,watchRuinActive:true,windRuinActive:true,firstAerialLanding:true,secondAerialLanding:true,journeyComplete:true};
const world=createWorld(T),terrain=createTerrain(world.regions.map(({surface})=>({positions:surface.geometry.attributes.position.array,indices:surface.geometry.index.array})));
const points=CHECKPOINTS.map(point=>({...point,y:terrain.heightAt(point.x,point.z)}));
test('only grounded, unlocked arrivals near authored safe ground select checkpoints',()=>{
 const west=points[1];assert.equal(reachedCheckpoint({},west,true,points),null);
 assert.equal(reachedCheckpoint(complete,west,false,points),null);
 assert.equal(reachedCheckpoint(complete,{...west,y:west.y+2},true,points),null);
 assert.equal(reachedCheckpoint(complete,{...west,x:west.x+3},true,points),null);
 assert.equal(reachedCheckpoint(complete,west,true,points).id,'west-harbor');
 assert.equal(restoreCheckpoint({},points).id,'camp');
});
test('each named checkpoint satisfies real island safety and fall recovery preserves progress',()=>{
 for(const point of points){
  const sim=createSimulation({terrain,checkpoint:point,progress:{...complete,checkpointId:point.id}});
  for(let i=0;i<1000&&!sim.snapshot().respawns;i++)sim.advance(.1,{x:1,sprint:true});
  assert.equal(sim.snapshot().respawns,1);assert.equal(sim.snapshot().progress.checkpointId,point.id);
  assert.ok(Math.hypot(sim.snapshot().position.x-point.x,sim.snapshot().position.z-point.z)<.6);
 }
});
test('named checkpoint survives save/load; invalid or locked destinations preserve the previous save',()=>{
 let raw=null;const storage=createProgressSave(()=>({getItem:()=>raw,setItem:(_,v)=>raw=v}));
 assert.equal(storage.save({...complete,checkpointId:'high-archive'}).ok,true);
 assert.equal(restoreCheckpoint(storage.load().progress,points).id,'high-archive');
 const before=raw;
 for(const id of [null,42,'relay-one','__proto__',{x:0,z:35}])assert.equal(storage.save({...complete,checkpointId:id}).ok,false);
 assert.equal(storage.save({checkpointId:'west-harbor'}).ok,false);assert.equal(raw,before);
 assert.equal(storage.save({checkpointId:'camp'}).ok,true);assert.equal(restoreCheckpoint(storage.load().progress,points).id,'camp');
});
