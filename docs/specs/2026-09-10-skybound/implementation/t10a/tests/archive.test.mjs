import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import {createArchiveSurvey} from '../src/archive-survey.mjs';
import {createArchiveView} from '../../t02b/traversal/src/archive-view.mjs';
import {createExpeditionView} from '../../t02b/traversal/src/expedition-view.mjs';
import {createWorld} from '../../t01b/src/world.mjs';
import {createTerrain} from '../../t02a/src/terrain.mjs';
import {createSimulation} from '../../t02a/src/simulation.mjs';
import {createProgressSave} from '../../t07a/src/save.mjs';

test('rings require unlocked gliding in order, ignore pause/teleport, and commit only at a grounded device',()=>{
 const points=[{x:4,y:6,z:0},{x:-3,y:10,z:3},{x:0,y:14,z:-4}],device={x:0,y:0,z:0},puzzle=createArchiveSurvey(points,device);
 const feet=p=>({...p,y:p.y-.85});
 puzzle.advance(feet(points[1]),feet(points[1]),{gliding:true,unlocked:true});assert.equal(puzzle.snapshot().count,0);
 for(const flags of [{unlocked:false},{gliding:false},{paused:true}])puzzle.advance(feet(points[0]),feet(points[0]),{gliding:true,unlocked:true,...flags});
 puzzle.advance(device,feet(points[0]),{gliding:true,unlocked:true});assert.equal(puzzle.snapshot().count,0);
 for(const point of points)puzzle.advance(feet(point),feet(point),{gliding:true,unlocked:true});
 assert.equal(puzzle.finish({position:device,unlocked:true,grounded:false}).ok,false);
 assert.equal(puzzle.finish({position:device,unlocked:true,grounded:true}).ok,true);
 assert.equal(puzzle.finish({position:device,unlocked:true,grounded:true}).reason,'complete');puzzle.reset();assert.equal(puzzle.snapshot().count,0);puzzle.reset(true);assert.equal(puzzle.snapshot().complete,true);
});
test('original archive terrain and wind allow all three altitude observations without upgrades',()=>{
 const world=createWorld(T),surface=world.regions.find(r=>r.x===-48&&r.z===-126).surface;
 // Include main/harbor surfaces so the complete passage can construct its ground marks.
 const base=createTerrain(world.regions.map(({surface})=>({positions:surface.geometry.attributes.position.array,indices:surface.geometry.index.array})));
 const route=createExpeditionView(T,world.col,base),archive=createArchiveView(T,world.col,base);
 const sim=createSimulation({terrain:route.terrain,checkpoint:archive.device,progress:{journeyComplete:true},flight:{enabled:true,volumes:route.volumes}});
 const step=(dt,input={})=>{const from=sim.snapshot().position,next=sim.advance(dt,input);archive.advance(from,next.position,{gliding:next.gliding,unlocked:true});return next;};
 const move=(target)=>{for(let i=0;i<100;i++){const p=sim.snapshot().position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.2)return;step(.05,{x:dx/d,z:dz/d});}throw new Error('Flight target unreachable');};
 step(.15,{jumpPressed:true});step(.01,{jumpPressed:true});
 for(let i=0;i<3;i++){
  move(archive.device);
  for(let t=0;t<180&&sim.snapshot().position.y<archive.rings[i].y+.15;t++)step(.05);
  move(archive.rings[i]);
  for(let t=0;t<180&&archive.snapshot().count===i;t++)step(.05);
  assert.equal(archive.snapshot().count,i+1);assert.ok(sim.snapshot().stamina>0);assert.equal(sim.snapshot().respawns,0);
 }
 move(archive.device);if(sim.snapshot().gliding)step(.01,{jumpPressed:true});for(let t=0;t<180&&!sim.snapshot().grounded;t++)step(.05);
 assert.equal(archive.finish({position:sim.snapshot().position,grounded:sim.snapshot().grounded,unlocked:true}).ok,true);
 assert.ok(surface.geometry.index.count>0);
});
test('expanded ending saves require harbor and first ending, while legacy saves still load',()=>{
 let raw;const store=createProgressSave(()=>({getItem:()=>raw,setItem:(_,v)=>{raw=v;}}));
 const progress={journeyComplete:true,stoneRuinActive:true,watchRuinActive:true,windRuinActive:true,firstAerialLanding:true,secondAerialLanding:true,harborAligned:true,archiveComplete:true};
 assert.equal(store.save(progress).ok,true);assert.deepEqual(store.load().progress,progress);
 assert.equal(store.save({...progress,harborAligned:false}).ok,false);assert.equal(store.save({...progress,journeyComplete:false}).ok,false);
 for(const archiveComplete of [1,null,'yes'])assert.equal(store.save({...progress,archiveComplete}).ok,false);
});
