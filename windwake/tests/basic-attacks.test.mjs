import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,stepGame,spawnEnemy,DT} from '../sim.mjs';

// Controlled combat fixtures isolate interruption from damage and enemy AI.
function encounter(type='stalker',extra={}){
  const s=createGame(8123);s.enemies=[];const p=s.player;
  const e=spawnEnemy(s,type,p.x,p.z+2,p.y,{state:'telegraph',timer:.5,yaw:Math.PI,pattern:'slam',hp:300,maxHp:300,...extra});
  return {s,p,e};
}
function advance(s,n,input={}){const events=[];for(let i=0;i<n;i++){stepGame(s,input);events.push(...s.events);}return events;}
function primeImpact(s,combo=1){Object.assign(s.player,{combo,attackTimer:.3,attackElapsed:[0,.10,.12,.18][combo],attackHit:false,attackQueued:false,comboWindow:.8});}

for(const combo of [1,2,3])test(`basic combo${combo} damages without cancelling an incoming attack or moving its victim`,()=>{
  const {s,p,e}=encounter();primeImpact(s,combo);const before={hp:e.hp,timer:e.timer,x:e.x,z:e.z};
  stepGame(s);
  assert.equal(e.hp,before.hp-[0,16,21,38][combo]);assert.equal(e.state,'telegraph');assert.ok(Math.abs(e.timer-(before.timer-DT))<1e-9);
  assert.equal(e.vx,0);assert.equal(e.vz,0);assert.equal(e.x,before.x);assert.equal(e.z,before.z);
  assert.ok(e.hitFlash>0);assert.ok(s.effects.some(f=>f.type==='hit'));assert.equal(s.events.find(v=>v.type==='hit').hitStop,false);
  advance(s,32);assert.ok(p.hp<p.maxHp,'the enemy must finish its advertised attack despite the hit');
});

test('basic hits preserve active charge trajectories for legacy, expanded and dungeon actors',()=>{
  for(const [type,extra] of [['charger',{}],['boar',{}],['boss',{dungeonId:'dungeon-sunfields',family:'bulwark'}]]){
    const {s,e}=encounter(type,{...extra,state:'attack',timer:.4,attackDuration:.65,pattern:'charge',vx:0,vz:-9,didHit:true});
    primeImpact(s);const z=e.z;stepGame(s);
    assert.equal(e.state,'attack',type);assert.ok(e.z<z,`${type} continues toward the player`);assert.equal(e.vx,0);assert.ok(e.vz<0,`${type} direction not reversed`);
  }
});

test('sword hits do not refresh or shorten existing skill stagger or clear accumulated poise',()=>{
  const {s,e}=encounter('stalker',{state:'hit',timer:1.2,vx:2,vz:1,poise:2});primeImpact(s);stepGame(s);
  assert.equal(e.state,'hit');assert.ok(Math.abs(e.timer-(1.2-DT))<1e-9);assert.equal(e.poise,2);assert.equal(e.vx,2*.84);assert.equal(e.vz,1*.84);
});

test('landing from a basic aerial attack deals plunge damage without stagger or knockback',()=>{
  const {s,p,e}=encounter('stalker',{state:'recover',timer:2});
  Object.assign(p,{y:p.y+.02,vy:-15,grounded:false,coyote:0,plunge:true});stepGame(s);
  assert.equal(e.hp,265);assert.equal(e.state,'recover');assert.ok(Math.abs(e.timer-(2-DT))<1e-9);assert.equal(e.vx,0);assert.equal(e.vz,0);
  assert.equal(s.events.find(v=>v.type==='hit').hitStop,false);assert.equal(p.plunge,false);
});

test('lethal basic hits still kill and reward exactly once',()=>{
  const {s,e}=encounter('stalker',{hp:10,maxHp:55});primeImpact(s);stepGame(s);
  assert.equal(e.state,'dead');assert.equal(e.hp,0);assert.equal(s.metrics.kills,1);const xp=s.adventure.xp;
  advance(s,60,{attack:true});assert.equal(s.metrics.kills,1);assert.equal(s.adventure.xp,xp);
});

test('pulse and perfect parry retain their crowd control and impact pause',()=>{
  const pulse=encounter();stepGame(pulse.s,{skill:true});assert.equal(pulse.e.state,'hit');assert.ok(pulse.e.timer>.8);assert.ok(pulse.e.vz>0);
  assert.equal(pulse.s.events.find(v=>v.type==='hit').hitStop,true);
  const parry=encounter('stalker',{timer:DT/2});stepGame(parry.s,{parry:true});assert.equal(parry.s.metrics.parries,1);assert.equal(parry.e.state,'hit');assert.ok(parry.e.timer>1.5);
  assert.equal(parry.s.events.find(v=>v.type==='hit').hitStop,true);
});
