import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,stepGame,spawnEnemy,exportSave,loadSave,restoreSnapshot,snapshot,interact,enterExpedition,exitExpedition} from '../sim.mjs';
import {COMBO_STAGES} from '../melee.mjs';
import {ENEMY_STATS} from '../combat.mjs';
import {WORLD,WORLD_GENERATION,VILLAGE,BOSS_SITES,LANDMARKS,DUNGEON_ENTRANCES,heightAt,spawnsNear} from '../world.mjs';
import {dungeonGeometry} from '../dungeons.mjs';
import {runFrontierTrail} from './frontier-routes.mjs';
import {villageAction} from '../village.mjs';

const tick=(s,n,input={})=>{for(let i=0;i<n;i++)stepGame(s,input);};
const place=(s,x,z)=>Object.assign(s.player,{x,z,y:heightAt(x,z),vx:0,vy:0,vz:0,grounded:true});
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// Controlled paired encounter fixtures. No HP/gear/stat overrides, healing,
// clocks or actor repositioning after the start; controllers use ordinary input.
function duel(types,style){
  const s=createGame(8123);s.enemies=[];const p=s.player;
  const enemies=types.map((type,i)=>spawnEnemy(s,type,p.x+i*3,p.z+4.5,p.y));
  assert.ok(enemies.every(e=>gap(e,p)>=3&&gap(e,p)<=6&&e.hp===ENEMY_STATS[e.type].hp));
  for(let i=0;i<45*60&&p.hp>0&&enemies.some(e=>e.hp>0);i++){
    const alive=enemies.filter(e=>e.hp>0).sort((a,b)=>gap(a,p)-gap(b,p)),e=alive[0];
    const dx=e.x-p.x,dz=e.z-p.z,d=gap(e,p),input={attack:d<3.1,moveX:d>2?dx/d:0,moveZ:d>2?dz/d:0};
    const threat=alive.find(e=>e.state==='telegraph'&&e.timer<.16&&gap(e,p)<3.6&&e.type!=='ranger');
    if(style==='parry'&&threat&&p.parryCooldown<=0&&!s.previousInput.parry)input.parry=true;
    if(style==='dodge'&&threat&&p.dodgeTimer<=0&&!s.previousInput.dodge){input.dodge=true;input.moveX=-dz/d;input.moveZ=dx/d;}
    const projectile=s.projectiles.find(b=>b.team==='enemy'&&gap(b,p)<1.9);
    if(style!=='attack'&&projectile&&p.dodgeTimer<=0&&!s.previousInput.dodge){input.dodge=true;input.moveX=-dz/d;input.moveZ=dx/d;}
    stepGame(s,input);
  }
  return {hp:p.hp,time:s.time,killed:enemies.every(e=>e.hp===0),parries:s.metrics.parries,dodges:s.metrics.dodges};
}
for(const types of [['stalker'],['stalker','ranger']])test(`${types.join('+')} rewards timed defense at normal 100 HP within 45 seconds`,t=>{
  const attack=duel(types,'attack'),parry=duel(types,'parry'),dodge=duel(types,'dodge');
  for(const defense of [parry,dodge]){
    assert.equal(defense.killed,true);assert.ok(defense.hp>0);assert.ok(defense.time<=45);
    assert.ok(attack.hp===0||defense.hp-attack.hp>=25,JSON.stringify({attack,defense}));
  }
  assert.equal(dodge.parries,0);assert.ok(dodge.dodges>0);assert.ok(parry.parries>0);
  t.diagnostic(JSON.stringify({types,attack,parry,dodge}));
});

