import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,stepGame,enterExpedition,exitExpedition,exportSave,loadSave,respawn,snapshot,restoreSnapshot,fastTravel,spawnEnemy} from '../sim.mjs';
import {DUNGEON_ENTRANCES,TOWNS,WORLD,heightAt} from '../world.mjs';
import {townAction} from '../settlements.mjs';
import {DUNGEONS,dungeonGeometry,dungeonFloor} from '../dungeons.mjs';
import {villageAction} from '../village.mjs';

// Deliberately controlled integration fixtures; full walking journeys live in
// dungeon-routes.mjs. These isolate scene leakage, save and collision contracts.
function atEntrance(id='dungeon-sunfields'){
  const s=createGame(123),entry=DUNGEON_ENTRANCES.find(e=>e.id===id);
  Object.assign(s.player,{x:entry.x,y:entry.y,z:entry.z});
  return s;
}
function ticks(s,n,input={}){for(let i=0;i<n;i++)stepGame(s,input);return s;}

test('entry parks the world, preserves resources, freezes home, and blocks indoor world actions',()=>{
  const s=atEntrance(),worldIds=s.enemies.map(e=>e.id),clock=s.village.clock;
  s.player.hp=61;s.player.energy=55;s.player.abilityCooldowns.sunbolt=4;
  s.projectiles.push({id:'outdoor-projectile',life:2,x:0,y:1,z:0});
  assert.equal(enterExpedition(s,'dungeon-sunfields').ok,true);
  assert.deepEqual(s.fieldState.enemies.map(e=>e.id),worldIds);
  assert.equal(s.player.hp,61);assert.equal(s.player.energy,55);assert.equal(s.player.abilityCooldowns.sunbolt,4);
  assert.equal(s.projectiles.length,0);assert.equal(s.blocks,s.expedition.active.blocks);
  const saved=exportSave(s);assert.equal(saved.version,3);assert.equal('fieldState' in saved,false);
  ticks(s,60);
  assert.equal(s.village.clock,clock);assert.ok(s.enemies.every(e=>e.dungeonId));
  assert.equal(fastTravel(s,'home'),false);assert.equal(villageAction(s,'rest',{}).ok,false);
  assert.equal(s.progress.bossDefeated,false);assert.deepEqual(s.adventure.bosses,[]);
});

test('v3 reload and respawn retain dungeon context with a safe entry and restore outdoors on exit',()=>{
  const s=atEntrance('dungeon-canyon');assert.equal(enterExpedition(s,'dungeon-canyon').ok,true);
  ticks(s,10);const loaded=loadSave(exportSave(s)),dungeon=DUNGEONS.find(d=>d.id==='dungeon-canyon');
  assert.equal(loaded.expedition.active.id,dungeon.id);
  assert.equal(loaded.player.x,dungeon.entry.x);assert.equal(loaded.player.z,dungeon.entry.z);
  assert.equal(loaded.blocks,loaded.expedition.active.blocks);
  loaded.mode='dead';loaded.player.hp=0;respawn(loaded);
  assert.equal(loaded.mode,'playing');assert.equal(loaded.expedition.active.id,dungeon.id);
  const exit=dungeonGeometry(loaded).landmarks.find(l=>l.kind==='exit');
  Object.assign(loaded.player,{x:exit.x,y:exit.y,z:exit.z});
  assert.equal(exitExpedition(loaded).ok,true);assert.equal(loaded.expedition.active,null);
  assert.equal(loaded.player.y,heightAt(loaded.player.x,loaded.player.z));
  assert.ok(loaded.enemies.every(e=>!e.dungeonId));assert.equal(loaded.fieldState,undefined);
  assert.equal(loaded.projectiles.length,0);assert.equal(loaded.player.vy,0);
});

test('local dungeon coordinates cannot trigger the original updraft or underwater recovery plane',()=>{
  const s=atEntrance();assert.equal(enterExpedition(s,'dungeon-sunfields').ok,true);
  s.progress.sigils=['quarry','forest','ruins'];s.enemies=[];
  Object.assign(s.player,{x:0,z:5,y:6,vy:0,grounded:false});
  stepGame(s);assert.ok(s.player.vy<0,'outdoor updraft must be disabled');
  const entry=DUNGEONS[0].entry;Object.assign(s.player,{x:entry.x,z:entry.z,y:-4,vy:-1,grounded:false});
  const before=s.metrics.falls;stepGame(s);assert.equal(s.metrics.falls,before,'world water line is not the dungeon kill plane');
});

