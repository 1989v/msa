import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {CORRIDORS,CORRIDOR_GUARDS,RUIN_APPROACHES,TOWNS,DUNGEON_ENTRANCES,LANDMARKS,heightAt,querySolids,getChunk,spawnsNear,WORLD} from '../world.mjs';
import {triangleHeight} from '../terrain.mjs';
import {createGame,stepGame,interaction} from '../sim.mjs';
import {runCorridor} from './corridor-routes.mjs';

test('four named corridors connect all eight towns and durable guarded discoveries',()=>{
  assert.equal(CORRIDORS.length,4);assert.equal(new Set(CORRIDORS.flatMap(c=>[c.fromTownId,c.toTownId])).size,8);
  for(const c of CORRIDORS){for(const [id,p]of [[c.fromTownId,c.points[0]],[c.toTownId,c.points.at(-1)]]){const t=TOWNS.find(t=>t.id===id);assert.equal(t.x,p.x);assert.equal(t.z,p.z);}
    assert.equal(c.landmarkIds.length,3);for(const id of c.landmarkIds)assert.ok(LANDMARKS.find(l=>l.id===id)?.name);
    const cache=LANDMARKS.find(l=>l.id===c.cacheId);assert.equal(cache.kind,'chest');assert.deepEqual(cache.requires,c.guardIds);const fixture=createGame();Object.assign(fixture.player,{x:cache.x,y:cache.y,z:cache.z});assert.equal(interaction(fixture)?.id,cache.id,'discovery must not mask cache interaction');
    for(const id of c.guardIds){const g=CORRIDOR_GUARDS.find(g=>g.id===id);assert.equal(g.corridorId,c.id);assert.ok(spawnsNear(g.x,g.z,1).some(s=>s.id===id));assert.ok(g.y>WORLD.waterLevel+1);assert.equal(querySolids(g.x,g.z,1.2).length,0);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])assert.ok(Math.abs(heightAt(g.x+dx,g.z+dz)-g.y)<=.8);}
  }
});
test('every corridor and ruin approach has clear metre grades and exact rendered support',()=>{
  for(const c of [...CORRIDORS,...RUIN_APPROACHES]){let length=0,low=Infinity,high=-Infinity;
    for(let j=1;j<c.points.length;j++){const a=c.points[j-1],b=c.points[j],d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(d);length+=d;let prev=heightAt(a.x,a.z);
      for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n,y=heightAt(x,z);assert.ok(Math.abs(y-prev)/(d/n)<=.8,`${c.id} grade ${x},${z}: ${Math.abs(y-prev)/(d/n)}`);assert.ok(y>WORLD.waterLevel+1);assert.ok(Math.abs(y-triangleHeight(x,z,heightAt))<=.02);assert.equal(querySolids(x,z,.65).filter(s=>s.y+s.h>y+.48).length,0,`${c.id} blocked ${x},${z}`);prev=y;low=Math.min(low,y);high=Math.max(high,y);}
    }if(c.guardIds){assert.ok(length>=350);assert.ok(high-low>=18,`${c.id} relief ${high-low}`);}else{const e=DUNGEON_ENTRANCES.find(e=>e.id===c.entranceId);assert.ok(e.ruin);assert.equal(e.x,c.points.at(-1).x);assert.equal(e.z,c.points.at(-1).z);}
  }
});
test('all surviving old prop and enemy identities are an exact subset of pre-edit whole world',()=>{
  const before=new Map(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/pre-crossroads-world.json.gz',import.meta.url)))).map(r=>[r[0],r]));assert.equal(before.size,23966);let count=0;
  for(let x=-16;x<16;x++)for(let z=-16;z<16;z++){const c=getChunk(x,z);for(const s of [...c.props,...c.spawns]){if(CORRIDOR_GUARDS.some(g=>g.id===s.id))continue;assert.deepEqual([s.id,s.type,s.x,s.z],before.get(s.id),s.id);count++;}}
  assert.ok(count<before.size);assert.ok(count>before.size*.9);
});
for(const c of CORRIDORS)test(`ordinary bidirectional walking ${c.id}`,()=>{
  const s=createGame(),p=c.points[0]; // Explicit town-start fixture: movement/rewards remain ordinary.
  Object.assign(s.player,{x:p.x,z:p.z,y:heightAt(p.x,p.z),grounded:true});
  const driver={state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;}};
  runCorridor(driver,c.id);runCorridor(driver,c.id,{reverse:true});assert.equal(s.metrics.falls,0);assert.notEqual(s.mode,'dead');assert.ok(s.metrics.distance>=700);
});

test('fresh unmodified game walks first corridor out and back without travel shortcuts',()=>{
 const s=createGame(),driver={state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;}};
 runCorridor(driver,CORRIDORS[0].id,{freshStart:true});runCorridor(driver,CORRIDORS[0].id,{reverse:true});assert.equal(s.metrics.falls,0);assert.ok(s.metrics.distance>1500);assert.notEqual(s.mode,'dead');
});

for(const c of CORRIDORS)test(`fresh ordinary combat earns ${c.cacheId} with durable nonrespawning guards`,async()=>{
  const {runCorridorCache}=await import('./corridor-combat-routes.mjs');
  const {learnSkill,equipSkill}=await import('../progression.mjs');
  const {exportSave,loadSave}=await import('../sim.mjs');
  const {frontierPress}=await import('./frontier-routes.mjs');
  let s=createGame();
  const driver={state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;},learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot)};
  const result=runCorridorCache(driver,c.id);assert.equal(result.falls,0);assert.ok(result.kills>=2);
  const rewards=()=>JSON.stringify({xp:s.adventure.xp,materials:s.village.materials,crystals:s.player.crystals,chests:s.progress.chests});
  const once=rewards();frontierPress(driver,'interact');assert.equal(rewards(),once,'repeat interaction must not pay twice');
  s=loadSave(exportSave(s));assert.ok(s.progress.chests.includes(c.cacheId));for(const id of c.guardIds)assert.equal(s.adventure.worldDefeated[id],true);
  const reloaded=rewards();runCorridorCache(driver,c.id,{freshStart:false});
  assert.equal(rewards(),reloaded,'physical re-entry after reload must not pay twice');
  assert.ok(c.guardIds.every(id=>!s.enemies.some(e=>e.id===id&&e.hp>0)),'actually revisited guard chunks must not respawn defeated guards');
});
