import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { valueNoise, fbm, triangleHeight, TERRAIN, terrainStats } from '../terrain.mjs';
import { WORLD, BIOMES, TOWNS, DUNGEON_ENTRANCES, BOSS_SITES, WAYPOINTS, heightAt, getChunk, spawnsNear, WORLD_GENERATION } from '../world.mjs';
import { createGame, stepGame } from '../sim.mjs';
import { runFrontierTrail } from './frontier-routes.mjs';

test('seeded coherent noise is reproducible, continuous and independent of sampling order',()=>{
  for(const [x,z] of [[-45.2,-.3],[0,0],[7.1,22.3]]){
    const expected=fbm(x,z,42);fbm(200,-500,9);
    assert.equal(fbm(x,z,42),expected);
    assert.notEqual(expected,fbm(x,z,43));
    assert.ok(Math.abs(valueNoise(x,z,42)-valueNoise(x+1e-6,z,42))<1e-4);
  }
});
test('triangle interpolation uses global NW-SE diagonal including negative cells',()=>{
  const vertex=(x,z)=>x*x+z*z+x*z;
  for(const x of [-60.8,-3.7,-.4,.8,60.4])for(const z of [-60.1,-2.2,.3,62.4]){
    const gx=Math.floor(x/3)*3,gz=Math.floor(z/3)*3,u=(x-gx)/3,v=(z-gz)/3;
    const a=vertex(gx,gz),b=vertex(gx+3,gz),c=vertex(gx+3,gz+3),d=vertex(gx,gz+3);
    const expected=u>=v?a*(1-u)+b*(u-v)+c*v:a*(1-v)+d*(v-u)+c*u;
    assert.ok(Math.abs(triangleHeight(x,z,vertex)-expected)<1e-9);
  }
});
test('outer ground equals rendered three-metre triangles and chunk seams',()=>{
  for(const b of BIOMES)for(let i=0;i<100;i++){
    const x=b.x-90+i*1.731,z=b.z-90+i*1.319;
    assert.ok(Math.abs(heightAt(x,z)-triangleHeight(x,z,heightAt))<=.02);
  }
  for(const x of [-780,-300,-180,180,300,780])for(let z=-900;z<=900;z+=37){
    assert.ok(Math.abs(heightAt(x-1e-6,z)-heightAt(x+1e-6,z))<=.001);
  }
  for(let along=-120;along<=120;along+=1.5)for(const side of [-120,120]){
    assert.ok(Math.abs(heightAt(side-1e-6,along)-heightAt(side+1e-6,along))<=.001,`core X seam ${side},${along}`);
    assert.ok(Math.abs(heightAt(along,side-1e-6)-heightAt(along,side+1e-6))<=.001,`core Z seam ${along},${side}`);
  }
  assert.ok(terrainStats().cachedVertices<=TERRAIN.maxCachedVertices);
});
test('biome windows have climbable relief while all town floors stay level',()=>{
  const pads=[...TOWNS.map(p=>({...p,r:31})),...DUNGEON_ENTRANCES.map(p=>({...p,r:10})),...BOSS_SITES.map(p=>({...p,r:28})),...WAYPOINTS.map(p=>({...p,r:10}))];
  const relief=BIOMES.map(b=>{const h=[];for(let x=-90;x<=90;x+=6)for(let z=-90;z<=90;z+=6)if(pads.every(p=>Math.hypot(b.x+x-p.x,b.z+z-p.z)>p.r))h.push(heightAt(b.x+x,b.z+z));return Math.max(...h)-Math.min(...h);});
  assert.ok(relief.filter(h=>h>=18).length>=6,JSON.stringify(relief));
  for(const t of TOWNS)for(let a=0;a<16;a++)assert.ok(Math.abs(heightAt(t.x+Math.cos(a)*24,t.z+Math.sin(a)*24)-t.floor)<1e-9);
});
test('fresh ordinary frontier traversal actually streams materially denser nearby threats',()=>{
  const s=createGame(),seen=new Set();let peak=0;
  const driver={state:()=>s,step(n,input){for(let i=0;i<n;i++){
    stepGame(s,input);peak=Math.max(peak,s.enemies.length);
    for(const e of s.enemies)if(e.hp>0&&e.id.startsWith('wild-')&&Math.hypot(e.x-s.player.x,e.z-s.player.z)<20&&Math.abs(e.y-s.player.y)<6)seen.add(e.id);
  }return s;}};
  runFrontierTrail(driver,'route-sunfields');
  assert.ok(s.metrics.distance>390);
  assert.ok(seen.size>=10,`actual nearby living threats ${seen.size}; baseline corridor contained five`);
  assert.ok(peak<=64);
  assert.notEqual(s.mode,'dead');
});
test('authored analytic core stays within twelve centimetres of its refined mesh',()=>{
  let maximum=0;
  for(let x=-120;x<=120;x+=.5)for(let z=-120;z<=120;z+=.5)maximum=Math.max(maximum,Math.abs(heightAt(x,z)-triangleHeight(x,z,heightAt,1.5)));
  assert.ok(maximum<=.12,`core mesh error ${maximum}`);
});
test('continuous ordinary climb and descent gain at least fifteen metres',()=>{
  const a={x:-55,z:-585},b={x:-120,z:-585},start=heightAt(a.x,a.z),top=heightAt(b.x,b.z);
  assert.ok(top-start>=15);
  for(let n=0;n<65;n++)assert.ok(Math.abs(heightAt(a.x-n-1,a.z)-heightAt(a.x-n,a.z))<=.55);
  assert.equal(heightAt(b.x+65,b.z),start);
  // Controlled start, then connected ordinary movement in both directions;
  // no teleport, HP grants, terrain bypass, or enemy removal during traversal.
  const s=createGame();Object.assign(s.player,{...a,y:start,vx:0,vy:0,vz:0,grounded:true,safeX:a.x,safeZ:a.z,safeY:start});
  const seen=new Set();
  for(const target of [b.x,a.x]){
    for(let frame=0;frame<1000&&Math.abs(s.player.x-target)>.5;frame++){
      stepGame(s,{moveX:Math.sign(target-s.player.x)});
      for(const enemy of s.enemies)if(enemy.hp>0&&Math.hypot(enemy.x-s.player.x,enemy.z-s.player.z)<20)seen.add(enemy.id);
      assert.notEqual(s.mode,'dead');
    }
    assert.ok(Math.abs(s.player.x-target)<.5,'ordinary walking reaches endpoint');
    if(target===b.x)assert.ok(s.player.y-start>=15);
  }
  assert.ok(Math.abs(s.player.y-start)<.3);
  assert.ok(seen.size>=3,'streamed living threats occur along the actual route');
  assert.equal(s.metrics.falls,0);
});
test('surviving legacy IDs remain a strict subset of the captured pre-crossroads population',()=>{
  const before=new Map(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/pre-crossroads-world.json.gz',import.meta.url)))).filter(r=>r[0].startsWith('wild-')&&!r[0].startsWith('wild-v2-')).map(r=>[r[0],r]));
  assert.equal(before.size,978);let survivors=0;
  for(let cx=-16;cx<16;cx++)for(let cz=-16;cz<16;cz++)for(const s of getChunk(cx,cz).spawns)if(s.id.startsWith('wild-')&&!s.id.startsWith('wild-v2-')){assert.deepEqual([s.id,s.type,s.x,s.z],before.get(s.id),s.id);survivors++;}
  assert.ok(survivors>900&&survivors<978);
});
test('dense outer encounters fit durable budget and avoid water, slopes, towns and props',()=>{
  let count=0;const ids=new Set();
  for(let cx=-16;cx<16;cx++)for(let cz=-16;cz<16;cz++)for(const s of getChunk(cx,cz).spawns){
    assert.ok(!ids.has(s.id));ids.add(s.id);
    if(!s.id.startsWith('wild-'))continue;
    count++;
    assert.ok(DUNGEON_ENTRANCES.every(e=>Math.hypot(s.x-e.x,s.z-e.z)>=42),s.id);
    assert.ok(s.y>=WORLD.waterLevel+1,s.id);
    if(s.id.startsWith('wild-v2-')){
      assert.ok(TOWNS.every(t=>Math.hypot(s.x-t.x,s.z-t.z)>t.radius+7));
      const chunk=getChunk(cx,cz);
      assert.ok(chunk.solids.every(p=>Math.abs(s.x-p.x)>p.w/2+1.1||Math.abs(s.z-p.z)>p.d/2+1.1),s.id);
      for(const [dx,dz] of [[1,0],[0,1]])assert.ok(Math.abs(heightAt(s.x+dx,s.z+dz)-s.y)<=.8,s.id);
    }
  }
  assert.ok(count>=1896*2,`ambient ${count}`);
  assert.ok(ids.size<WORLD_GENERATION.maxDurableIds);
  assert.ok(WORLD_GENERATION.maxDurableIds<=16384);
  for(const b of BIOMES)assert.ok(spawnsNear(b.x,b.z,110).filter(s=>s.id.startsWith('wild-')).length>=28,b.id);
});