test('shared combo timeline impacts exactly once per stage, released chain times out and dodge cancels',()=>{
  const s=createGame();s.enemies=[];const p=s.player;
  const e=spawnEnemy(s,'stalker',p.x,p.z+2,p.y,{hp:1000,maxHp:1000,state:'recover',timer:100});
  const impacts=[],attacks=[];let previous=e.hp;
  for(let i=0;i<110;i++){
    stepGame(s,{attack:true});attacks.push(...s.events.filter(e=>/^attack[123]$/.test(e.type)).map(e=>e.type));
    if(e.hp!==previous){const stage=COMBO_STAGES[p.combo-1];impacts.push(previous-e.hp);assert.ok(p.attackElapsed>=stage.impact&&p.attackElapsed<stage.impact+1/60+.001);previous=e.hp;}
  }
  assert.deepEqual(impacts,[16,21,38]);assert.deepEqual(attacks.slice(0,3),['attack1','attack2','attack3']);
  stepGame(s,{dodge:true});assert.equal(p.attackTimer,0);assert.equal(p.attackQueued,false);
  tick(s,90);stepGame(s,{attack:true});assert.equal(p.combo,1);
  tick(s,60);assert.equal(p.attackTimer<=0,true);assert.equal(p.comboWindow,0);
});

test('all ordinary tells retain at least 450 ms before retaliation',()=>{
  for(const type of Object.keys(ENEMY_STATS).filter(t=>t!=='boss')){
    const s=createGame();s.enemies=[];const p=s.player,e=spawnEnemy(s,type,p.x,p.z+2,p.y);
    stepGame(s);assert.equal(e.state,'telegraph',type);assert.ok(e.timer>=.45,type);
  }
});

test('near-landing jump buffers despite unlocked glider, while an open glider can still fold',()=>{
  for(const vy of [-2,-8,-18]){
    const s=createGame();s.enemies=[];const p=s.player;s.progress.glider=true;
    Object.assign(p,{y:p.y+.07,vy,grounded:false,coyote:0});stepGame(s,{jump:true});
    assert.equal(p.gliding,false);assert.ok(p.jumpBuffer>0);tick(s,8);
    assert.equal(s.metrics.jumps,1);assert.ok(p.vy>0);
  }
  const s=createGame();s.progress.glider=true;Object.assign(s.player,{y:s.player.y+4,vy:-2,grounded:false,coyote:0,gliding:true});
  stepGame(s,{jump:true});assert.equal(s.player.gliding,false);assert.equal(s.player.jumpBuffer,0);
});

function saturate(s){
  s.enemies=[];
  for(let i=0;i<64;i++)assert.ok(spawnEnemy(s,'slime',s.player.x+60+i*.05,s.player.z,undefined,{id:`ambient-${i}`,frontier:true}));
  return s.enemies[0];
}
test('saturated ambient residency admits arena boss and keeps an engaged enemy',()=>{
  const s=createGame(),site=BOSS_SITES.find(b=>!b.final);place(s,site.x,site.z-15);
  const engaged=saturate(s);engaged.state='telegraph';engaged.timer=2;engaged.hp--;
  stepGame(s);assert.ok(s.enemies.some(e=>e.bossId===site.id));assert.ok(s.enemies.includes(engaged));assert.ok(s.enemies.length<=64);
});
test('saturated ambient residency admits all survival guardians and the full first raid wave',()=>{
  const s=createGame(),trial=LANDMARKS.find(l=>l.kind==='trial'&&l.challenge==='survive');place(s,trial.x,trial.z);saturate(s);interact(s);
  assert.equal(s.enemies.filter(e=>e.trialId===trial.id).length,3);assert.equal(s.enemies.length,64);
  const raid=createGame();place(raid,VILLAGE.x,VILLAGE.z);
  assert.equal(villageAction(raid,'build',{type:'cottage',x:VILLAGE.x+8,z:VILLAGE.z}).ok,true);raid.village.tasks.push('harvest');raid.village.clock=450;saturate(raid);
  tick(raid,610);assert.equal(raid.village.raid.status,'active');assert.equal(raid.enemies.filter(e=>e.raid&&e.hp>0).length,3);assert.ok(raid.enemies.length<=64);
});
test('saturated field parks across a dungeon and returns within capacity on real terrain',()=>{
  const s=createGame(),entrance=DUNGEON_ENTRANCES[0];place(s,entrance.x,entrance.z);saturate(s);
  assert.equal(enterExpedition(s,entrance.id).ok,true);tick(s,2);assert.ok(s.enemies.every(e=>e.dungeonId));
  const exit=dungeonGeometry(s).landmarks.find(l=>l.kind==='exit');Object.assign(s.player,{x:exit.x,y:exit.y,z:exit.z});
  assert.equal(exitExpedition(s).ok,true);assert.ok(s.enemies.length<=64);assert.equal(s.player.y,heightAt(s.player.x,s.player.z));
});
test('full generated population plus suppressed legacy defeats survive saves beyond 4096 entries',()=>{
  const s=createGame(),ids=new Set();
  for(let x=-WORLD.size;x<WORLD.size;x+=WORLD.chunkSize)for(let z=-WORLD.size;z<WORLD.size;z+=WORLD.chunkSize){
    for(const e of spawnsNear(x+WORLD.chunkSize/2,z+WORLD.chunkSize/2,WORLD.chunkSize))ids.add(e.id);
  }
  // Suppressed legacy slots remain durable even if new terrain no longer admits them.
  for(let i=0;ids.size<6000;i++)ids.add(`wild-suppressed-${i}-0`);
  assert.ok(ids.size>4096&&ids.size<=WORLD_GENERATION.maxDurableIds);
  assert.ok(WORLD_GENERATION.maxDurableIds<=16384);
  for(const id of ids)s.adventure.worldDefeated[id]=true;
  const restored=loadSave(JSON.parse(JSON.stringify(exportSave(s))));
  assert.deepEqual(restored.adventure.worldDefeated,s.adventure.worldDefeated);
});
test('restoring old grounded poses rebases player and recovery feet to current terrain',()=>{
  const s=createGame();place(s,415,500);const floor=heightAt(s.player.x,s.player.z);
  Object.assign(s.player,{y:floor-20,safeX:s.player.x,safeZ:s.player.z,safeY:floor-20});
  const restored=restoreSnapshot(snapshot(s));assert.equal(restored.player.y,floor);assert.equal(restored.player.safeY,floor);
});

