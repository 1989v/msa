import test from 'node:test';
import assert from 'node:assert/strict';
import {DUNGEON_ENTRANCES} from '../world.mjs';
import {DUNGEONS,initExpedition,validateExpedition,dungeonGeometry,dungeonFloor,dungeonSolids,dungeonBounds,enterDungeon,leaveDungeon,dungeonAction,tickDungeon,recordDungeonKill,dungeonCleared} from '../dungeons.mjs';
import {createGame,stepGame} from '../sim.mjs';
import {learnSkill,equipSkill} from '../progression.mjs';
import {townAction} from '../settlements.mjs';
import {runDungeonRoute} from './dungeon-routes.mjs';

function fixture(id=DUNGEONS[0].id){
  const entry=DUNGEON_ENTRANCES.find(e=>e.id===id),s={mode:'playing',player:{...entry,hp:70},expedition:initExpedition(),enemies:[],village:{raid:{status:'idle'}}};
  const rewards={xp:0,materials:[],relics:[],transitions:[]};
  const hooks={transition:(kind,p)=>{rewards.transitions.push(kind);s.enemies=[];Object.assign(s.player,p);},spawn:(type,x,z,extra)=>{const e={type,x,z,...extra};s.enemies.push(e);return e;},rewardXP:n=>rewards.xp+=n,rewardMaterials:r=>rewards.materials.push(r),grantRelic:id=>rewards.relics.push(id),move:(b,dx,dz)=>{b.x+=dx;b.z+=dz;},ground:b=>{b.y=0;b.vy=0;}};
  assert.equal(enterDungeon(s,id,hooks).ok,true);return {s,hooks,rewards,d:DUNGEONS.find(d=>d.id===id)};
}
function interact(s,hooks,l){Object.assign(s.player,{x:l.x,y:l.y,z:l.z});return dungeonAction(s,'interact',{id:l.id},hooks);}

test('each authored layout has connected real chambers, sealed corridors, cover and a base-jump ascent',()=>{
  const shapes=new Set();
  for(const d of DUNGEONS){
    const {s}=fixture(d.id);assert.ok(d.rooms.length>=5);assert.ok(Object.isFrozen(d.rooms));
    const reached=new Set([d.rooms[0].id]);for(let i=0;i<d.rooms.length;i++)for(const [a,b] of d.links){if(reached.has(a))reached.add(b);if(reached.has(b))reached.add(a);}
    assert.equal(reached.size,d.rooms.length);
    shapes.add(JSON.stringify(d.rooms.map(r=>[r.kind,r.x,r.z])));
    for(const [a,b] of d.links){
      const from=d.rooms.find(r=>r.id===a),to=d.rooms.find(r=>r.id===b);
      for(let t=0;t<=1;t+=.02)assert.ok(dungeonFloor(s,from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t)>=0,'connected floors cannot hide a void');
    }
    const platforms=d.floors.filter(f=>f.kind==='platform').sort((a,b)=>a.h-b.h);
    assert.equal(platforms.length,2);assert.ok(platforms[0].h<=1.5&&platforms[1].h-platforms[0].h<=1.5);
    for(const p of platforms)assert.ok(dungeonSolids(s,p.x,p.z).some(b=>b.id===p.id));
    assert.ok(d.props.filter(p=>p.kind==='cover').length>=4);
    for(const door of dungeonGeometry(s).doors){assert.equal(door.open,false);assert.ok(dungeonSolids(s,door.x,door.z).some(b=>b.id===door.id));assert.ok(door.h>6);}
    assert.equal(dungeonFloor(s,dungeonBounds(s).minX-1,0),-12);
    assert.ok(d.spawns.some(e=>e.type==='boss'&&e.family&&!e.bossId));
  }
  assert.equal(shapes.size,4);
});

test('missing or capped actors cannot unlock a room; only an authored dead actor pays once',()=>{
  const {s,d,hooks,rewards}=fixture();const guard=d.rooms.find(r=>r.kind==='guard');Object.assign(s.player,guard);
  for(let i=0;i<3;i++)tickDungeon(s,1/60,{...hooks,spawn:()=>null});
  assert.deepEqual(s.expedition.progress[d.id].killed,[]);assert.equal(rewards.xp,0);
  tickDungeon(s,1/60,hooks);assert.equal(s.enemies.length,2);
  const door=d.doors.find(door=>door.requires.includes(s.enemies[0].id));
  assert.equal(recordDungeonKill(s,{...s.enemies[0],id:'forged',hp:0},hooks),false);
  assert.equal(recordDungeonKill(s,{...s.enemies[0],hp:1},hooks),false);
  for(const e of s.enemies){e.hp=0;assert.equal(recordDungeonKill(s,e,hooks),true);assert.equal(recordDungeonKill(s,e,hooks),false);}
  assert.equal(rewards.xp,20);assert.equal(dungeonGeometry(s).doors.find(d=>d.id===door.id).open,true);
  assert.ok(!dungeonSolids(s,door.x,door.z).some(b=>b.id===door.id));
  s.enemies=[];tickDungeon(s,1/60,hooks);assert.equal(s.enemies.length,0,'recorded kills must not respawn');
});

