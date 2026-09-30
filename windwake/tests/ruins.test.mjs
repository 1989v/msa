import test from 'node:test';
import assert from 'node:assert/strict';
import {RUINS} from '../ruins.mjs';
import {floorSurface} from '../caves.mjs';
import {validateExpedition,dungeonAction,tickDungeon,normalizeCrossroadsExpeditionSnapshot,dungeonGeometry} from '../dungeons.mjs';
function fixture(d=RUINS[0]){return {mode:'playing',frame:100,player:{...d.entry},enemies:[],expedition:validateExpedition({active:{id:d.id}})};}
function node(s,d,index){const l=d.landmarks.find(l=>l.index===index);Object.assign(s.player,l);return dungeonAction(s,'interact',{id:l.id});}
for(const d of RUINS)test(`${d.id} independent decks, shared ramp heights, required guardian and optional caches`,()=>{
 assert.equal(d.expansion,'crossroads');assert.ok(d.rooms.length>=4);
 assert.ok(Math.max(...d.rooms.map(r=>r.y))-Math.min(...d.rooms.map(r=>r.y))>=(d.theme==='tide'?6:16));
 for(let i=0;i<d.floors.length;i++)for(const b of d.floors.slice(i+1)){const a=d.floors[i];assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2-1e-9||Math.abs(a.z-b.z)>=(a.d+b.d)/2-1e-9,`${a.id} overlaps ${b.id}`);}
 for(const f of d.floors.filter(f=>f.kind==='ramp')){assert.ok(Math.abs(f.high-f.low)/(f.axis==='x'?f.w:f.d)<=.8);assert.equal(floorSurface(f,f.x,f.z),(f.low+f.high)/2);}
 const s=fixture(d),p=s.expedition.progress[d.id];p.solved=d.puzzles.map(q=>q.id);p.killed=d.spawns.filter(e=>e.required&&e.type!=='boss').map(e=>e.id);tickDungeon(s,1/60);assert.equal(p.claimed,false);
 p.killed=d.spawns.filter(e=>e.required).map(e=>e.id);let grants=0;tickDungeon(s,1/60,{grantRelic:()=>grants++});tickDungeon(s,1/60,{grantRelic:()=>grants++});assert.equal(grants,1);assert.equal(p.claimed,true);assert.deepEqual(p.opened,[]);
 const archive=d.landmarks.find(l=>l.afterClear&&l.kind==='chest');Object.assign(s.player,archive);assert.equal(dungeonAction(s,'interact',{id:archive.id}).ok,true);assert.equal(dungeonAction(s,'interact',{id:archive.id}).ok,false);
});
for(const offset of [-1,0,1])test(`timed finish at deadline ${offset} has strict frame boundary`,()=>{const d=RUINS[0],s=fixture(d),q=d.puzzles[0];node(s,d,0);node(s,d,1);s.frame=100+q.limitFrames+offset;node(s,d,2);assert.equal(s.expedition.progress[d.id].solved.includes(q.id),offset<0);});
test('wrong order resets, expiry retries freely, solved circuit never resets',()=>{const d=RUINS[0],s=fixture(d),q=d.puzzles[0];node(s,d,0);node(s,d,2);assert.deepEqual(s.expedition.active.timedCircuits,{});node(s,d,0);s.frame+=q.limitFrames;tickDungeon(s,1/60);assert.deepEqual(s.expedition.active.timedCircuits,{});node(s,d,0);node(s,d,1);node(s,d,2);s.frame+=q.limitFrames*2;node(s,d,0);tickDungeon(s,1/60);assert.ok(s.expedition.progress[d.id].solved.includes(q.id));});
test('snapshot preserves exact timer and other active state; safe-entry load resets timer',()=>{const d=RUINS[0],s=fixture(d),q=d.puzzles[0];node(s,d,0);s.frame+=30;s.expedition.active.blocks=[{id:'legitimate',x:2}];s.enemies=[{id:'live',hp:50}];const copy=structuredClone(s);normalizeCrossroadsExpeditionSnapshot(copy);assert.deepEqual(copy,s);assert.equal(dungeonGeometry(copy).landmarks.find(l=>l.index===0).remainingSeconds,(q.limitFrames-30)/60);assert.deepEqual(validateExpedition(s.expedition).active.timedCircuits,{});node(copy,d,1);node(s,d,1);assert.deepEqual(copy,s);});
for(const d of RUINS)test(`${d.id} forged clear/archive proof and missing fields safely normalize`,()=>{const archive=d.landmarks.find(l=>l.kind==='chest'&&l.afterClear),s=fixture(d);s.expedition.progress[d.id]={claimed:true,killed:[],solved:[],opened:[archive.id]};normalizeCrossroadsExpeditionSnapshot(s);assert.equal(s.expedition.progress[d.id].claimed,false);assert.deepEqual(s.expedition.progress[d.id].opened,[]);delete s.expedition.active.timedCircuits;normalizeCrossroadsExpeditionSnapshot(s);assert.deepEqual(s.expedition.active.timedCircuits,{});});

