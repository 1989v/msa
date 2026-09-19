import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_STATS, ENEMY_NAMES, updateExpandedEnemy } from '../combat.mjs';

// Controlled behavior fixtures. These intentionally inject actors/positions;
// they are not evidence that a player completed an exploration or boss route.
const DT=1/60;
function fixture(type,extra={}){
  const stats=ENEMY_STATS[type];
  const e={id:'subject',type,x:0,y:0,z:0,homeX:0,homeY:0,homeZ:0,hp:stats.hp,maxHp:stats.hp,
    state:'idle',timer:0,yaw:0,vx:0,vy:0,vz:0,phase:1,attackCount:0,...extra};
  const s={player:{x:0,y:0,z:2,hp:1000,slowTimer:0},enemies:[e]};
  const calls={hits:[],shots:[],effects:[],spawns:[],toasts:[],kills:0};
  const options={cover:false,blockMovement:false,spawnDenied:false,dodge:false,floor:0};
  const hooks={
    move(a,dx,dz){if(!options.blockMovement){a.x+=dx;a.z+=dz;}},
    ground(a,dt){a.vy=(a.vy||0)-25*dt;a.y+=a.vy*dt;if(a.y<=options.floor){a.y=options.floor;a.vy=0;a.grounded=true;}else a.grounded=false;},
    lineClear(){return !options.cover;},
    damagePlayer(amount,source){calls.hits.push({amount,source:source.id});if(options.dodge)return false;s.player.hp-=amount;return true;},
    hitEnemy(a,amount){const wasAlive=a.hp>0;a.hp=Math.max(0,a.hp-amount);if(wasAlive&&a.hp===0)calls.kills++;},
    shoot(a,count,options){calls.shots.push({id:a.id,count,options});},
    spawn(type,x,z,extra){if(options.spawnDenied)return null;
      const a={id:`add-${calls.spawns.length}`,type,x,y:0,z,hp:50,maxHp:50,...extra};s.enemies.push(a);calls.spawns.push(a);return a;},
    effect(type,at,extra){calls.effects.push({type,x:at.x,y:at.y,z:at.z,...extra});},
    emit(){},toast(text){calls.toasts.push(text);},random(){return .5;},
  };
  const tick=(frames=1)=>{for(let i=0;i<frames;i++){s.player.slowTimer=Math.max(0,s.player.slowTimer-DT);updateExpandedEnemy(s,e,DT,hooks);}return e;};
  const until=(predicate,limit=600)=>{for(let i=0;i<limit;i++){if(predicate())return;tick();}assert.fail(`State never reached: ${JSON.stringify(e)}`);};
  return {s,e,calls,options,hooks,tick,until};
}

test('original actors remain simulation-owned and retain their combat stats',()=>{
  for(const [type,hp,speed,damage] of [['stalker',55,3.3,13],['ranger',44,2.5,12],['charger',95,2.5,22],['boss',740,2.6,23]]){
    const f=fixture(type),before=structuredClone(f.e);
    assert.equal(updateExpandedEnemy(f.s,f.e,DT,f.hooks),false);assert.deepEqual(f.e,before);
    assert.equal(ENEMY_STATS[type].hp,hp);assert.equal(ENEMY_STATS[type].speed,speed);assert.equal(ENEMY_STATS[type].damage,damage);
  }
  assert.equal(Object.keys(ENEMY_STATS).length,13);assert.equal(Object.keys(ENEMY_NAMES).length,13);
  const raid=fixture('wolf',{raid:true});assert.equal(updateExpandedEnemy(raid.s,raid.e,DT,raid.hooks),false);
});

test('all nine added archetypes telegraph before dealing damage or firing',()=>{
  for(const type of ['slime','wolf','boar','shaman','wisp','bomber','sentinel','burrower','frostling']){
    const f=fixture(type);f.tick();assert.equal(f.e.state,'telegraph',type);assert.ok(f.e.timer>=.65,type);
    f.tick(20);assert.equal(f.calls.hits.length,0,type);assert.equal(f.calls.shots.length,0,type);
    assert.equal(f.e.state,'telegraph',type);assert.ok(f.calls.effects.some(e=>e.type==='telegraph'),type);
  }
});

