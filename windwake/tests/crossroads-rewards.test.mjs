import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,stepGame,exportSave,loadSave,snapshot,restoreSnapshot} from '../sim.mjs';
import {RELICS,grantRelic,equipRelic} from '../relics.mjs';
import {DUNGEONS} from '../dungeons.mjs';
import {TOWNS,CORRIDORS,VILLAGE,heightAt} from '../world.mjs';
import {regionalGuidance} from '../journey-ui.mjs';
import {villageAction,tickVillage} from '../village.mjs';

// Controlled proof/effect fixtures isolate validation and effect application.
// They do not substitute for the separate fresh walking/combat dungeon routes.
const ids=['relic-tide','relic-canopy'];
function proved(s,id){const d=DUNGEONS.find(d=>d.id===RELICS[id].sourceId);assert.ok(d);s.expedition.progress[d.id]={claimed:true,killed:d.spawns.filter(e=>e.required).map(e=>e.id),solved:d.puzzles.filter(p=>p.required).map(p=>p.id),opened:[]};grantRelic(s,id);}
function ticks(s,n,input={}){for(let i=0;i<n;i++)stepGame(s,input);}
function calm(){const s=createGame(123);s.enemies=[];return s;}

test('ten relics preserve all eight legacy sources and two unique equipment slots',()=>{
  assert.equal(Object.keys(RELICS).length,10);
  for(const biome of ['sunfields','canyon','mistwood','alpine','dunes','coast','autumn','lavender'])assert.equal(RELICS[`relic-${biome}`].sourceId,['sunfields','canyon','mistwood','alpine'].includes(biome)?`dungeon-${biome}`:`quest-${biome}-regional`);
  assert.deepEqual(RELICS['relic-tide'].effects,{stamina:15,speed:.04});assert.deepEqual(RELICS['relic-canopy'].effects,{energy:10,harvest:.15});
  const s=calm();ids.forEach(id=>proved(s,id));assert.deepEqual(s.journey.equipped,ids);assert.equal(equipRelic(s,ids[0],2).ok,false);assert.equal(grantRelic(s,ids[0]).ok,false);
});

for(const id of ids)test(`${id} ownership survives both restore paths only with its own complete dungeon proof`,()=>{
  const s=calm();proved(s,id);
  for(const [serialize,restore] of [[exportSave,loadSave],[snapshot,restoreSnapshot]]){
    const raw=serialize(s),valid=restore(structuredClone(raw));assert.ok(valid.journey.relics.includes(id));assert.ok(valid.journey.equipped.includes(id));
    const source=RELICS[id].sourceId,d=DUNGEONS.find(d=>d.id===source);
    for(const missing of ['killed','solved']){const forged=structuredClone(raw);forged.expedition.progress[source][missing]=[];const loaded=restore(forged);assert.equal(loaded.journey.relics.includes(id),false,missing);assert.equal(loaded.journey.equipped.includes(id),false);}
    const swapped=structuredClone(raw);delete swapped.expedition.progress[source];const other=ids.find(other=>other!==id),otherDungeon=DUNGEONS.find(d=>d.id===RELICS[other].sourceId);swapped.expedition.progress[otherDungeon.id]={claimed:true,killed:otherDungeon.spawns.map(e=>e.id),solved:otherDungeon.puzzles.map(q=>q.id),opened:[]};assert.equal(restore(swapped).journey.relics.includes(id),false);
    const absent=structuredClone(raw);delete absent.expedition;assert.equal(restore(absent).journey.relics.includes(id),false);
    assert.ok(d.spawns.some(e=>e.required)&&d.puzzles.some(p=>p.required));
  }
});

test('equipped tide changes actual movement and recoverable stamina versus owned unequipped tide',()=>{
  const equipped=calm(),plain=calm();for(const s of [equipped,plain])proved(s,ids[0]);equipRelic(plain,null,0);
  const start=equipped.player.z;ticks(equipped,90,{moveZ:1});ticks(plain,90,{moveZ:1});
  assert.ok(equipped.player.z-start>plain.player.z-start+.2);assert.equal(equipped.player.maxStamina,115);assert.equal(plain.player.maxStamina,100);
  for(const s of [equipped,plain])s.player.stamina=0;ticks(equipped,330);ticks(plain,330);assert.equal(equipped.player.stamina,115);assert.equal(plain.player.stamina,100);
});

test('equipped canopy restores additional usable energy and increases actual pumpkin harvest',()=>{
  function sample(equipped){const s=calm();proved(s,ids[1]);if(!equipped)equipRelic(s,null,0);s.player.energy=0;ticks(s,1200);const energy=s.player.energy;
    const x=VILLAGE.x+8,z=VILLAGE.z;Object.assign(s.player,{x:x-3,y:heightAt(x-3,z),z});const built=villageAction(s,'build',{type:'plot',x,z});assert.equal(built.ok,true);
    Object.assign(s.player,{x,y:heightAt(x,z),z});s.village.seeds.pumpkin=1;assert.equal(villageAction(s,'plant',{id:built.id,crop:'pumpkin'}).ok,true);assert.equal(villageAction(s,'water',{id:built.id}).ok,true);
    for(let i=0;i<111;i++)tickVillage(s,1);const before=s.village.materials.food,result=villageAction(s,'harvest',{id:built.id});assert.equal(result.ok,true);assert.equal(s.village.materials.food-before,result.food);return {energy,max:s.player.maxEnergy,food:result.food};}
  assert.deepEqual(sample(false),{energy:100,max:100,food:8});assert.deepEqual(sample(true),{energy:110,max:110,food:9});
});

test('four route guides cover the existing eight towns and explain the two distinct ruins',()=>{
  assert.equal(CORRIDORS.length,4);assert.equal(new Set(CORRIDORS.flatMap(r=>[r.fromTownId,r.toTownId])).size,8);
  for(const town of TOWNS){const route=CORRIDORS.find(r=>[r.fromTownId,r.toTownId].includes(town.id));assert.ok(regionalGuidance(town.id).includes(route.name));}
  assert.match(regionalGuidance('town-coast'),/릴레이/);assert.match(regionalGuidance('town-autumn'),/높이/);
});