test('ordered runes require object proximity, recover from a wrong press, and persist their gate',()=>{
  const {s,d,hooks}=fixture('dungeon-mistwood'),q=d.puzzles.find(q=>q.type==='sequence');
  const rune=index=>d.landmarks.find(l=>l.puzzleId===q.id&&l.index===index);
  assert.equal(dungeonAction(s,'interact',{id:rune(2).id},hooks).ok,false);
  interact(s,hooks,rune(2));interact(s,hooks,rune(1));assert.equal(s.expedition.active.sequenceSteps[q.id],0);
  for(const index of q.order)interact(s,hooks,rune(index));
  assert.ok(s.expedition.progress[d.id].solved.includes(q.id));
  const loaded=validateExpedition(s.expedition);assert.ok(loaded.progress[d.id].solved.includes(q.id));assert.deepEqual(loaded.active.sequenceSteps,{});
  assert.equal(dungeonGeometry(s).doors.find(door=>door.requires.includes(q.id)).open,true);
});

test('relay combinations observe individual toggle states instead of accepting a supplied answer',()=>{
  const {s,d,hooks}=fixture('dungeon-alpine'),q=d.puzzles.find(q=>q.type==='relays');
  const levers=d.landmarks.filter(l=>l.puzzleId===q.id&&l.kind==='lever');
  for(const lever of levers)interact(s,hooks,lever);
  assert.ok(!s.expedition.progress[d.id].solved.includes(q.id),'all lights is the wrong alpine combination');
  interact(s,hooks,levers[1]);assert.ok(s.expedition.progress[d.id].solved.includes(q.id));
});

test('pressure seals require every real block to settle; Q-like motion and free reset are recoverable',()=>{
  const {s,d,hooks}=fixture('dungeon-mistwood'),q=d.puzzles.find(q=>q.type==='plate'),blocks=s.expedition.active.blocks;
  const reset=d.landmarks.find(l=>l.kind==='reset');
  blocks[0].vx=12;for(let i=0;i<180;i++)tickDungeon(s,1/60,hooks);
  assert.ok(!s.expedition.progress[d.id].solved.includes(q.id),'one block cannot satisfy a two-block seal');
  assert.ok(Math.abs(blocks[0].x-q.targets[0].x)<.3,'impulse should settle at the authored receiver');
  blocks[0].x=140;interact(s,hooks,reset);assert.deepEqual(blocks,d.blocks.map(b=>({...b})));
  blocks.forEach(b=>b.vx=12);for(let i=0;i<180;i++)tickDungeon(s,1/60,hooks);
  assert.ok(s.expedition.progress[d.id].solved.includes(q.id));
  const loaded=validateExpedition(s.expedition);assert.deepEqual(loaded.active.blocks,d.blocks.map(b=>({...b})));
  assert.ok(loaded.progress[d.id].solved.includes(q.id),'resetting authored positions on load retains completed gates');
});

test('chest and dungeon rewards require independent victories and survive retries without duplication',()=>{
  const {s,d,hooks,rewards}=fixture(),chest=d.landmarks.find(l=>l.kind==='chest');
  assert.equal(interact(s,hooks,chest).ok,false);
  const optional=d.spawns.find(e=>!e.required);assert.equal(recordDungeonKill(s,{...optional,dungeonId:d.id,hp:0},hooks),true);
  assert.equal(interact(s,hooks,chest).ok,true);assert.equal(interact(s,hooks,chest).ok,false);assert.equal(rewards.materials.length,1);
  for(const spawn of d.spawns.filter(e=>e.required))recordDungeonKill(s,{...spawn,dungeonId:d.id,hp:0},hooks);
  tickDungeon(s,1/60,hooks);assert.equal(dungeonCleared(s,d.id),false,'boss defeat alone cannot bypass puzzles');
  s.expedition.progress[d.id].solved=d.puzzles.map(q=>q.id); // isolated reward gate fixture, not natural route evidence
  tickDungeon(s,1/60,hooks);assert.equal(dungeonCleared(s,d.id),true);assert.deepEqual(rewards.relics,[d.relicId]);
  const paid=rewards.xp;for(let i=0;i<10;i++)tickDungeon(s,1/60,hooks);
  assert.equal(rewards.xp,paid);assert.equal(rewards.materials.length,2);
  s.expedition=validateExpedition(s.expedition);tickDungeon(s,1/60,hooks);assert.equal(rewards.xp,paid);
});

