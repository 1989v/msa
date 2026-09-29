import test from 'node:test';
import assert from 'node:assert/strict';
import {VILLAGE,heightAt} from '../world.mjs';
import {initAdventure} from '../progression.mjs';
import {initJourney,QUESTS} from '../settlements.mjs';
import {DUNGEONS} from '../dungeons.mjs';
import {CROPS,RESIDENTS,RECIPES,initVillage,villageAction,tickVillage,validateVillage,normalizeResidents,residentActors,housingCapacity,recipeUnlocked,raidForecast} from '../village.mjs';
// Explicit controlled domain fixtures. Ordinary travel/cave acceptance is tested separately.
const game=()=>({mode:'playing',player:{...VILLAGE,y:heightAt(VILLAGE.x,VILLAGE.z),hp:40,maxHp:100,stamina:40,maxStamina:100},village:initVillage(),adventure:initAdventure(),journey:initJourney(),expedition:{active:null,progress:{}},progress:{chests:[]},enemies:[],events:[]});
function at(s,p){Object.assign(s.player,{x:p.x,y:heightAt(p.x,p.z),z:p.z});}
function structure(s,type,gx=2,gz=0){s.village.materials={wood:999,stone:999,food:999};const x=VILLAGE.x+gx*4,z=VILLAGE.z+gz*4;at(s,{x:x-3.8,z});const result=villageAction(s,'build',{type,x,z});assert.equal(result.ok,true,result.reason);return s.village.structures.find(b=>b.id===result.id);}
function complete(s,id){const d=DUNGEONS.find(d=>d.id===id);assert.ok(d,id);s.expedition.progress[id]={claimed:true,killed:d.spawns.filter(e=>e.required).map(e=>e.id),solved:d.puzzles.filter(p=>p.required).map(p=>p.id),opened:[]};}
function ally(s,biome){for(const q of QUESTS.filter(q=>q.biomeId===biome)){s.journey.quests[q.id]=2;const {kind,id}=q.objective;if(kind==='gather')s.village.gathered[id]=0;if(kind==='chest')s.progress.chests.push(id);if(kind==='waypoint')s.adventure.waypoints.push(id);if(kind==='trial')s.adventure.completedTasks.push(id);if(kind==='boss')s.adventure.bosses.push(id);if(kind==='dungeon')complete(s,id);}}
const advance=(s,n,h={})=>{for(let i=0;i<n*10;i++)tickVillage(s,.1,h);};
function invite(s,biome){ally(s,biome);at(s,VILLAGE);assert.equal(villageAction(s,'invite',{id:`resident-${biome}`}).ok,true);}

