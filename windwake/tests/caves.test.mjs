import test from 'node:test';
import assert from 'node:assert/strict';
import {CAVES,floorSurface} from '../caves.mjs';
import {DUNGEONS,dungeonFloor,dungeonGeometry,validateExpedition} from '../dungeons.mjs';
import {runCaveRoute} from './cave-routes.mjs';
import {recipeUnlocked} from '../village.mjs';
import {createGame,stepGame,restoreSnapshot,exportSave,loadSave} from '../sim.mjs';

test('natural caves have enclosed connected vertical spaces and distinct wind/relay puzzles',()=>{
  assert.deepEqual(CAVES.map(d=>d.id),['cave-canyon','cave-mistwood']);
  for(const d of CAVES){
    assert.ok(DUNGEONS.includes(d));assert.ok(d.rooms.length>=4);
    const heights=d.rooms.map(r=>r.y);assert.ok(Math.max(...heights)-Math.min(...heights)>=8);
    assert.ok(d.walls.some(w=>w.kind==='ceiling'));assert.ok(d.floors.some(f=>f.kind==='ramp'));
    assert.ok(d.landmarks.some(l=>l.kind==='chest'));assert.ok(d.landmarks.some(l=>l.kind==='exit'));
    const seen=new Set([d.rooms[0].id]);for(let i=0;i<d.rooms.length;i++)for(const [a,b] of d.links){if(seen.has(a))seen.add(b);if(seen.has(b))seen.add(a);}assert.equal(seen.size,d.rooms.length);
  }
  assert.ok(CAVES[0].puzzles.some(q=>q.type==='plate'));assert.ok(CAVES[1].puzzles.some(q=>q.type==='relays'));
});
test('cave slope collision samples the same corner interpolation used by rendering',()=>{
  for(const d of CAVES){const s=createGame();s.expedition=validateExpedition({active:{id:d.id}});
    for(const f of d.floors.filter(f=>f.kind==='ramp'))for(let i=1;i<20;i++){
      const t=i/20,x=f.axis==='x'?f.x-f.w/2+f.w*t:f.x,z=f.axis==='z'?f.z-f.d/2+f.d*t:f.z;
      assert.ok(Math.abs(dungeonFloor(s,x,z)-floorSurface(f,x,z))<1e-6);
      assert.ok(Math.abs(f.high-f.low)/(f.axis==='x'?f.w:f.d)<=.8);
    }
    assert.equal(dungeonGeometry(s).natural,true);
  }
});
test('cave progress restores only authored proofs, at safe entry, without duplicate completion',()=>{
  for(const d of CAVES){
    const s=createGame();s.expedition=validateExpedition({active:{id:d.id},progress:{[d.id]:{killed:['forged'],solved:[],opened:[],claimed:true}}});
    assert.equal(s.expedition.progress[d.id].claimed,false);
    const loaded=loadSave(exportSave(s));assert.equal(loaded.expedition.active.id,d.id);assert.equal(loaded.player.y,d.entry.y);
    assert.deepEqual(restoreSnapshot(loaded).expedition.active.blocks,loaded.expedition.active.blocks);
  }
});


const durableRewards=s=>({xp:s.adventure.xp,crystals:s.player.crystals,materials:structuredClone(s.village.materials),
  produce:structuredClone(s.village.produce),items:structuredClone(s.village.items)});
for(const cave of CAVES)test(`natural ${cave.id} fresh approach, puzzle, guarded treasure and clear survive reload without duplicate rewards`,t=>{
  const s=createGame(),heights=[],stages=[];let savedClear;
  const recipe=cave.id==='cave-canyon'?'repairKit':'growthTonic';
  assert.equal(recipeUnlocked(s,recipe),false);
  const driver={state:()=>structuredClone(s),step(n,input){
    for(let i=0;i<n;i++){
      stepGame(s,input);
      if(s.expedition.active){heights.push(s.player.y);assert.ok(s.enemies.every(e=>e.dungeonId===cave.id),'no outdoor actors in local scene');}
      assert.ok(s.enemies.length<=64);
    }
    return structuredClone(s);
  },onCheckpoint(point){
    stages.push(point.stage);
    if(point.stage===`${cave.id}-high-gallery`){
      const proof=structuredClone(s.expedition.progress[cave.id]),saved=loadSave(JSON.parse(JSON.stringify(exportSave(s))));
      assert.equal(saved.expedition.active.id,cave.id);assert.equal(saved.player.y,cave.entry.y);
      assert.equal(saved.player.x,cave.entry.x);assert.equal(saved.player.z,cave.entry.z);
      assert.deepEqual(saved.expedition.progress[cave.id],proof);assert.equal(proof.claimed,false);
      assert.ok(proof.opened.includes(`${cave.id}:side-cache`));assert.equal(recipeUnlocked(saved,recipe),false);
    }
    if(point.stage===`${cave.id}-cleared`)savedClear=JSON.parse(JSON.stringify(exportSave(s)));
  }};
  const result=runCaveRoute(driver,cave.id);
  assert.equal(result.falls,0);assert.ok(Math.max(...heights)-Math.min(...heights)>=8);
  assert.ok(stages.includes(`${cave.id}-side-cache`));assert.ok(stages.includes(`${cave.id}-high-gallery`));
  assert.deepEqual(new Set(result.progress.killed),new Set(cave.spawns.map(e=>e.id)));
  assert.deepEqual(result.progress.solved,[`${cave.id}:seal`]);assert.equal(result.progress.claimed,true);
  assert.equal(recipeUnlocked(s,recipe),true);assert.ok(s.enemies.every(e=>!e.dungeonId),'local actors do not leak after exit');
  const endLoad=loadSave(JSON.parse(JSON.stringify(exportSave(s))));
  assert.equal(endLoad.expedition.active,null);assert.deepEqual(endLoad.expedition.progress[cave.id],result.progress);
  assert.equal(recipeUnlocked(endLoad,recipe),true);assert.deepEqual(durableRewards(endLoad),durableRewards(s));

  // Reload the earned active clear at its safe entry, then physically revisit
  // every chamber, attempt the same cache and exit again. No grants/state edits.
  const replay=loadSave(savedClear),before=durableRewards(replay);
  assert.equal(replay.player.y,cave.entry.y);assert.equal(recipeUnlocked(replay,recipe),true);
  const replayDriver={state:()=>structuredClone(replay),step(n,input){for(let i=0;i<n;i++)stepGame(replay,input);return structuredClone(replay);}};
  runCaveRoute(replayDriver,cave.id,{approach:false});
  assert.deepEqual(durableRewards(replay),before,'cache, guardians and completion are exactly once across reload');
  assert.deepEqual(replay.expedition.progress[cave.id],result.progress);
  assert.equal(replay.metrics.falls,0);assert.ok(replay.enemies.every(e=>!e.dungeonId));
  t.diagnostic(JSON.stringify(result));
});
