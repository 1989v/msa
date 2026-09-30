import test from 'node:test';
import assert from 'node:assert/strict';
import * as world from '../world.mjs';
import {createGame,spawnEnemy,stepGame,interact,exportSave,loadSave,snapshot,restoreSnapshot} from '../sim.mjs';
import {DUNGEONS} from '../dungeons.mjs';
import {enterExpedition,expeditionAction} from '../sim.mjs';

const at=(s,p)=>Object.assign(s.player,{x:p.x,y:p.y??world.heightAt(p.x,p.z),z:p.z});
const proof=(s,id)=>{const d=DUNGEONS.find(d=>d.id===id);assert.ok(d);s.expedition.progress[id]={killed:d.spawns.filter(e=>e.required).map(e=>e.id),solved:d.puzzles.filter(q=>q.required).map(q=>q.id),opened:[],claimed:true};};
test('required corridor guard admission evicts only untouched distant ambient at cap64',()=>{
 const s=createGame();s.enemies=[];
 for(let i=0;i<64;i++)spawnEnemy(s,'slime',s.player.x+70+i*.1,s.player.z,undefined,{id:`ambient-${i}`,frontier:true});
 const protectedActor=s.enemies[0];protectedActor.corridorId='protected';
 const guard=spawnEnemy(s,'sentinel',s.player.x+18,s.player.z,undefined,{id:'required-corridor-fixture',frontier:true,corridorId:'fixture'});
 assert.ok(guard);assert.equal(s.enemies.length,64);assert.ok(s.enemies.includes(protectedActor));
});
test('corridor cache requires both guards, pays once, and preserves defeat through both restore paths',()=>{
 assert.equal(world.CORRIDORS?.length,4);
 for(const route of world.CORRIDORS){
  const s=createGame(),chest=world.LANDMARKS.find(l=>l.id===route.cacheId);at(s,chest);
  const initial={crystals:s.player.crystals,xp:s.adventure.xp,materials:{...s.village.materials}};
  interact(s);assert.ok(!s.progress.chests.includes(chest.id));assert.equal(s.player.crystals,initial.crystals);
  s.adventure.worldDefeated[route.guardIds[0]]=true;interact(s);assert.ok(!s.progress.chests.includes(chest.id));
  s.adventure.worldDefeated[route.guardIds[1]]=true;interact(s);assert.ok(s.progress.chests.includes(chest.id));assert.ok(s.adventure.xp>initial.xp);
  const earned=s.player.crystals;interact(s);assert.equal(s.player.crystals,earned);
  for(const restored of [loadSave(exportSave(s)),restoreSnapshot(snapshot(s))]){assert.ok(restored.progress.chests.includes(chest.id));assert.equal(restored.player.crystals,earned);for(const id of route.guardIds)assert.equal(restored.adventure.worldDefeated[id],true);}
  delete s.adventure.worldDefeated[route.guardIds[1]];
  for(const restored of [loadSave(exportSave(s)),restoreSnapshot(snapshot(s))])assert.ok(!restored.progress.chests.includes(chest.id));
 }
});
test('new relic ownership and archive facts require authored clear proof on snapshot and durable restore',()=>{
 for(const [id,relic] of [['dungeon-tide','relic-tide'],['dungeon-canopy','relic-canopy']]){
  const s=createGame(),d=DUNGEONS.find(d=>d.id===id);assert.ok(d);
  const archive=d.landmarks.find(l=>l.kind==='chest'&&l.afterClear);assert.ok(archive);
  s.expedition.progress[id]={killed:[],solved:[],opened:[archive.id],claimed:true};s.journey.relics.push(relic);s.journey.equipped[0]=relic;
  for(const r of [loadSave(exportSave(s)),restoreSnapshot(snapshot(s))]){assert.equal(r.expedition.progress[id].claimed,false);assert.ok(!r.expedition.progress[id].opened.includes(archive.id));assert.ok(!r.journey.relics.includes(relic));assert.equal(r.journey.equipped[0],null);}
  proof(s,id);s.expedition.progress[id].opened=[archive.id];
  for(const r of [loadSave(exportSave(s)),restoreSnapshot(snapshot(s))]){assert.ok(r.journey.relics.includes(relic));assert.equal(r.journey.equipped[0],relic);assert.ok(r.expedition.progress[id].opened.includes(archive.id));}
 }
});

test('timed relay start, failure, retry and completion emit procedural audio events',()=>{
 const s=createGame(),d=DUNGEONS.find(d=>d.id==='dungeon-tide'),entrance=world.LANDMARKS.find(l=>l.id===d.id);at(s,entrance);assert.equal(enterExpedition(s,d.id).ok,true);
 const use=index=>{const l=d.landmarks.find(l=>l.kind==='rune'&&l.index===index);at(s,l);return expeditionAction(s,'interact',{id:l.id});};
 use(0);assert.ok(s.events.some(e=>e.type==='rune'));s.events=[];use(2);assert.ok(s.events.some(e=>e.type==='wrong'));
 use(0);s.frame=s.expedition.active.timedCircuits[d.puzzles[0].id].deadline-1;s.events=[];stepGame(s,{});assert.ok(s.events.some(e=>e.type==='wrong'));
 use(0);use(1);use(2);assert.ok(s.events.some(e=>e.type==='solve'));
});

for(const count of [40,64])test(`actual streaming admits both required corridor guards with ${count} ambient actors`,()=>{
 const s=createGame(),c=world.CORRIDORS[0],guard=world.CORRIDOR_GUARDS.find(g=>g.id===c.guardIds[0]);s.enemies=[];at(s,{x:guard.x,z:guard.z-25});
 for(let i=0;i<count;i++)spawnEnemy(s,'stalker',s.player.x+(count===40?20:75)+i*.05,s.player.z,undefined,{id:`ambient-cap-${i}`,frontier:true});
 stepGame(s,{});for(const id of c.guardIds){const actor=s.enemies.find(e=>e.id===id);assert.ok(actor,`missing ${id}`);assert.equal(actor.corridorId,c.id);}
 assert.ok(s.enemies.length<=64);
});