test('the entire 16384 durable-defeat budget survives, and excess untrusted input is bounded',()=>{
  const s=createGame();for(let i=0;i<16390;i++)s.adventure.worldDefeated[`durable-${i}`]=true;
  const restored=loadSave(exportSave(s));assert.equal(Object.keys(restored.adventure.worldDefeated).length,16384);
  assert.equal(restored.adventure.worldDefeated['durable-16383'],true);assert.equal(restored.adventure.worldDefeated['durable-16384'],undefined);
});


test('a natural sunfields walk replaces distant idle residents with nearby undefeated encounters',()=>{
  const s=createGame();let observed=false;
  const driver={state:()=>structuredClone(s),step(n,input){
    for(let i=0;i<n;i++){
      stepGame(s,input);assert.ok(s.enemies.filter(e=>!e.bossId&&!e.raid&&!e.trialId&&!e.dungeonId).length<=40,'ordinary residents cannot consume priority capacity');
      assert.ok(s.enemies.length<=64,'authored actors retain the total hard cap');
      if(s.frame===900){
        observed=true;
        for(const id of ['wild-v2-0--4-0-2','wild-v2-0--4-0-0']){
          const spec=spawnsNear(s.player.x,s.player.z,30).find(e=>e.id===id);
          assert.ok(spec&&gap(spec,s.player)<20,'ordinary walked approach reaches this encounter');
          assert.ok(s.enemies.some(e=>e.id===id),'nearby encounter must replace distant idle residency');
        }
      }
    }
    return structuredClone(s);
  }};
  runFrontierTrail(driver,'route-sunfields');assert.equal(observed,true);
});

test('nearby admission preserves injured, engaged and authored actors at the ambient cap',()=>{
  const s=createGame();place(s,0,-192);s.enemies=[];
  for(let i=0;i<40;i++)spawnEnemy(s,'slime',70+i*.2,-192,undefined,{id:`admission-${i}`,frontier:true});
  const protectedActors=s.enemies.slice(0,6);
  protectedActors[0].hp--;protectedActors[1].state='telegraph';protectedActors[1].timer=2;
  protectedActors[2].bossId='protected-boss';protectedActors[3].trialId='protected-trial';
  protectedActors[4].raid=true;protectedActors[5].summonedBy='protected-boss';
  stepGame(s);
  for(const e of protectedActors)assert.ok(s.enemies.includes(e),`preserve ${e.id}`);
  assert.equal(s.enemies.length,40);assert.ok(s.enemies.some(e=>e.id==='wild-v2-0--4-0-2'));
});
