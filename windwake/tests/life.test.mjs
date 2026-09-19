import test from 'node:test';
import assert from 'node:assert/strict';
import {VILLAGE,RESOURCE_NODES,WAYPOINTS,BOSS_SITES,heightAt} from '../world.mjs';
import {SKILLS,ACTIVE_SKILLS,initAdventure,awardXP,learnSkill,equipSkill,modifiers,validateAdventure,xpForLevel} from '../progression.mjs';
import {CROPS,BUILDINGS,initVillage,villageAction,tickVillage,villageInteraction,villageObjective,villageSolids,captureRaid,restoreRaid,failRaid,validateVillage} from '../village.mjs';

// Controlled domain fixtures: these tests do not claim a natural player-input journey.
function fixture(){
  return {mode:'playing',player:{x:VILLAGE.x,y:heightAt(VILLAGE.x,VILLAGE.z),z:VILLAGE.z,
    hp:100,maxHp:100,stamina:100,maxStamina:100,energy:100,maxEnergy:100,flasks:3},
    adventure:initAdventure(),village:initVillage(),enemies:[],events:[],effects:[]};
}
function at(s,target,offset=0){s.player.x=target.x+offset;s.player.z=target.z;s.player.y=heightAt(s.player.x,s.player.z);}
function build(s,type,gx=2,gz=0){
  const x=VILLAGE.x+gx*4,z=VILLAGE.z+gz*4;at(s,{x,z},-3.8);
  const result=villageAction(s,'build',{type,x,z});assert.equal(result.ok,true,result.reason);
  return s.village.structures.find(b=>b.id===result.id);
}
function hooks(s,{capacity=64}={}){
  return {spawn(type,x,z,extra){if(s.enemies.length>=capacity)return null;
    const e={type,x,z,y:heightAt(x,z),hp:50,maxHp:50,state:'idle',timer:0,...extra};s.enemies.push(e);return e;},
    damageEnemy(e,damage){e.hp=Math.max(0,e.hp-damage);},damagePlayer(amount){s.player.hp=Math.max(0,s.player.hp-amount);},rewardXP(amount){awardXP(s,amount);}};
}
function advance(s,seconds,h=hooks(s)){for(let i=0;i<Math.round(seconds*60);i++)tickVillage(s,1/60,h);}
function startRaid(){
  const s=fixture();build(s,'cottage');s.village.tasks.push('harvest');s.village.clock=449.99;at(s,VILLAGE);
  advance(s,11);assert.equal(s.village.raid.status,'active');return s;
}
function killWave(s){for(const e of s.enemies)if(e.raid)e.hp=0;tickVillage(s,1/60,hooks(s));}
function reloadVillage(s){captureRaid(s);s.village=validateVillage(JSON.parse(JSON.stringify(s.village)));s.enemies=[];return s;}