test('slime hops physically while chasing and wolf pack pursuit is faster',()=>{
  const slime=fixture('slime');slime.s.player.z=12;slime.tick(8);
  assert.ok(slime.e.y>.1);assert.ok(slime.e.z>0);
  const lone=fixture('wolf'),pack=fixture('wolf');lone.s.player.z=pack.s.player.z=14;
  pack.s.enemies.push({id:'packmate',type:'wolf',x:2,y:0,z:0,hp:50,maxHp:50});
  lone.tick(30);pack.tick(30);assert.ok(pack.e.z>lone.e.z);
});

test('wolf leap direction locks at its tell and a sidestep avoids its strike',()=>{
  const f=fixture('wolf');f.s.player.z=5;f.tick();const yaw=f.e.yaw;
  f.s.player.x=7;f.until(()=>f.e.state==='attack');assert.equal(f.e.yaw,yaw);
  f.until(()=>f.e.state==='recover');assert.equal(f.s.player.hp,1000);assert.ok(f.e.z>2);assert.ok(f.e.x<.01);
});

test('boar charge damages once, respects dodge, and stops against a wall',()=>{
  const f=fixture('boar');f.s.player.z=5;f.until(()=>f.e.state==='attack');
  f.until(()=>f.e.state==='recover');assert.equal(f.calls.hits.length,1);assert.ok(f.s.player.hp<1000);
  const dodged=fixture('boar');dodged.options.dodge=true;dodged.until(()=>dodged.e.state==='attack');
  dodged.tick(12);dodged.options.dodge=false;dodged.until(()=>dodged.e.state==='recover');
  assert.equal(dodged.s.player.hp,1000);assert.equal(dodged.calls.hits.length,1);
  const wall=fixture('boar');wall.s.player.z=5;wall.until(()=>wall.e.state==='attack');
  wall.options.blockMovement=true;wall.options.cover=true;wall.tick();
  assert.equal(wall.e.state,'recover');assert.equal(wall.s.player.hp,1000);
});

test('shaman heals an injured visible ally after a tell, then casts instead of healing each frame',()=>{
  const f=fixture('shaman'),ally={id:'ally',type:'wolf',x:1,y:0,z:0,hp:20,maxHp:52};f.s.enemies.push(ally);
  f.tick();assert.equal(f.e.pattern,'summon');assert.equal(ally.hp,20);
  f.until(()=>f.e.state==='recover');assert.ok(ally.hp>20&&ally.hp<=38);
  const healed=ally.hp;f.until(()=>f.e.state==='telegraph');assert.equal(f.e.pattern,'bolt');
  f.until(()=>f.calls.shots.length>0);assert.equal(ally.hp,healed);assert.equal(f.calls.shots[0].count,1);
});

test('shaman cannot heal through new cover and never resurrects a defeated ally',()=>{
  for(const dead of [false,true]){
    const f=fixture('shaman'),ally={id:'ally',type:'wolf',x:1,y:0,z:0,hp:20,maxHp:52};f.s.enemies.push(ally);f.tick();
    if(dead)ally.hp=0;else f.options.cover=true;
    f.until(()=>f.e.state==='recover');assert.equal(ally.hp,dead?0:20);
  }
});

test('wisp hovers, fires a fan, and descends into sword range during recovery',()=>{
  const f=fixture('wisp');f.s.player.z=8;f.tick();assert.equal(f.e.pattern,'bolt');assert.ok(f.e.y>1.5);
  f.until(()=>f.calls.shots.length>0);assert.equal(f.calls.shots[0].count,2);
  f.tick(35);assert.equal(f.e.state,'recover');assert.ok(f.e.y<.6);
});

test('bomber fuse can be interrupted, then an uninterrupted burst uses the shared kill path once',()=>{
  const f=fixture('bomber');f.tick();assert.equal(f.e.pattern,'burst');assert.ok(f.e.timer>1.4);
  f.tick(45);f.e.state='hit';f.e.timer=.4;f.tick(50);assert.equal(f.calls.kills,0);assert.equal(f.s.player.hp,1000);
  f.until(()=>f.e.state==='telegraph');f.until(()=>f.e.hp===0);f.tick(180);
  assert.equal(f.calls.kills,1);assert.equal(f.calls.hits.length,1);assert.equal(f.e.state,'dead');
});

