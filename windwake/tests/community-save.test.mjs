import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,exportSave,loadSave,snapshot,restoreSnapshot,enterExpedition,stepGame,spawnEnemy} from '../sim.mjs';
import {VILLAGE,DUNGEON_ENTRANCES,heightAt} from '../world.mjs';
import {DUNGEONS} from '../dungeons.mjs';
import {villageAction,recipeUnlocked} from '../village.mjs';

// Controlled persisted-proof fixtures; no ordinary-route completion claim.
function withResident(){
  const s=createGame(137),x=VILLAGE.x+8,z=VILLAGE.z;
  Object.assign(s.player,{x:x-3.8,y:heightAt(x-3.8,z),z});
  assert.equal(villageAction(s,'build',{type:'cottage',x,z}).ok,true);
  Object.assign(s.player,{x:VILLAGE.x,y:heightAt(VILLAGE.x,VILLAGE.z),z:VILLAGE.z});
  s.journey.quests['quest-coast-local']=2;s.journey.quests['quest-coast-regional']=2;
  s.adventure.waypoints.push('waypoint-coast');s.adventure.bosses.push('boss-coast');
  assert.equal(villageAction(s,'invite',{id:'resident-coast'}).ok,true);
  assert.equal(villageAction(s,'assign',{id:'resident-coast',job:'artisan'}).ok,true);
  s.village.residents[0].timer=4.25;
  return s;
}
function proof(s,id){const d=DUNGEONS.find(d=>d.id===id);s.expedition.progress[id]={claimed:true,killed:d.spawns.filter(e=>e.required).map(e=>e.id),solved:d.puzzles.filter(p=>p.required).map(p=>p.id),opened:[]};}

