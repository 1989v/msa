import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createWorld } from '../../t01b/src/world.mjs';
import { createTerrain } from '../../t02a/src/terrain.mjs';
import { createSimulation } from '../../t02a/src/simulation.mjs';
import { createExpeditionView } from '../../t02b/traversal/src/expedition-view.mjs';
import { createRouteGuide } from '../src/route-guide.mjs';
import { mapPoint, MAP_AREAS, DISCOVERY_IDS } from '../../t06a/src/exploration.mjs';
import { createProgressSave } from '../../t07a/src/save.mjs';
const completed={journeyComplete:true,stoneRuinActive:true,watchRuinActive:true,windRuinActive:true,firstAerialLanding:true,secondAerialLanding:true};
function setup(){
  const world=createWorld(T);
  const base=createTerrain(world.regions.filter(r=>(r.x===0&&r.z===0)||(r.x===-72&&r.z===-68)||(r.x===-48&&r.z===-126)).map(({surface})=>({positions:surface.geometry.attributes.position.array,indices:surface.geometry.index.array})));
  return createExpeditionView(T,world.col,base);
}
test('actual western passage is gated and every leg supports basic-stamina return flight',()=>{
  const route=setup(),start=route.locations[0].position;
  const sim=createSimulation({terrain:route.terrain,checkpoint:start,flight:{enabled:true,volumes:route.volumes}});
  sim.advance(.15,{jumpPressed:true});sim.advance(.01,{jumpPressed:true});assert.equal(sim.snapshot().windSpeed,0);
  sim.respawn();sim.setProgress(completed);
  const targets=[...route.locations.slice(1),...route.locations.slice(0,-1).reverse()];
  let source=route.locations[0];
  for(const target of targets){
    for(let i=0;i<40;i++)sim.advance(.1,{});
    sim.advance(.15,{jumpPressed:true});sim.advance(.01,{jumpPressed:true});
    for(let i=0;i<160&&sim.snapshot().position.y<source.position.y+25;i++)sim.advance(.05,{});
    for(let i=0;i<220;i++){
      const p=sim.snapshot().position,dx=target.position.x-p.x,dz=target.position.z-p.z,d=Math.hypot(dx,dz);
      if(d<.25)break;sim.advance(.05,{x:dx/d,z:dz/d});
    }
    assert.ok(sim.snapshot().stamina>0,target.id+' needs reserve');
    if(sim.snapshot().gliding)sim.advance(.01,{jumpPressed:true});
    for(let i=0;i<220&&!sim.snapshot().grounded;i++)sim.advance(.05,{});
    const p=sim.snapshot().position;
    assert.ok(sim.snapshot().grounded&&Math.hypot(p.x-target.position.x,p.z-target.position.z)<.3&&Math.abs(p.y-target.position.y)<.3,target.id+': '+JSON.stringify(p));
    assert.equal(sim.snapshot().respawns,1);source=target;
  }
});
test('route guide keeps current landing goal in flight and reverses the route on a new selection',()=>{
  const nodes=[{id:'start',position:{x:0,y:0,z:0}},{id:'middle',position:{x:10,y:0,z:0}},{id:'end',position:{x:20,y:0,z:0}}],guide=createRouteGuide(nodes);
  assert.equal(guide.target('end',nodes[0].position,true).id,'middle');
  assert.equal(guide.target('end',{x:11,y:5,z:0},false).id,'middle');
  assert.equal(guide.target('end',nodes[1].position,true).id,'end');
  assert.equal(guide.target('start',nodes[2].position,true).id,'middle');
});
test('western map includes new regions at equal scale and extended discoveries survive saving',()=>{
  const route=setup();for(const location of route.locations){const p=mapPoint(location.position,MAP_AREAS.western);assert.ok(p.x>=0&&p.x<=420&&p.y>=0&&p.y<=600);}
  assert.equal(mapPoint({x:0,z:0},MAP_AREAS.western).x-mapPoint({x:-1,z:0},MAP_AREAS.western).x,3);
  let raw;const store=createProgressSave(()=>({setItem:(_,value)=>{raw=value;},getItem:()=>raw}));
  assert.equal(store.save({...completed,discoveries:[...DISCOVERY_IDS]}).ok,true);assert.deepEqual(store.load().progress.discoveries,DISCOVERY_IDS);
});
