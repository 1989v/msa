import test from 'node:test';
import assert from 'node:assert/strict';
import {ENEMY_STATS,updateExpandedEnemy,attackContains} from '../combat.mjs';
import {createGame,spawnEnemy,stepGame} from '../sim.mjs';

// Explicit controlled fixtures test decisions/geometry; journey tests separately
// verify ordinary inputs from real routes. No fixture is claimed as exploration.
const DT=1/60;
function fixture(type='boss',extra={}){
  const e={id:'a',type,x:0,y:0,z:0,yaw:0,hp:ENEMY_STATS[type].hp,maxHp:ENEMY_STATS[type].hp,
    state:'idle',homeX:0,homeY:0,homeZ:0,...extra};
  const s={player:{x:0,y:0,z:4,hp:1000},enemies:[e]},calls={hits:[],shots:[],effects:[]};
  const hooks={move(a,x,z){a.x+=x;a.z+=z;},ground(a){a.y=0;},lineClear(){return true;},
    damagePlayer(n,a){calls.hits.push(a.id);s.player.hp-=n;return true;},
    shoot(a,n,options){calls.shots.push({n,options});},effect(type,at,options){calls.effects.push({type,...options});},
    hitEnemy(a,n){a.hp-=n;},spawn(){return null;},emit(){},toast(){}};
  const tick=(n=1)=>{for(let i=0;i<n;i++)for(const a of s.enemies)updateExpandedEnemy(s,a,DT,hooks);};
  const until=(predicate,n=1200)=>{while(!predicate()&&n-->0)tick();assert.ok(predicate(),JSON.stringify(e));};
  return {e,s,hooks,calls,tick,until};
}

function pack(){
  const f=fixture('wolf',{x:-3,z:0});f.s.player.z=0;
  f.s.enemies.push({...structuredClone(f.e),id:'b',x:3},{...structuredClone(f.e),id:'c',x:0,z:-4});
  return f;
}
test('nearby wolves distribute flank slots, bound commitments and rotate every stable ID',()=>{
  const f=pack();let max=0;const positions=new Map();
  for(let i=0;i<1500;i++){
    f.tick();max=Math.max(max,f.s.enemies.filter(e=>['telegraph','attack'].includes(e.state)).length);
    for(const e of f.s.enemies)if(e.state==='chase')positions.set(e.id,{x:e.x,z:e.z});
  }
  assert.equal(max,1);assert.equal(positions.size,3);
  for(const e of f.s.enemies)assert.ok(e.attackCount>=2,`${e.id} eventually attacks`);
  const points=[...positions.values()];assert.ok(points.some((a,i)=>points.some((b,j)=>i!==j&&Math.hypot(a.x-b.x,a.z-b.z)>3)));
});
test('wolf coordination ignores remote, other-floor, blocked and other-scene actors',()=>{
  for(const mode of ['far','floor','cover','scene']){
    const f=fixture('wolf');const other={...structuredClone(f.e),id:'0',state:'telegraph',timer:10};
    if(mode==='far')other.x=30;if(mode==='floor')other.y=8;if(mode==='scene')other.dungeonId='another';
    f.s.enemies.push(other);
    if(mode==='cover')f.hooks.lineClear=(a,b)=>a===b||a.id!=='0'&&b.id!=='0';
    updateExpandedEnemy(f.s,f.e,DT,f.hooks);assert.equal(f.e.state,'telegraph',mode);assert.equal(f.e.packSlot,undefined);
  }
});
test('shaman retreats to useful range and sentinel physically screens its caster',()=>{
  const shaman=fixture('shaman');shaman.s.player.z=2;shaman.tick(300);
  assert.ok(Math.hypot(shaman.e.x-shaman.s.player.x,shaman.e.z-shaman.s.player.z)>=6);
  assert.ok(shaman.calls.shots.length>=2);
  const f=fixture('sentinel',{x:4});f.s.player.z=12;
  const caster={...structuredClone(f.e),id:'caster',type:'shaman',x:0,z:0,state:'recover',timer:20};f.s.enemies.push(caster);
  f.tick(180);assert.equal(f.e.screenTarget,'caster');assert.ok(Math.hypot(f.e.x,f.e.z-3)<.1);assert.equal(f.e.guarding,true);
  f.hooks.lineClear=()=>false;f.tick();assert.equal(f.e.screenTarget,undefined);
});

