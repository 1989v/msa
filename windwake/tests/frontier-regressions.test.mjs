import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,stepGame,fastTravel,spawnEnemy,exportSave,loadSave} from '../sim.mjs';
import {villageAction} from '../village.mjs';
import {VILLAGE,heightAt} from '../world.mjs';

test('ten completed nights release defeated actor slots and continue admitting every wave',()=>{
  const s=createGame();assert.equal(fastTravel(s,'home'),true);
  assert.equal(villageAction(s,'build',{type:'cottage',x:VILLAGE.x+8,z:VILLAGE.z}).ok,true);
  s.village.tasks.push('harvest');
  // Time/kill fixtures isolate the lifecycle, not a natural combat claim.
  for(let day=1;day<=10;day++){
    s.village.day=day;s.village.clock=450;s.village.beaconHp=180;
    for(let i=0;i<1000&&s.village.raid.status!=='active';i++)stepGame(s,{});
    assert.equal(s.village.raid.status,'active',`day${day} started`);
    const first=s.enemies.filter(e=>e.raid&&e.hp>0);assert.equal(first.length,3,`day${day} wave1 physically spawned`);
    first.forEach(e=>e.hp=0);stepGame(s,{});
    for(let i=0;i<260;i++)stepGame(s,{});
    const second=s.enemies.filter(e=>e.raid&&e.hp>0);assert.equal(second.length,4,`day${day} wave2 physically spawned`);
    second.forEach(e=>e.hp=0);stepGame(s,{});
    assert.equal(s.village.raid.status,'won');assert.equal(s.enemies.filter(e=>e.raid).length,0);
    assert.ok(s.enemies.length<25);
  }
});

test('an intact fence blocks a nearby raid strike aimed at a player behind it',()=>{
  const s=createGame();fastTravel(s,'home');
  assert.equal(villageAction(s,'build',{type:'fence',x:-26,z:-86}).ok,true);
  Object.assign(s.player,{x:-26,z:-85,y:heightAt(-26,-85)});
  const e=spawnEnemy(s,'stalker',-26,-87,undefined,{id:'raid-1-1-0',raid:true,raidDay:1,raidWave:1,raidIndex:0,state:'telegraph',timer:0,attackCount:0});
  s.village.raid={status:'active',day:1,wave:1,waves:2,spawned:true,timer:0,elapsed:0,direction:'north',rewarded:false,enemies:[{...e}],defeated:[]};
  stepGame(s,{});assert.equal(s.player.hp,100,'player is protected by fence');
});

test('partial survival trial reload keeps stable defeated guardians and pays no repeated kill reward',async()=>{
  const {LANDMARKS}=await import('../world.mjs');const {interact}=await import('../sim.mjs');
  const site=LANDMARKS.find(l=>l.kind==='trial'&&l.challenge==='survive');
  let s=createGame();s.enemies=[];
  const place=()=>Object.assign(s.player,{x:site.x,y:site.y,z:site.z,vx:0,vz:0,vy:0});
  place();interact(s);const e=s.enemies.find(e=>e.trialId===site.id);
  assert.ok(e);e.hp=1;Object.assign(s.player,{x:e.x,z:e.z-2,y:e.y,yaw:0});
  stepGame(s,{attack:true});for(let i=0;i<12;i++)stepGame(s,{});
  assert.equal(e.hp,0);assert.equal(s.adventure.worldDefeated[e.id],true);
  const xp=s.adventure.xp;s=loadSave(exportSave(s));s.enemies=[];place();interact(s);
  assert.equal(s.enemies.filter(e=>e.trialId===site.id).length,2);
  assert.equal(s.enemies.some(other=>other.id===e.id),false);
  assert.equal(s.adventure.xp,xp);assert.equal(s.trial.enemies.length,3);
});

test('a defeated frozen raider outside home range is captured before pruning and stays dead after load',()=>{
  const s=createGame();fastTravel(s,'home');villageAction(s,'build',{type:'cottage',x:VILLAGE.x+8,z:VILLAGE.z});
  s.village.tasks.push('harvest');s.village.clock=450;for(let i=0;i<610;i++)stepGame(s,{});
  const raiders=s.enemies.filter(e=>e.raid&&e.hp>0);assert.equal(raiders.length,3);
  const killed=raiders[0].id;raiders[0].hp=0;s.player.x=VILLAGE.x+80;s.player.z=VILLAGE.z;s.player.y=heightAt(s.player.x,s.player.z);
  stepGame(s,{});assert.ok(s.village.raid.defeated.includes(killed));assert.equal(s.enemies.some(e=>e.id===killed),false);
  const loaded=loadSave(exportSave(s));assert.equal(loaded.enemies.some(e=>e.id===killed),false);assert.equal(loaded.enemies.filter(e=>e.raid&&e.hp>0).length,2);
});