test('four crop harvests add distinct produce without changing legacy food or seed yields',()=>{
  const s=game(),b=structure(s,'plot');at(s,b);
  for(const [id,c] of Object.entries(CROPS)){const p=s.village.plots[0];Object.assign(p,{crop:id,growth:c.growthSeconds,watered:true});const food=s.village.materials.food,seeds=s.village.seeds[id];assert.equal(villageAction(s,'harvest',{id:b.id}).ok,true);assert.equal(s.village.materials.food-food,c.food);assert.equal(s.village.seeds[id]-seeds,1);assert.equal(s.village.produce[id],1);assert.equal(villageAction(s,'harvest',{id:b.id}).ok,false);}
});
test('early meal and named cave recipes consume exact resources and have real effects',()=>{
  const s=game(),k=structure(s,'kitchen');at(s,k);s.village.produce={turnip:3,wheat:2,pumpkin:2,moonflower:2};
  assert.equal(villageAction(s,'craft',{id:'trailMeal'}).ok,true);assert.equal(s.village.produce.turnip,2);assert.equal(s.village.items.trailMeal,1);assert.equal(villageAction(s,'useItem',{id:'trailMeal'}).ok,true);assert.equal(s.player.hp,85);assert.equal(s.player.stamina,75);
  const w=structure(s,'workshop',-2,0);at(s,w);assert.equal(villageAction(s,'craft',{id:'repairKit'}).ok,false);complete(s,'cave-canyon');assert.equal(villageAction(s,'craft',{id:'repairKit'}).ok,true);w.hp=1;assert.equal(villageAction(s,'useItem',{id:'repairKit',targetId:w.id}).ok,true);assert.equal(w.hp,101);
  complete(s,'cave-mistwood');at(s,k);assert.equal(villageAction(s,'craft',{id:'growthTonic'}).ok,true);const b=structure(s,'plot',0,2);at(s,b);villageAction(s,'plant',{id:b.id,crop:'pumpkin'});assert.equal(villageAction(s,'useItem',{id:'growthTonic',targetId:b.id}).ok,true);assert.equal(s.village.plots[0].growth,45);assert.equal(s.village.plots[0].watered,true);
});
test('recipe failures are atomic for forged flags, unknown or inherited IDs, nonfinite amounts, range and output overflow',()=>{
  const s=game(),b=structure(s,'workshop');at(s,b);s.village.produce.pumpkin=2;s.expedition.progress['cave-canyon']={claimed:true,killed:[],solved:[]};
  assert.equal(recipeUnlocked(s,'repairKit'),false);
  for(const payload of [{id:'repairKit'},{id:'__proto__'},{id:'constructor'},Object.create({id:'repairKit'}),{id:NaN},null]){const before=JSON.stringify(s);assert.equal(villageAction(s,'craft',payload).ok,false);assert.equal(JSON.stringify(s),before);}
  complete(s,'cave-canyon');for(const n of [NaN,Infinity,-1,1.5]){s.village.produce.pumpkin=n;const before=structuredClone(s.village);assert.equal(villageAction(s,'craft',{id:'repairKit'}).ok,false);assert.deepEqual(s.village,before);}
  s.village.produce.pumpkin=2;s.village.items.repairKit=9999;assert.equal(villageAction(s,'craft',{id:'repairKit'}).ok,false);s.village.items.repairKit=0;at(s,{x:VILLAGE.x+80,z:VILLAGE.z});assert.equal(villageAction(s,'craft',{id:'repairKit'}).ok,false);
});
test('invitations require validated regional proof and one intact house per named resident',()=>{
  const s=game();ally(s,'coast');assert.equal(villageAction(s,'invite',{id:'resident-coast'}).ok,false);const b=structure(s,'cottage');at(s,VILLAGE);s.journey.allies=['town-dunes'];assert.equal(villageAction(s,'invite',{id:'resident-dunes'}).ok,false);assert.equal(villageAction(s,'invite',{id:'resident-coast'}).ok,true);assert.equal(villageAction(s,'invite',{id:'resident-coast'}).ok,false);ally(s,'dunes');assert.equal(villageAction(s,'invite',{id:'resident-dunes'}).ok,false);b.hp=0;assert.equal(housingCapacity(s),0);const before=structuredClone(s.village);assert.equal(villageAction(s,'assign',{id:'resident-coast',job:'guard'}).ok,false);assert.deepEqual(s.village,before);
});
test('stable worker capacity pauses excess assignments and timers and resumes after house repair',()=>{
  const s=game(),a=structure(s,'cottage'),b=structure(s,'cottage',-2,0);invite(s,'dunes');invite(s,'coast');s.village.residents.reverse();s.village.residents.forEach(r=>{r.job='farmer';r.timer=2;});b.hp=0;advance(s,1);assert.ok(Math.abs(s.village.residents.find(r=>r.id==='resident-coast').timer-3)<1e-8);assert.equal(s.village.residents.find(r=>r.id==='resident-dunes').timer,2);assert.deepEqual(residentActors(s).map(r=>[r.id,r.active]),[['resident-coast',true],['resident-dunes',false]]);a.hp=0;advance(s,2);assert.equal(s.village.residents.find(r=>r.id==='resident-dunes').timer,2);b.hp=180;a.hp=180;advance(s,1);assert.ok(s.village.residents.every(r=>r.timer>2));
});
test('farmer waters, artisan spends materials on repair and guard damages visible raiders',()=>{
  const s=game(),house=structure(s,'cottage');invite(s,'coast');const b=structure(s,'plot',-2,0);at(s,b);villageAction(s,'plant',{id:b.id,crop:'turnip'});at(s,VILLAGE);advance(s,6);assert.equal(s.village.plots[0].watered,true);
  assert.equal(villageAction(s,'assign',{id:'resident-coast',job:'artisan'}).ok,true);house.hp=100;const wood=s.village.materials.wood;advance(s,8);assert.equal(house.hp,130);assert.equal(s.village.materials.wood,wood-1);
  villageAction(s,'assign',{id:'resident-coast',job:'guard'});const a=residentActors(s)[0];s.enemies.push({id:'raid-fixture',raid:true,x:a.x+2,y:a.y,z:a.z,hp:30});advance(s,2,{solidQuery:()=>[],lineClear:()=>true});assert.equal(s.enemies[0].hp,22);
});
test('work pauses away, in dungeon or menus; round trip save preserves timers without duplicate work',()=>{
  const s=game();structure(s,'cottage');invite(s,'coast');s.village.residents[0].timer=3;at(s,{x:VILLAGE.x+100,z:VILLAGE.z});advance(s,8);assert.equal(s.village.residents[0].timer,3);at(s,VILLAGE);s.expedition.active={id:'cave-canyon'};advance(s,8);assert.equal(s.village.residents[0].timer,3);s.expedition.active=null;s.mode='paused';advance(s,8);assert.equal(s.village.residents[0].timer,3);s.mode='playing';s.village=validateVillage(JSON.parse(JSON.stringify(s.village)));normalizeResidents(s);assert.equal(s.village.residents[0].timer,3);assert.equal(s.village.residents[0].job,'farmer');s.journey.quests['quest-coast-regional']=0;normalizeResidents(s);assert.deepEqual(s.village.residents,[]);
});
test('old saves default empty, inventory and resident timers are bounded, invalid proof cannot retain recruits',()=>{
  const v=initVillage();delete v.produce;delete v.items;delete v.residents;const clean=validateVillage(v);assert.ok(Object.values(clean.produce).every(n=>n===0));assert.ok(Object.values(clean.items).every(n=>n===0));assert.deepEqual(clean.residents,[]);
  v.produce={turnip:Infinity,wheat:1e9,pumpkin:-2,moonflower:3.8};v.items={repairKit:1e9};v.residents=[{id:'resident-coast',job:'__proto__',timer:Infinity},{id:'resident-coast',job:'guard',timer:2},{id:'constructor'}];const result=validateVillage(v);assert.deepEqual(result.produce,{turnip:0,wheat:9999,pumpkin:0,moonflower:3});assert.equal(result.items.repairKit,9999);assert.deepEqual(result.residents,[{id:'resident-coast',job:'farmer',timer:0}]);const s=game();s.village=result;s.journey.allies=['town-coast'];normalizeResidents(s);assert.deepEqual(s.village.residents,[]);
});
test('forecast identifies both stable waves, direction and tactical roles before night',()=>{
  const s=game();assert.equal(Object.keys(RESIDENTS).length,8);assert.equal(Object.keys(RECIPES).length,3);assert.equal(raidForecast(s).direction,'north');assert.match(raidForecast(s).text,/3.*4.*늑대.*돌격수/);s.village.day=2;assert.equal(raidForecast(s).direction,'east');
});
test('raider roles commit differently: charger pressures a house while wolf flanks and slime follows beacon',()=>{
  const s=game(),house=structure(s,'cottage');at(s,{x:house.x+2,z:house.z+2});
  const make=(type,index,x,z)=>({id:`raid-1-1-${index}`,type,x,y:heightAt(x,z),z,hp:50,maxHp:50,state:'chase',timer:0,attackCount:0,raid:true,raidDay:1,raidWave:1,raidIndex:index});
  const charger=make('charger',0,house.x+2,house.z),wolf=make('wolf',1,VILLAGE.x-8,VILLAGE.z),slime=make('slime',2,VILLAGE.x,VILLAGE.z+12);
  s.enemies=[charger,wolf,slime];Object.assign(s.village.raid,{status:'active',day:1,wave:1,spawned:true,enemies:structuredClone(s.enemies)});
  const wolfDirect=Math.atan2(s.player.x-wolf.x,s.player.z-wolf.z);
  tickVillage(s,.1,{solidQuery:()=>[],lineClear:()=>true});assert.equal(charger.raidTarget,house.id);assert.equal(charger.state,'telegraph');assert.ok(Math.abs(wolf.yaw-wolfDirect)>.4);assert.ok(Math.abs(Math.abs(slime.yaw)-Math.PI)<.01);
});
test('simultaneous artisans select current damaged targets and never pay for a completed repair',()=>{
  const s=game(),a=structure(s,'cottage'),b=structure(s,'cottage',-2,0);invite(s,'coast');invite(s,'dunes');
  for(const r of s.village.residents){r.job='artisan';r.timer=8;}
  a.hp=a.maxHp-1;const wood=s.village.materials.wood,stone=s.village.materials.stone;
  tickVillage(s,.1);assert.equal(a.hp,a.maxHp);assert.equal(s.village.materials.wood,wood-1);assert.equal(s.village.materials.stone,stone-1);assert.equal(s.village.residents[1].timer,8,'waiting worker preserves ready timer');
  a.hp=a.maxHp-1;b.hp=b.maxHp-1;s.village.residents[0].timer=8;
  tickVillage(s,.1);assert.equal(a.hp,a.maxHp);assert.equal(b.hp,b.maxHp);assert.equal(s.village.materials.wood,wood-3);assert.ok(s.village.residents.every(r=>r.timer===0));
});
test('simultaneous farmers select current dry plots and retain ready timer when no watering remains',()=>{
  const s=game();structure(s,'cottage');structure(s,'cottage',-2,0);invite(s,'coast');invite(s,'dunes');const a=structure(s,'plot',0,2),b=structure(s,'plot',0,-2);
  at(s,a);villageAction(s,'plant',{id:a.id,crop:'turnip'});at(s,VILLAGE);for(const r of s.village.residents){r.job='farmer';r.timer=6;}
  tickVillage(s,.1);assert.equal(s.village.plots[0].watered,true);assert.equal(s.village.residents[1].timer,6);
  s.village.plots[0].watered=false;at(s,b);villageAction(s,'plant',{id:b.id,crop:'turnip'});at(s,VILLAGE);s.village.residents[0].timer=6;
  tickVillage(s,.1);assert.ok(s.village.plots.every(p=>p.watered));assert.ok(s.village.residents.every(r=>r.timer===0));
});