test('malformed durable state cannot restore arbitrary actors, solids, unchecked clears or chest claims',()=>{
  const d=DUNGEONS[0],raw={active:{id:d.id,roomId:'boss',blocks:[{x:Infinity}],sequenceSteps:{evil:99}},progress:{[d.id]:{killed:['fake','fake'],solved:['fake'],opened:[d.landmarks.find(l=>l.kind==='chest').id],claimed:true},unknown:{claimed:true}}};
  const restored=validateExpedition(raw);assert.deepEqual(restored.progress[d.id],{killed:[],solved:[],opened:[],claimed:false});assert.equal(Object.keys(restored.progress).length,1);
  assert.deepEqual(restored.active.blocks,d.blocks.map(b=>({...b})));assert.equal(restored.active.roomId,d.rooms[0].id);
  assert.equal(validateExpedition({active:{id:'__proto__'}}).active,null);
  for(const value of [null,1,'bad',[],{progress:{[d.id]:null}}])assert.equal(validateExpedition(value).active,null);
});

test('entry and exit enforce combat, raid and physical-distance boundaries without free healing',()=>{
  const {s,d,hooks,rewards}=fixture();const entry=d.landmarks.find(l=>l.kind==='exit'&&!l.afterClear);
  Object.assign(s.player,d.rooms.find(r=>r.kind==='boss'));assert.equal(leaveDungeon(s,hooks).ok,false);
  Object.assign(s.player,entry);assert.equal(leaveDungeon(s,hooks).ok,true);assert.equal(s.player.hp,70);
  const outside=DUNGEON_ENTRANCES.find(e=>e.id===d.id);Object.assign(s.player,outside);
  s.village.raid.status='active';assert.equal(enterDungeon(s,d.id,hooks).ok,false);s.village.raid.status='idle';
  s.enemies=[{...outside,hp:1}];assert.equal(enterDungeon(s,d.id,hooks).ok,false);s.enemies=[];
  s.player.z+=10;assert.equal(enterDungeon(s,d.id,hooks).ok,false);assert.deepEqual(rewards.transitions,['enter','leave']);
  for(const axis of ['x','y','z'])for(const value of [NaN,Infinity,-Infinity]){Object.assign(s.player,outside,{[axis]:value});assert.equal(enterDungeon(s,d.id,hooks).ok,false);}
});

test('render geometry is read-only and exposes partial puzzle lights without premature reward exits',()=>{
  const {s,d,hooks}=fixture(),q=d.puzzles.find(q=>q.type==='sequence');
  const before=structuredClone(s);dungeonGeometry(s);assert.deepEqual(s,before);
  assert.ok(!dungeonGeometry(s).landmarks.some(l=>l.afterClear));
  const first=d.landmarks.find(l=>l.puzzleId===q.id&&l.index===q.order[0]);interact(s,hooks,first);
  assert.equal(dungeonGeometry(s).landmarks.find(l=>l.id===first.id).active,true);
  assert.equal(dungeonGeometry(s).landmarks.find(l=>l.id===first.id).solved,false);
});

for(const dungeon of DUNGEONS)test(`natural ${dungeon.id} adventure walks every chamber, earns its relic and returns without state writes`,()=>{
  const s=createGame(),checkpoints=[];
  const driver={state:()=>structuredClone(s),step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return structuredClone(s);},
    learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot),town:(action,payload)=>townAction(s,action,payload),onCheckpoint:r=>checkpoints.push(r)};
  runDungeonRoute(driver,dungeon.id);
  assert.equal(s.expedition.active,null);assert.equal(s.expedition.progress[dungeon.id].claimed,true);
  assert.ok(s.journey.relics.includes(dungeon.relicId));assert.equal(s.metrics.falls,0);assert.ok(s.metrics.jumps>=2);
  for(const r of dungeon.rooms)assert.ok(checkpoints.some(c=>c.room===r.id),`The actual player never visited ${r.name}`);
  assert.ok(checkpoints.some(c=>c.position[1]===2.8),'Player must stand on the high terrace');
  const clear=checkpoints.find(c=>c.stage===`${dungeon.id}-cleared`);
  assert.ok(clear.openDoors.length===dungeon.doors.length);assert.equal(clear.progress.opened.length,1);
  assert.ok(s.metrics.distance>500,'Overworld approach must consist of real player movement');
  assert.equal(s.mode,'playing');assert.deepEqual(s.adventure.bosses,[]);assert.equal(s.progress.bossDefeated,false);
});