test('sentinel guards its approach but exposes its front throughout windup and recovery',()=>{
  const f=fixture('sentinel');f.s.player.z=8;f.tick();assert.equal(f.e.guarding,true);
  f.s.player.z=2;f.tick();assert.equal(f.e.pattern,'sweep');assert.equal(f.e.guarding,false);
  f.until(()=>f.e.state==='recover');assert.equal(f.e.guarding,false);assert.ok(f.e.timer>1.5);assert.ok(f.s.player.hp<1000);
});

test('burrow eruption marks a fixed ground location and gives a full sidestep window',()=>{
  const f=fixture('burrower');f.s.player.z=5;f.tick();assert.equal(f.e.pattern,'eruption');assert.equal(f.e.burrowed,true);
  assert.equal(f.e.targetZ,5);f.s.player.x=6;f.until(()=>f.e.state==='recover');
  assert.equal(f.s.player.hp,1000);assert.equal(f.e.burrowed,false);
  assert.ok(f.calls.effects.some(e=>e.type==='shockwave'&&e.z===5&&e.x===0));
});

test('frostling creates a bounded slowing zone and a slow projectile after its ground tell',()=>{
  const f=fixture('frostling');f.s.player.z=8;f.tick();assert.equal(f.e.pattern,'slow');
  f.until(()=>f.calls.shots.length>0);const shot=f.calls.shots[0];
  assert.equal(shot.options.kind,'frost');assert.equal(shot.options.slow,2.5);
  f.tick();assert.ok(f.s.player.slowTimer>0);assert.ok(f.e.zone.remaining<=3.2);
  f.s.player.x=8;f.tick(35);assert.equal(f.s.player.slowTimer,0);
  f.e.state='recover';f.e.timer=10;f.tick(180);assert.equal(f.e.zone,undefined);
});

test('melee, burst and targeted eruption respect cover and a different floor at resolution',()=>{
  for(const type of ['sentinel','bomber','burrower'])for(const barrier of ['cover','height']){
    const f=fixture(type);f.tick();if(barrier==='cover')f.options.cover=true;else f.s.player.y=8;
    f.until(()=>f.e.state==='recover'||f.e.hp<=0);assert.equal(f.s.player.hp,1000,`${type}/${barrier}`);
  }
});

test('boss families execute different real attack sequences and phase changes once',()=>{
  const observed={};
  for(const family of ['bulwark','tempest','thorn','tide']){
    const f=fixture('boss',{bossId:`boss-${family}`,family,name:family});f.s.player.z=2;
    const first=[];let previous='';
    for(let i=0;i<1100;i++){
      f.tick();if(f.e.state==='telegraph'&&previous!=='telegraph')first.push(f.e.pattern);
      previous=f.e.state;
      // Fixed combat fixture: keep the target near the current arena actor.
      if(f.e.state==='recover'){f.s.player.x=f.e.x;f.s.player.z=f.e.z+2;}
    }
    observed[family]=[...new Set(first)];
    if(family==='tempest')assert.ok(f.calls.shots.some(s=>s.count===3));
    if(family==='thorn')assert.ok(f.calls.spawns.length>0);
    if(family==='tide')assert.ok(f.calls.effects.some(e=>e.pattern==='slow'));
    f.e.hp=f.e.maxHp*.4;f.tick();assert.equal(f.e.phase,2);f.tick(30);assert.equal(f.calls.toasts.length,1);
    f.e.state='chase';f.e.attackCount=0;f.s.player.x=f.e.x;f.s.player.z=f.e.z+2;
    f.until(()=>f.e.state==='telegraph');assert.equal(f.e.phase,2);
    if(family==='tempest'){f.until(()=>f.e.state==='recover');assert.equal(f.calls.shots.at(-1).count,5);}
  }
  assert.deepEqual(observed.bulwark,['slam','charge','sweep']);
  assert.deepEqual(observed.tempest,['bolt','ring']);
  assert.deepEqual(observed.thorn,['summon','sweep','slam']);
  assert.deepEqual(observed.tide,['slow','ring']);
});

test('boss ring is jumpable and physical cover still blocks it',()=>{
  for(const avoid of ['none','jump','cover']){
    const f=fixture('boss',{bossId:'boss-ring',family:'tide',state:'telegraph',pattern:'ring',timer:DT/2,telegraphRadius:9});
    f.s.player.z=6;if(avoid==='jump')f.s.player.y=1.5;if(avoid==='cover')f.options.cover=true;
    f.tick();assert.equal(f.s.player.hp<1000,avoid==='none',avoid);
  }
});