test('closed dungeon door blocks physical sword and pulse damage through its plane',()=>{
  const s=atEntrance();assert.equal(enterExpedition(s,'dungeon-sunfields').ok,true);
  const door=dungeonGeometry(s).doors.find(d=>!d.open);assert.ok(door);
  const alongZ=door.w>door.d,delta=1.15;
  const a={x:door.x-(alongZ?0:delta),z:door.z-(alongZ?delta:0)};
  const b={x:door.x+(alongZ?0:delta),z:door.z+(alongZ?delta:0)};
  s.enemies=[];Object.assign(s.player,{...a,y:Math.max(0,dungeonFloor(s,a.x,a.z)),yaw:alongZ?0:Math.PI/2});
  const enemy=spawnEnemy(s,'slime',b.x,b.z,s.player.y,{dungeonId:s.expedition.active.id,id:'fixture-behind-door'});
  const hp=enemy.hp;ticks(s,15,{attack:true});ticks(s,1);ticks(s,15,{skill:true});
  assert.equal(enemy.hp,hp,'closed door is shared combat cover');
});

test('snapshot restoration keeps pushable block aliases and deterministic scene steps',()=>{
  const s=atEntrance();assert.equal(enterExpedition(s,'dungeon-sunfields').ok,true);
  ticks(s,3);const copy=restoreSnapshot(snapshot(s));
  assert.equal(copy.blocks,copy.expedition.active.blocks);
  for(const held of [{moveX:.4,jump:true},{moveZ:.5},{attack:true},{}]){ticks(s,20,held);ticks(copy,20,held);}
  assert.deepEqual(snapshot(copy),snapshot(s));
});

test('authored movable dungeon stones stop sword rays and projectiles while remaining pushable',()=>{
  const s=atEntrance();assert.equal(enterExpedition(s,'dungeon-sunfields').ok,true);
  const stone=s.blocks[0];assert.ok(stone);s.enemies=[];
  Object.assign(s.player,{x:stone.x-1.3,y:stone.y,z:stone.z,yaw:Math.PI/2});
  const enemy=spawnEnemy(s,'slime',stone.x+1.3,stone.z,stone.y,{dungeonId:s.expedition.active.id,id:'fixture-behind-stone',state:'recover',timer:30});
  const hp=enemy.hp;ticks(s,12,{attack:true});assert.equal(enemy.hp,hp);
  s.projectiles.push({id:'fixture-cover-bolt',team:'player',type:'sunbolt',x:stone.x-1,y:stone.y+1,z:stone.z,vx:15,vz:0,vy:0,life:2,damage:50});
  ticks(s,12);assert.equal(enemy.hp,hp);assert.equal(s.projectiles.some(p=>p.id==='fixture-cover-bolt'),false);
  const before=stone.x;Object.assign(s.player,{x:stone.x-3,z:stone.z});ticks(s,1,{skill:true});ticks(s,90);
  assert.ok(stone.x>before+2,'block must not collide with itself');
});

test('v1/v2 migration initializes empty journeys; invalid instance IDs cannot trap a save',()=>{
  const s=createGame(55),v3=exportSave(s);
  for(const version of [1,2]){
    const raw={...v3,version};delete raw.journey;delete raw.expedition;
    const loaded=loadSave(raw);assert.equal(loaded.version,3);assert.deepEqual(loaded.journey.relics,[]);assert.equal(loaded.expedition.active,null);
    assert.ok(Math.hypot(loaded.player.x-WORLD.spawn.x,loaded.player.z-WORLD.spawn.z)<6);
  }
  v3.expedition={active:{id:'__proto__',blocks:[{x:Infinity}]},progress:{unknown:{claimed:true}}};
  const loaded=loadSave(v3);assert.equal(loaded.expedition.active,null);assert.ok(Number.isFinite(loaded.player.y));
});

test('paid lodge supplies survive reload and flask counts are bounded during migration',()=>{
  const s=createGame(),npc=TOWNS.find(t=>t.biomeId==='alpine').npcs.find(n=>n.role==='merchant');
  Object.assign(s.player,{x:npc.x,y:npc.y,z:npc.z});
  assert.equal(townAction(s,'service',{npcId:npc.id,serviceId:'lodge'}).ok,true);
  assert.equal(s.player.flasks,6);const saved=exportSave(s),loaded=loadSave(saved);
  assert.equal(loaded.player.flasks,6);assert.equal(loaded.village.materials.food,s.village.materials.food);
  for(const [value,expected] of [[999,6],[-10,0],[NaN,3],[Infinity,3],[undefined,3]])assert.equal(loadSave({...saved,flasks:value}).player.flasks,expected);
  assert.equal(loadSave({...saved,version:2,flasks:6}).player.flasks,3);
});