test('bulwark follow-up is committed, has a new 600ms tell, and rewards moving outside its sector',()=>{
  for(const avoid of [false,true]){
    const f=fixture('boss',{bossId:'fixture',family:'bulwark'});f.tick();
    const original=structuredClone(f.e.attackSpec);assert.ok(original.followup);
    f.until(()=>!!f.e.attackSpec.followupStrike);assert.equal(f.calls.hits.length,1);assert.equal(f.e.timer,.6);
    assert.equal(f.e.attackSpec.yaw,original.yaw);
    if(avoid)f.s.player.x=8;
    f.until(()=>f.e.state==='recover');assert.equal(f.calls.hits.length,avoid?1:2);assert.ok(f.e.timer>=1.4);
  }
});
test('thorn fixed eruption circles really damage both flanks and have reachable intervening space',()=>{
  for(const target of ['center','flank','safe']){
    const f=fixture('boss',{bossId:'fixture',family:'thorn',phase:2,hp:300,attackCount:1});f.tick();
    const locked=structuredClone(f.e.attackSpec);assert.equal(locked.circles.length,3);
    if(target==='flank')Object.assign(f.s.player,locked.circles[1]);
    if(target==='safe'){f.s.player.x=0;f.s.player.z=10;}
    assert.equal(attackContains(locked,f.s.player),target!=='safe');
    f.until(()=>f.e.state==='recover');assert.equal(f.calls.hits.length,target==='safe'?0:1);
    assert.deepEqual(f.e.attackSpec,locked);
  }
});
test('tide wave permits either its locked safe sector or a timed jump; cover still blocks contacts',()=>{
  for(const response of ['stand','sector','jump','cover']){
    const f=fixture('boss',{bossId:'fixture',family:'tide',attackCount:1});f.tick();
    assert.equal(f.e.attackSpec.kind,'wave');
    if(response==='sector'){f.s.player.x=4;f.s.player.z=0;}
    if(response==='jump')f.s.player.y=1.5;
    if(response==='cover')f.hooks.lineClear=()=>false;
    f.until(()=>f.e.state==='recover');assert.equal(f.calls.hits.length,response==='stand'?1:0,response);
  }
});
test('tempest lanes/count and vertical aim stay locked after target moves, with a real fan gap',()=>{
  const f=fixture('boss',{bossId:'fixture',family:'tempest'});f.s.player.z=10;f.tick();
  const spec=structuredClone(f.e.attackSpec);assert.equal(spec.angles.length,3);
  const safe={x:Math.sin(-.22)*10,y:0,z:Math.cos(-.22)*10};
  assert.equal(attackContains(spec,f.s.player),true);assert.equal(attackContains(spec,safe),false);
  Object.assign(f.s.player,{x:8,y:2,z:0});f.until(()=>f.calls.shots.length>0);
  const shot=f.calls.shots[0];assert.equal(shot.n,spec.angles.length);assert.deepEqual(shot.options.angles,spec.angles);
  assert.equal(shot.options.aimY,0);assert.deepEqual(shot.options.origin,{x:0,y:0,z:0});
});
test('skills/parry interruption cancels a queued follow-up; separate attack contacts never retry invulnerability',()=>{
  const f=fixture('boss',{bossId:'fixture',family:'bulwark'});f.tick();
  f.hooks.damagePlayer=()=>{f.e.state='hit';f.e.timer=.8;return false;};
  f.until(()=>f.e.state==='hit');assert.equal(f.e.pattern,'slam');f.tick(30);assert.equal(f.e.state,'hit');assert.equal(f.e.attackSpec,undefined);
  const charge=fixture('boar');let attempted=0;charge.hooks.damagePlayer=()=>{attempted++;return false;};
  charge.until(()=>charge.e.state==='recover');assert.equal(attempted,1);
});
test('tactical replay preserves deterministic serializable decisions, shapes and bounded summons',()=>{
  const a=pack(),b=pack();a.tick(1500);b.tick(1500);
  assert.deepEqual(a.s,b.s);assert.deepEqual(a.calls,b.calls);assert.deepEqual(JSON.parse(JSON.stringify(a.s)),a.s);
});

test('actual tempest projectiles obey told lanes and standing versus gap movement changes damage',()=>{
  for(const avoid of [false,true]){
    const s=createGame(8123);s.enemies=[];const p=s.player;
    const e=spawnEnemy(s,'boss',p.x,p.z-10,p.y,{bossId:'tactics-fixture',family:'tempest'});
    stepGame(s);const spec=structuredClone(e.attackSpec);assert.ok(spec);
    // This is a declared controlled pose fixture, not an ordinary route. It tests
    // actual sim projectile integration after the tell, including locked aiming.
    if(avoid){p.x=e.x+Math.sin(-.22)*10;p.z=e.z+Math.cos(-.22)*10;}
    let observed=false;
    for(let i=0;i<125;i++){
      stepGame(s);
      if(!observed&&s.projectiles.some(b=>b.team==='enemy')){
        const shots=s.projectiles.filter(b=>b.team==='enemy');assert.equal(shots.length,spec.angles.length);
        shots.forEach((shot,j)=>assert.ok(Math.abs(Math.atan2(shot.vx,shot.vz)-spec.angles[j])<1e-9));observed=true;
      }
    }
    assert.equal(observed,true);assert.equal(p.hp<100,!avoid,JSON.stringify({avoid,hp:p.hp}));
  }
});