test('three branches expose eighteen prerequisite nodes and four usable ability definitions',()=>{
  assert.equal(SKILLS.length,18);assert.equal(new Set(SKILLS.map(n=>n.id)).size,18);
  assert.deepEqual(Object.keys(ACTIVE_SKILLS).sort(),['bloom','quake','sunbolt','winddash']);
  for(const n of SKILLS){assert.ok(n.description);assert.ok(n.cost>0);for(const id of n.requires)assert.ok(SKILLS.some(n=>n.id===id));}
  for(const a of Object.values(ACTIVE_SKILLS)){assert.ok(a.energy>0);assert.ok(a.cooldown>0);}
});
test('first skill build spends a finite budget, enforces prerequisites and autoequips',()=>{
  const s=fixture();assert.equal(learnSkill(s,'sunbolt').ok,false);assert.equal(s.adventure.points,2);
  assert.equal(learnSkill(s,'edge').ok,true);assert.equal(learnSkill(s,'sunbolt').ok,true);
  assert.deepEqual(s.adventure.equipped,['sunbolt',null]);assert.equal(s.adventure.points,0);
  assert.equal(learnSkill(s,'sunbolt').ok,false);assert.equal(learnSkill(s,'guard').ok,false);
  assert.equal(s.adventure.points,0);assert.equal(equipSkill(s,'quake',1).ok,false);
  assert.equal(equipSkill(s,'sunbolt',1).ok,true);assert.deepEqual(s.adventure.equipped,[null,'sunbolt']);
  assert.equal(equipSkill(s,null,7).ok,false);assert.equal(equipSkill(s,null,1).ok,true);
});
test('XP crossing multiple thresholds preserves spent points and rejects nonfinite rewards',()=>{
  const s=fixture();learnSkill(s,'edge');awardXP(s,xpForLevel(5));assert.equal(s.adventure.level,5);assert.equal(s.adventure.points,9);
  const before=structuredClone(s.adventure);for(const n of [-10,Infinity,NaN,'10'])assert.equal(awardXP(s,n).ok,false);
  assert.deepEqual(s.adventure,before);awardXP(s,1e9);assert.equal(s.adventure.level,30);assert.equal(s.adventure.xp,1e6);
});
test('modifiers apply real flat bonuses, multipliers and additive capacities once',()=>{
  const s=fixture();assert.deepEqual(modifiers(s),{bladeDamage:0,speed:1,stamina:0,energy:0,armor:0,harvest:1,towerDamage:1});
  s.adventure.learned=['edge','edge','quickstep','endurance','reservoir','gardener','sentry'];
  assert.deepEqual(modifiers(s),{bladeDamage:3,speed:1.08,stamina:25,energy:25,armor:0,harvest:1.25,towerDamage:1.35});
});
test('adventure validation derives points, rejects unknown and unaffordable nodes, closes prerequisites',()=>{
  const a=validateAdventure({xp:0,level:30,points:900,learned:['quake','heavyblade','edge','sunbolt','edge'],equipped:['quake','sunbolt'],
    bosses:['fake',BOSS_SITES[0].id,BOSS_SITES[0].id],waypoints:['fake',WAYPOINTS[1].id],finalDefeated:true,
    worldDefeated:JSON.parse('{"__proto__":true,"normal-enemy":true,"bad":12}')});
  assert.equal(a.level,1);assert.equal(a.points,0);assert.deepEqual(a.learned,['edge','sunbolt']);
  assert.deepEqual(a.equipped,[null,'sunbolt']);assert.equal(a.finalDefeated,false);assert.equal(a.bosses.length,1);
  assert.deepEqual(a.waypoints,['home',WAYPOINTS[1].id]);assert.equal(Object.hasOwn(a.worldDefeated,'__proto__'),false);
  assert.equal(a.worldDefeated['normal-enemy'],true);assert.equal(Object.getPrototypeOf(a.worldDefeated),Object.prototype);
});
test('village starts with eight recipes, four crops and enough supplies for home, two plots and tower',()=>{
  const s=fixture();assert.equal(Object.keys(BUILDINGS).length,8);assert.equal(Object.keys(CROPS).length,4);
  build(s,'cottage',2,0);build(s,'plot',-2,0);build(s,'plot',0,2);build(s,'tower',0,-2);
  assert.equal(s.village.structures.length,4);assert.ok(s.village.materials.wood>=0);assert.ok(s.village.materials.stone>=0);
});
test('placement failures are atomic for occupancy, distance, reserved pads, invalid and unaffordable inputs',()=>{
  const s=fixture();const b=build(s,'plot');at(s,b);const before=structuredClone(s.village);
  for(const payload of [{type:'plot',x:b.x,z:b.z},{type:'plot',x:NaN,z:0},{type:'plot',x:VILLAGE.x,z:VILLAGE.z},
    {type:'plot',x:VILLAGE.x+200,z:VILLAGE.z},{type:'constructor',x:b.x,z:b.z},{type:'granary',x:VILLAGE.x,z:VILLAGE.z+8}])
    assert.equal(villageAction(s,'build',payload).ok,false);
  assert.deepEqual(s.village,before);
  s.village.materials.wood=0;const empty=structuredClone(s.village);
  assert.equal(villageAction(s,'build',{type:'plot',x:b.x,z:b.z+4}).ok,false);assert.deepEqual(s.village,empty);
  at(s,{x:500,z:500});assert.equal(villageAction(s,'water',{id:b.id}).ok,false);
});
test('watered crop growth follows simulation only and harvest grants food and seed exactly once',()=>{
  const s=fixture(),b=build(s,'plot');at(s,b);const seeds=s.village.seeds.turnip;
  assert.equal(villageAction(s,'plant',{id:b.id,crop:'turnip'}).ok,true);advance(s,60);
  assert.equal(s.village.plots[0].growth,0);assert.equal(villageAction(s,'harvest',{id:b.id}).ok,false);
  assert.equal(villageAction(s,'water',{id:b.id}).ok,true);s.mode='dead';advance(s,60);assert.equal(s.village.plots[0].growth,0);
  s.mode='playing';advance(s,46);assert.equal(s.village.plots[0].stage,'ripe');const food=s.village.materials.food;
  assert.equal(villageAction(s,'harvest',{id:b.id}).ok,true);assert.equal(s.village.materials.food,food+3);
  assert.equal(s.village.seeds.turnip,seeds);const after=structuredClone(s.village);
  assert.equal(villageAction(s,'harvest',{id:b.id}).ok,false);assert.deepEqual(s.village,after);
});
test('crop save restores deterministic growth and does not apply offline time',()=>{
  const s=fixture(),b=build(s,'plot');at(s,b);villageAction(s,'plant',{id:b.id,crop:'pumpkin'});villageAction(s,'water',{id:b.id});advance(s,20);
  const saved=structuredClone(s.village);s.village=validateVillage(saved);assert.equal(s.village.plots[0].growth,saved.plots[0].growth);
  assert.equal(s.village.plots[0].stage,'seed');assert.equal(s.village.clock,saved.clock);
  advance(s,100);assert.equal(s.village.plots[0].stage,'ripe');
});
test('removing a planted plot refunds one seed and half materials without a harvest reward',()=>{
  const s=fixture(),b=build(s,'plot');at(s,b);const seeds=s.village.seeds.turnip;
  villageAction(s,'plant',{id:b.id,crop:'turnip'});const food=s.village.materials.food,wood=s.village.materials.wood;
  assert.equal(villageAction(s,'remove',{id:b.id}).ok,true);assert.equal(s.village.seeds.turnip,seeds);
  assert.equal(s.village.materials.food,food);assert.equal(s.village.materials.wood,wood+2);assert.equal(s.village.plots.length,0);
  assert.equal(villageAction(s,'remove',{id:b.id}).ok,false);
});
test('renewable gathering checks real distance and cooldown without consuming failed actions',()=>{
  const s=fixture(),node=RESOURCE_NODES.find(n=>n.id==='resource-home-wood');
  assert.equal(villageAction(s,'gather',{id:node.id}).ok,false);at(s,node);const wood=s.village.materials.wood;
  assert.equal(villageAction(s,'gather',{id:node.id}).ok,true);assert.equal(s.village.materials.wood,wood+node.amount);
  assert.equal(villageAction(s,'gather',{id:node.id}).ok,false);advance(s,node.cooldown+1);
  assert.equal(villageAction(s,'gather',{id:node.id}).ok,true);assert.equal(s.village.materials.wood,wood+node.amount*2);
});
test('zero inventory has a free seed and beacon recovery path without repeatable grants',()=>{
  const s=fixture();s.village.materials={wood:0,stone:0,food:0};for(const id of Object.keys(CROPS))s.village.seeds[id]=0;
  assert.equal(villageAction(s,'trade',{kind:'recovery'}).ok,true);assert.equal(s.village.seeds.turnip,1);
  assert.equal(villageAction(s,'trade',{kind:'recovery'}).ok,false);s.village.beaconHp=0;
  assert.equal(villageAction(s,'repair',{id:'beacon'}).ok,true);assert.equal(s.village.beaconHp,180);
  assert.deepEqual(s.village.materials,{wood:0,stone:0,food:0});
});
test('home trade and upgrades validate proximity, resources and reputation',()=>{
  const s=fixture();s.player.hp=30;assert.equal(villageAction(s,'trade',{kind:'food'}).ok,true);assert.equal(s.player.hp,65);
  assert.equal(villageAction(s,'upgrade').ok,false);s.village.reputation=6;assert.equal(villageAction(s,'upgrade').ok,true);assert.equal(s.village.level,2);
  at(s,{x:500,z:500});assert.equal(villageAction(s,'trade',{kind:'seed',crop:'wheat'}).ok,false);assert.equal(villageAction(s,'rest').ok,false);
});
test('interaction returns an executable in-range payload and tutorial gives next actual action',()=>{
  const s=fixture(),b=build(s,'plot');at(s,b);let near=villageInteraction(s);
  assert.equal(near.action,'plant');assert.equal(villageAction(s,near.action,near.payload).ok,true);
  near=villageInteraction(s);assert.equal(near.action,'water');assert.equal(villageAction(s,near.action,near.payload).ok,true);
  assert.equal(typeof villageObjective(s),'string');at(s,{x:500,z:500});assert.equal(villageInteraction(s),null);
});
test('intact solid structures expose collision cuboids and rotated fences change extents',()=>{
  const s=fixture(),b=build(s,'fence');b.facing=Math.PI/2;let box=villageSolids(s)[0];
  assert.equal(box.w,.6);assert.equal(box.d,3.6);b.hp=0;assert.deepEqual(villageSolids(s),[]);
});
test('a planted crop alone never schedules the first raid before completed harvest',()=>{
  const s=fixture();build(s,'cottage');build(s,'plot',-2,0);const b=s.village.plots[0];at(s,b);
  villageAction(s,'plant',{id:b.id,crop:'turnip'});s.village.clock=449;advance(s,20);assert.equal(s.village.raid.status,'idle');
  s.village.tasks.push('harvest');tickVillage(s,1/60,hooks(s));assert.equal(s.village.raid.status,'queued');
});
test('queued raid pauses the day while away and saves its warning countdown',()=>{
  const s=fixture();build(s,'cottage');s.village.tasks.push('harvest');s.village.clock=449.99;at(s,{x:500,z:500});
  tickVillage(s,1/60,hooks(s));const clock=s.village.clock;advance(s,700);
  assert.equal(s.village.raid.status,'queued');assert.equal(s.village.clock,clock);assert.equal(s.village.day,1);assert.equal(s.village.raid.timer,10);
  reloadVillage(s);assert.equal(s.village.raid.status,'queued');at(s,VILLAGE);advance(s,11);assert.equal(s.village.raid.status,'active');
});
test('active raid survives repeated reload with exact remaining HP and no instant reward',()=>{
  const s=startRaid(),r=s.village.raid;s.enemies[0].hp=11;s.enemies[1].hp=0;captureRaid(s);
  assert.equal(r.enemies.length,2);const xp=s.adventure.xp;
  for(let i=0;i<3;i++){reloadVillage(s);restoreRaid(s,hooks(s));assert.equal(s.enemies.length,2);assert.ok(s.enemies.some(e=>e.hp===11));
    tickVillage(s,1/60,hooks(s));assert.equal(s.village.raid.status,'active');assert.equal(s.adventure.xp,xp);}
});
test('missing/cap-blocked raid actors remain pending rather than counting as defeated',()=>{
  const s=startRaid();captureRaid(s);s.enemies=[];const xp=s.adventure.xp;
  for(let i=0;i<10;i++)tickVillage(s,1/60,hooks(s,{capacity:0}));
  assert.equal(s.village.raid.enemies.length,3);assert.equal(s.village.raid.status,'active');assert.equal(s.adventure.xp,xp);
  restoreRaid(s,hooks(s));assert.equal(s.enemies.length,3);
});
test('between-wave save restores countdown and full victory pays once across reload',()=>{
  const s=startRaid();killWave(s);assert.equal(s.village.raid.wave,2);assert.equal(s.village.raid.spawned,false);
  advance(s,1);const timer=s.village.raid.timer;reloadVillage(s);assert.equal(s.village.raid.timer,timer);assert.equal(s.village.raid.enemies.length,0);
  advance(s,4);assert.equal(s.village.raid.enemies.length,4);const wood=s.village.materials.wood,xp=s.adventure.xp;
  killWave(s);assert.equal(s.village.raid.status,'won');assert.equal(s.village.materials.wood,wood+12);assert.equal(s.adventure.xp,xp+75);
  const earned=s.adventure.xp,paid=s.village.materials.wood;reloadVillage(s);advance(s,10);
  assert.equal(s.adventure.xp,earned);assert.equal(s.village.materials.wood,paid);assert.equal(s.village.raid.status,'won');
});
test('raid loss preserves progression and repairable crops while free beacon recovery works',()=>{
  const s=startRaid();s.adventure.learned=['edge'];const xp=s.adventure.xp;s.village.beaconHp=0;tickVillage(s,1/60,hooks(s));
  assert.equal(s.village.raid.status,'lost');assert.equal(s.adventure.xp,xp);assert.deepEqual(s.adventure.learned,['edge']);assert.equal(s.enemies.length,0);
  reloadVillage(s);at(s,VILLAGE);assert.equal(villageAction(s,'repair',{id:'beacon'}).ok,true);assert.equal(s.village.beaconHp,180);
  assert.equal(failRaid(s),false);tickVillage(s,1/60,hooks(s));assert.equal(s.village.raid.status,'lost');
});
test('active raid freezes while distant and player death does not mutate its surviving wave',()=>{
  const s=startRaid();captureRaid(s);const before=structuredClone(s.village.raid);at(s,{x:500,z:500});advance(s,20);
  assert.deepEqual(s.village.raid,before);s.mode='dead';advance(s,20);assert.deepEqual(s.village.raid,before);
});
test('towers really damage approaching raid actors and walls can absorb their attacks',()=>{
  const s=startRaid();const r=s.village.raid;
  s.village.structures.push({id:'building-50',type:'tower',x:VILLAGE.x+8,y:heightAt(VILLAGE.x+8,VILLAGE.z),z:VILLAGE.z,facing:0,hp:160,maxHp:160,cooldown:0});
  const e=s.enemies[0];e.x=VILLAGE.x+8;e.z=VILLAGE.z+8;e.y=heightAt(e.x,e.z);at(s,{x:VILLAGE.x-20,z:VILLAGE.z});const hp=e.hp;
  tickVillage(s,1/60,hooks(s));assert.ok(e.hp<hp);
  s.village.structures=s.village.structures.filter(b=>b.type!=='tower');
  const wall={id:'building-51',type:'fence',x:VILLAGE.x,y:heightAt(VILLAGE.x,VILLAGE.z+8),z:VILLAGE.z+8,facing:0,hp:110,maxHp:110,cooldown:0};s.village.structures.push(wall);
  e.x=VILLAGE.x;e.z=VILLAGE.z+10;e.y=heightAt(e.x,e.z);e.state='chase';e.timer=0;
  advance(s,2);assert.ok(wall.hp<110);assert.equal(r.status,'active');
});
test('adverse village saves normalize duplicate cells, dangling plots, numbers and forged empty raid',()=>{
  const s=startRaid(),raw=structuredClone(s.village),b=raw.structures[0];
  raw.structures.push({...b,id:'building-80'},{...b,id:'__proto__',x:Infinity});raw.plots.push({id:'missing',crop:'turnip',growth:Infinity});
  raw.materials.wood=Infinity;raw.seeds.turnip=-90;raw.clock=Infinity;raw.raid.enemies=[];raw.raid.defeated=[];
  const v=validateVillage(raw);assert.equal(v.structures.length,1);assert.equal(v.plots.length,0);assert.equal(v.materials.wood,0);
  assert.equal(v.seeds.turnip,0);assert.equal(v.clock,90);assert.equal(v.raid.status,'lost');assert.equal(v.raid.rewarded,false);
  assert.equal(JSON.stringify(v).includes('null'),false);
});
test('malformed action inputs and paused modes never spend or throw',()=>{
  const s=fixture(),before=structuredClone(s.village);
  for(const payload of [null,undefined,{},'bad',[],{id:'__proto__'},{type:'__proto__'}]){
    assert.equal(villageAction(s,'plant',payload).ok,false);assert.equal(villageAction(s,'build',payload).ok,false);
  }
  assert.deepEqual(s.village,before);s.mode='dead';assert.equal(villageAction(s,'rest').ok,false);assert.equal(learnSkill(s,'edge').ok,false);
});
test('all crop kinds complete their distinct growth cycles and seed budgets remain renewable',()=>{
  for(const [id,def] of Object.entries(CROPS)){
    const s=fixture(),b=build(s,'plot');at(s,b);const seeds=s.village.seeds[id];
    villageAction(s,'plant',{id:b.id,crop:id});villageAction(s,'water',{id:b.id});advance(s,def.growthSeconds+1);
    assert.equal(villageAction(s,'harvest',{id:b.id}).food,def.food);assert.equal(s.village.seeds[id],seeds);
  }
});
test('rotated fences reject construction around the player using actual rotated extents',()=>{
  const s=fixture(),cell={x:VILLAGE.x+8,z:VILLAGE.z};at(s,cell);s.player.z+=1.5;s.player.y=heightAt(s.player.x,s.player.z);
  const before=structuredClone(s.village);assert.equal(villageAction(s,'build',{type:'fence',...cell,facing:Math.PI/2}).ok,false);
  assert.deepEqual(s.village,before);
});
test('save validation enforces placement and plot caps while generated IDs never collide',()=>{
  const raw=initVillage();raw.structures=[];raw.plots=[];
  for(let gx=-6;gx<=6;gx++)for(let gz=-6;gz<=6;gz++){
    const id=`building-${raw.structures.length+1}`,x=VILLAGE.x+gx*4,z=VILLAGE.z+gz*4;
    raw.structures.push({id,type:'plot',x,z,hp:60});raw.plots.push({id,crop:'turnip',watered:true,growth:1000});
  }
  const v=validateVillage(raw);assert.equal(v.plots.length,16);assert.equal(v.structures.length,16);
  for(const p of v.plots){assert.equal(p.stage,'ripe');assert.equal(p.growth,CROPS.turnip.growthSeconds);assert.ok(Math.hypot(p.x-VILLAGE.x,p.z-VILLAGE.z)<=26);}
  assert.ok(v.structures.every(b=>Number(b.id.slice(9))<v.nextId));
});
function raidActorAt(s,x,z){
  const e=s.enemies[0];Object.assign(e,{x,z,y:heightAt(x,z),state:'chase',timer:0,yaw:0});
  for(const other of s.enemies.slice(1)){other.x=VILLAGE.x+40;other.z=VILLAGE.z+30;other.y=heightAt(other.x,other.z);}
  s.village.structures=[];return e;
}
test('nearby player is protected by an intact fence and the raider attacks that fence instead',()=>{
  const s=startRaid(),e=raidActorAt(s,-26,-87),wall={id:'building-90',type:'fence',x:-26,z:-86,y:heightAt(-26,-86),facing:0,hp:110,maxHp:110,cooldown:0};
  s.village.structures.push(wall);at(s,{x:-26,z:-85});advance(s,1.2);
  assert.equal(s.player.hp,100,'the fence must intercept a strike against the nearby player');
  assert.ok(wall.hp<110,'the intervening fence takes the attack');assert.ok(e.z<wall.z);
});
test('raid strikes recheck static cover and vertical separation at the end of windup',()=>{
  for(const obstacle of ['wall','height']){
    const s=startRaid(),e=raidActorAt(s,-26,-87);at(s,{x:-26,z:-85});
    Object.assign(e,{state:'telegraph',timer:0,raidTarget:'player'});
    const h=hooks(s);
    if(obstacle==='wall')h.solidQuery=()=>[{id:'test-cover',x:-26,z:-86,y:e.y,w:3,d:.6,h:4}];
    else s.player.y=e.y+3;
    tickVillage(s,1/60,h);assert.equal(s.player.hp,100,obstacle);
  }
});
test('raid windup keeps its facing so circling behind avoids an attack',()=>{
  const s=startRaid(),e=raidActorAt(s,-26,-87);at(s,{x:-26,z:-85});tickVillage(s,1/60,hooks(s));
  assert.equal(e.state,'telegraph');const yaw=e.yaw;at(s,{x:-26,z:-89});advance(s,.95);
  assert.equal(s.player.hp,100);assert.equal(e.yaw,yaw);
});
test('blocked raid sidesteps test collision on both sides before moving',()=>{
  const s=startRaid(),e=raidActorAt(s,VILLAGE.x,VILLAGE.z+15);at(s,{x:VILLAGE.x+20,z:VILLAGE.z});
  e.raidIndex=1;const origin={x:e.x,z:e.z},boxes=[
    {id:'front',x:e.x,z:e.z-.9,y:e.y,w:3,d:.5,h:3},
    {id:'right',x:e.x+.8,z:e.z,y:e.y,w:.5,d:4,h:3},
    {id:'left',x:e.x-.8,z:e.z,y:e.y,w:.5,d:4,h:3},
  ];
  tickVillage(s,.1,{...hooks(s),solidQuery:()=>boxes});
  assert.equal(e.x,origin.x);assert.equal(e.z,origin.z);
});
test('tower shots respect tall cover while their elevated muzzle shoots over a low fence',()=>{
  for(const coverHeight of [8,1.6]){
    const s=startRaid(),e=raidActorAt(s,VILLAGE.x+8,VILLAGE.z+12);at(s,{x:VILLAGE.x-20,z:VILLAGE.z});
    const tower={id:'building-91',type:'tower',x:VILLAGE.x+8,z:VILLAGE.z,y:heightAt(VILLAGE.x+8,VILLAGE.z),facing:0,hp:160,maxHp:160,cooldown:0};
    s.village.structures.push(tower);const hp=e.hp;
    const box={id:'tower-cover',x:tower.x,z:tower.z+6,y:tower.y,w:4,d:1,h:coverHeight};
    tickVillage(s,1/60,{...hooks(s),solidQuery:()=>[box]});
    if(coverHeight>4)assert.equal(e.hp,hp,'tall cover blocks tower arrows');
    else assert.ok(e.hp<hp,'tower muzzle clears the low fence');
  }
});
test('saving during a raid windup preserves its structure target and fixed facing',()=>{
  const s=startRaid(),e=raidActorAt(s,-26,-87),wall={id:'building-90',type:'fence',x:-26,z:-86,y:heightAt(-26,-86),facing:0,hp:110,maxHp:110,cooldown:0};
  s.village.structures.push(wall);at(s,{x:-26,z:-85});tickVillage(s,1/60,hooks(s));
  assert.equal(e.raidTarget,wall.id);const yaw=e.yaw;reloadVillage(s);restoreRaid(s,hooks(s));
  const restored=s.enemies.find(actor=>actor.id===e.id);assert.equal(restored.raidTarget,wall.id);assert.equal(restored.yaw,yaw);
  at(s,{x:-26,z:-89});advance(s,1);assert.equal(s.player.hp,100);assert.ok(s.village.structures[0].hp<110);
});
test('raid attack respects an integration LOS hook even when its local cover query is empty',()=>{
  const s=startRaid(),e=raidActorAt(s,-26,-87);at(s,{x:-26,z:-85});
  Object.assign(e,{state:'telegraph',timer:0,raidTarget:'player'});let checked=false;
  tickVillage(s,1/60,{...hooks(s),solidQuery:()=>[],lineClear(a,b){checked=true;assert.equal(a,e);assert.equal(b,s.player);return false;}});
  assert.equal(checked,true);assert.equal(s.player.hp,100);
});