test('durable reload keeps validated recruit job/timer and consumed crop inventory without replay',()=>{
  const s=withResident();s.village.produce={turnip:0,wheat:2,pumpkin:3,moonflower:0};s.village.items={trailMeal:0,repairKit:1,growthTonic:0};proof(s,'cave-canyon');
  const save=exportSave(s),loaded=loadSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(loaded.village.residents,s.village.residents);assert.deepEqual(loaded.village.produce,s.village.produce);assert.deepEqual(loaded.village.items,s.village.items);assert.equal(recipeUnlocked(loaded,'repairKit'),true);
  const twice=loadSave(exportSave(loaded));assert.deepEqual(twice.village.residents,loaded.village.residents);assert.deepEqual(twice.village.materials,loaded.village.materials);assert.equal(twice.adventure.xp,loaded.adventure.xp);
});
test('both restore paths reject invented allies and unsupported regional/local claims',()=>{
  for(const corrupt of [s=>{s.adventure.bosses=[];},s=>{s.adventure.waypoints=['home'];},s=>{s.journey.quests['quest-coast-local']=0;},s=>{s.journey.quests['quest-coast-regional']=0;s.journey.allies=['town-coast'];}]){
    const s=withResident();corrupt(s);assert.deepEqual(loadSave(exportSave(s)).village.residents,[]);assert.deepEqual(restoreSnapshot(snapshot(s)).village.residents,[]);
  }
});
test('dungeon-backed regional recruit requires encounter and puzzle proofs on both restore paths',()=>{
  const s=withResident();s.village.residents=[{id:'resident-canyon',job:'guard',timer:1.2}];s.journey.quests['quest-canyon-local']=2;s.journey.quests['quest-canyon-regional']=2;s.adventure.completedTasks.push('trial-canyon');
  s.expedition.progress['dungeon-canyon']={claimed:true,killed:[],solved:[],opened:[]};
  assert.deepEqual(loadSave(exportSave(s)).village.residents,[]);assert.deepEqual(restoreSnapshot(snapshot(s)).village.residents,[]);
  proof(s,'dungeon-canyon');assert.deepEqual(loadSave(exportSave(s)).village.residents,s.village.residents);assert.deepEqual(restoreSnapshot(snapshot(s)).village.residents,s.village.residents);
});
test('snapshot resident proof normalization preserves live cave transients and deterministic continuation',()=>{
  const s=withResident(),entrance=DUNGEON_ENTRANCES.find(e=>e.id==='cave-canyon');Object.assign(s.player,{x:entrance.x,y:entrance.y,z:entrance.z});assert.equal(enterExpedition(s,entrance.id).ok,true);
  const active=s.expedition.active;active.sequenceSteps.fixture=2;active.plateCharges.fixture=.75;if(active.blocks.length)active.blocks[0].x+=.2;
  s.player.abilityCooldowns.sunbolt=2.3;s.previousInput={interact:true};spawnEnemy(s,'stalker',s.player.x+12,s.player.z,s.player.y,{id:'snapshot-cave-fixture',dungeonId:entrance.id,timer:.731});
  const restored=restoreSnapshot(snapshot(s));assert.deepEqual(restored.expedition.active,s.expedition.active);assert.deepEqual(restored.enemies,s.enemies);assert.deepEqual(restored.fieldState,s.fieldState);assert.deepEqual(restored.village.residents,s.village.residents);assert.deepEqual(restored.player.abilityCooldowns,s.player.abilityCooldowns);
  for(let i=0;i<30;i++){stepGame(s,{});stepGame(restored,{});}assert.deepEqual(snapshot(restored),snapshot(s));
});
test('active-cave durable reload validates recruits before safely resetting cave entry',()=>{
  const s=withResident(),e=DUNGEON_ENTRANCES.find(e=>e.id==='cave-mistwood');Object.assign(s.player,{x:e.x,y:e.y,z:e.z});assert.equal(enterExpedition(s,e.id).ok,true);
  const loaded=loadSave(exportSave(s));assert.equal(loaded.expedition.active.id,e.id);assert.deepEqual(loaded.village.residents,s.village.residents);
  s.adventure.bosses=[];assert.deepEqual(loadSave(exportSave(s)).village.residents,[]);
});
test('legacy v3 snapshot adds new inventory defaults before harvest without resetting live state',()=>{
  const s=createGame(),x=VILLAGE.x-8,z=VILLAGE.z+4;Object.assign(s.player,{x,y:heightAt(x,z),z});const built=villageAction(s,'build',{type:'plot',x,z});assert.equal(built.ok,true);
  const plot=s.village.plots[0];Object.assign(plot,{crop:'turnip',watered:true,growth:45,stage:'ripe'});delete s.village.produce;delete s.village.items;delete s.village.residents;
  s.enemies[0].timer=.731;s.player.abilityCooldowns.sunbolt=2.3;const restored=restoreSnapshot(snapshot(s));
  assert.deepEqual(restored.enemies,s.enemies);assert.deepEqual(restored.village.plots,s.village.plots);assert.deepEqual(restored.player.abilityCooldowns,s.player.abilityCooldowns);
  assert.deepEqual(restored.village.items,{trailMeal:0,repairKit:0,growthTonic:0});assert.deepEqual(restored.village.residents,[]);
  const food=restored.village.materials.food;assert.equal(villageAction(restored,'harvest',{id:built.id}).ok,true);assert.equal(restored.village.materials.food,food+3);assert.equal(restored.village.produce.turnip,1);assert.equal(villageAction(restored,'harvest',{id:built.id}).ok,false);assert.equal(restored.village.materials.food,food+3);
});
test('snapshot bounds only new community inventories while preserving valid live raid and plot timing',()=>{
  const s=createGame();s.village.produce={turnip:Infinity,wheat:-2,pumpkin:99999,moonflower:2.8};s.village.items={trailMeal:NaN,repairKit:1e8,growthTonic:-1};s.village.raid.timer=.731;s.village.elapsed=8.125;s.enemies[0].timer=.349;
  const restored=restoreSnapshot(snapshot(s));assert.deepEqual(restored.village.produce,{turnip:0,wheat:0,pumpkin:9999,moonflower:2});assert.deepEqual(restored.village.items,{trailMeal:0,repairKit:9999,growthTonic:0});assert.deepEqual(restored.village.raid,s.village.raid);assert.equal(restored.village.elapsed,8.125);assert.deepEqual(restored.enemies,s.enemies);
});