test('phase two introduces bulwark rings, thorn eruptions and tide charges with full tells',()=>{
  for(const [family,pattern,index] of [['bulwark','ring',2],['thorn','eruption',1],['tide','charge',1]]){
    const f=fixture('boss',{bossId:`boss-${family}`,family,phase:2,hp:300,attackCount:index});
    f.s.player.z=4;f.tick();assert.equal(f.e.pattern,pattern);assert.equal(f.e.state,'telegraph');
    assert.ok(f.e.timer>=.8);assert.equal(f.calls.hits.length,0);
    f.until(()=>f.e.state==='recover');assert.ok(f.calls.hits.length>0,`${family} attack reaches a standing target`);
  }
});

test('a lingering slow zone respects cover and jump height on every tick',()=>{
  const f=fixture('frostling');f.s.player.z=8;f.until(()=>!!f.e.zone);
  f.options.cover=true;f.tick(10);assert.equal(f.s.player.slowTimer,0);
  f.options.cover=false;f.s.player.y=3;f.tick(10);assert.equal(f.s.player.slowTimer,0);
  f.s.player.y=0;f.tick();assert.ok(f.s.player.slowTimer>0);
});

test('thorn summons never exceed three living adds and denied spawns are safe',()=>{
  const f=fixture('boss',{bossId:'boss-thorn',family:'thorn',phase:2,hp:300});
  for(let i=0;i<8;i++){Object.assign(f.e,{state:'telegraph',pattern:'summon',timer:DT/2});f.tick();}
  assert.equal(f.calls.spawns.length,3);assert.ok(f.calls.spawns.every(a=>a.summonedBy===f.e.id));
  f.calls.spawns[0].hp=0;Object.assign(f.e,{state:'telegraph',pattern:'summon',timer:DT/2});f.tick();
  assert.equal(f.s.enemies.filter(a=>a.summonedBy===f.e.id&&a.hp>0).length,3);
  const denied=fixture('boss',{bossId:'boss-thorn',family:'thorn'});denied.options.spawnDenied=true;
  denied.until(()=>denied.e.state==='recover');assert.equal(denied.calls.spawns.length,0);
});

test('regional boss keeps real terrain height and stays within its own 22m arena',()=>{
  const f=fixture('boss',{bossId:'boss-remote',family:'bulwark',x:321,y:7,z:-100,homeX:300,homeY:7,homeZ:-100,
    state:'attack',pattern:'charge',timer:.5,vx:20,vz:0,yaw:Math.PI/2});
  f.options.floor=7;f.s.player={x:327,y:7,z:-100,hp:1000};f.tick(60);
  assert.ok(Math.hypot(f.e.x-300,f.e.z+100)<=22.00001);assert.equal(f.e.y,7);
  f.s.player.x=400;const before=Math.hypot(f.e.x-300,f.e.z+100);f.tick(60);
  assert.ok(Math.hypot(f.e.x-300,f.e.z+100)<before);assert.equal(f.e.state,'idle');
});

test('stagger interrupts a boss active attack without being overwritten by recovery',()=>{
  const f=fixture('boss',{bossId:'boss-parry',family:'bulwark',state:'attack',pattern:'charge',timer:.2,vx:0,vz:8});
  f.hooks.damagePlayer=()=>{f.e.state='hit';f.e.timer=.8;return false;};f.tick();
  assert.equal(f.e.state,'hit');assert.ok(f.e.timer>.7);
});

test('expanded AI replay is deterministic and all state remains JSON serializable',()=>{
  const a=fixture('boss',{bossId:'boss-final',family:'tempest',final:true,hp:300});
  const b=fixture('boss',{bossId:'boss-final',family:'tempest',final:true,hp:300});
  for(let i=0;i<1000;i++){
    a.s.player.x=b.s.player.x=Math.sin(i/100)*5;a.tick();b.tick();
  }
  assert.deepEqual(a.s,b.s);assert.deepEqual(a.calls,b.calls);assert.deepEqual(JSON.parse(JSON.stringify(a.s)),a.s);
});