import {createGame,stepGame,exportSave,loadSave,snapshot,restoreSnapshot} from '../sim.mjs';
import {learnSkill,equipSkill} from '../progression.mjs';
import {townAction} from '../settlements.mjs';
import {runRuinRoute} from './ruin-routes.mjs';
for(const d of RUINS)test(`${d.id} fresh road journey, real clear and optional/archive caches survive save`,()=>{
 const s=createGame(),checkpoints=[],driver={state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;},learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot),town:(action,payload)=>townAction(s,action,payload),onCheckpoint:c=>checkpoints.push(c)};
 runRuinRoute(driver,d.id);assert.equal(s.metrics.falls,0);assert.equal(s.expedition.active,null);assert.equal(s.expedition.progress[d.id].opened.length,2);assert.ok(s.journey.relics.includes(d.relicId));
 const loaded=loadSave(exportSave(s));assert.deepEqual(loaded.expedition.progress[d.id],s.expedition.progress[d.id]);assert.ok(loaded.journey.relics.includes(d.relicId));
 for(const r of d.rooms)assert.ok(checkpoints.some(c=>c.room===r.id),`Missing physical room ${r.id}`);
});
test('simulation snapshot timer continuation replays exactly and expires on dispatched deadline frame',()=>{
 const d=RUINS[0],q=d.puzzles[0],s=createGame();s.expedition=validateExpedition({active:{id:d.id}});s.enemies=[];s.blocks=s.expedition.active.blocks;Object.assign(s.player,d.entry);node(s,d,0);node(s,d,1);
 s.frame=q.limitFrames-2;const finish=d.landmarks.find(l=>l.index===2);Object.assign(s.player,{x:finish.x,y:finish.y,z:finish.z,safeX:finish.x,safeY:finish.y,safeZ:finish.z});s.player.grounded=true;s.previousInput={};
 const replay=restoreSnapshot(snapshot(s));stepGame(s,{});stepGame(replay,{});assert.deepEqual(replay,s);
 stepGame(s,{interact:true});stepGame(replay,{interact:true});assert.deepEqual(replay,s);assert.ok(!s.expedition.progress[d.id].solved.includes(q.id));
});
for(const d of RUINS)test(`${d.id} fresh ordinary clear may skip guarded balcony and archive`,()=>{
 const s=createGame(),driver={state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;},learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot),town:(action,payload)=>townAction(s,action,payload)};
 runRuinRoute(driver,d.id,{optional:false,archive:false});const p=s.expedition.progress[d.id];assert.equal(p.claimed,true);assert.deepEqual(p.opened,[]);assert.ok(!p.killed.includes(`${d.id}:optional-guard`));assert.ok(s.journey.relics.includes(d.relicId));
});
