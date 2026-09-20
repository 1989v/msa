import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWNS,VILLAGE,RESOURCE_NODES,heightAt} from '../world.mjs';
import {initAdventure,awardXP,learnSkill,modifiers} from '../progression.mjs';
import {initVillage,villageAction,villageInteraction,tickVillage} from '../village.mjs';
import {QUESTS,SERVICES,initJourney,validateJourney,townInteraction,townAction,questStatus,trackQuest,journeyObjective} from '../settlements.mjs';
import {RELICS,grantRelic,equipRelic,allianceBenefits} from '../relics.mjs';

// Controlled domain fixtures; natural walking/combat/dungeon routes are separate checks.
function game(){return {mode:'playing',player:{x:VILLAGE.x,y:heightAt(VILLAGE.x,VILLAGE.z),z:VILLAGE.z,hp:100,maxHp:100,energy:100,maxEnergy:100,stamina:100,maxStamina:100,flasks:3,crystals:20,checkpoint:'camp'},
  adventure:initAdventure(),village:initVillage(),journey:initJourney(),expedition:{active:null,progress:{}},progress:{chests:[]},enemies:[],events:[]};}
function town(biome){return TOWNS.find(t=>t.biomeId===biome);}
function npc(s,biome,role='guide'){const actor=town(biome).npcs.find(n=>n.role===role);Object.assign(s.player,{x:actor.x,y:actor.y,z:actor.z});return actor;}
function command(s,biome,action,stage='local',role='guide'){
  const actor=npc(s,biome,role);return townAction(s,action,{npcId:actor.id,questId:`quest-${biome}-${stage}`,serviceId:town(biome).service});
}
function fulfil(s,id){const q=QUESTS.find(q=>q.id===id),{kind}=q.objective,target=q.objective.id;
  if(kind==='gather')s.village.gathered[target]=0;
  if(kind==='chest')s.progress.chests.push(target);
  if(kind==='trial')s.adventure.completedTasks.push(target);
  if(kind==='waypoint'&&!s.adventure.waypoints.includes(target))s.adventure.waypoints.push(target);
  if(kind==='boss')s.adventure.bosses.push(target);
  if(kind==='dungeon')s.expedition.progress[target]={claimed:true,killed:[],solved:[],opened:[]};
}
function localClaim(s,biome){fulfil(s,`quest-${biome}-local`);assert.equal(command(s,biome,'accept').ok,true);assert.equal(command(s,biome,'claim').ok,true);}

test('eight authored towns expose twenty-four resident roles, sixteen stages and eight unique relic sources',()=>{
  assert.equal(TOWNS.length,8);assert.equal(TOWNS.flatMap(t=>t.npcs).length,24);assert.equal(QUESTS.length,16);assert.equal(new Set(QUESTS.map(q=>q.id)).size,16);
  assert.equal(Object.keys(RELICS).length,8);assert.equal(Object.values(RELICS).filter(r=>r.sourceId.startsWith('dungeon-')).length,4);
  for(const t of TOWNS){assert.ok(SERVICES[t.service]);assert.deepEqual(t.npcs.map(n=>n.role).sort(),['guide','keeper','merchant']);assert.equal(QUESTS.filter(q=>q.townId===t.id).length,2);}
});
test('NPC interaction and talking enforce actual distance, height, scene, known IDs and mode',()=>{
  const s=game(),actor=npc(s,'sunfields');const near=townInteraction(s);assert.equal(near.id,actor.id);assert.equal(near.payload.npcId,actor.id);
  assert.equal(townAction(s,'talk',near.payload).ok,true);assert.equal(townAction(s,'talk',near.payload).ok,true);assert.deepEqual(s.journey.visited,['town-sunfields']);
  s.player.x+=20;assert.equal(townInteraction(s),null);assert.equal(townAction(s,'talk',near.payload).ok,false);
  npc(s,'sunfields');s.player.y+=4;assert.equal(townAction(s,'talk',near.payload).ok,false);
  npc(s,'sunfields');s.expedition.active={id:'dungeon-sunfields'};assert.equal(townInteraction(s),null);assert.equal(townAction(s,'talk',near.payload).ok,false);
  s.expedition.active=null;s.mode='dead';assert.equal(townAction(s,'talk',near.payload).ok,false);
  s.mode='playing';assert.equal(townAction(s,'talk',{npcId:'__proto__'}).ok,false);
});
test('a local gathering quest requires real gathering, consumes delivery at return and rewards once',()=>{
  const s=game();assert.equal(command(s,'sunfields','accept').ok,true);const before=structuredClone(s.journey);
  assert.equal(command(s,'sunfields','claim').ok,false);assert.deepEqual(s.journey,before);
  const resource=RESOURCE_NODES.find(r=>r.id==='resource-sunfields');Object.assign(s.player,{x:resource.x,y:resource.y,z:resource.z});
  assert.equal(villageAction(s,'gather',{id:resource.id}).ok,true);
  const wood=s.village.materials.wood,xp=s.adventure.xp,food=s.village.materials.food;
  assert.equal(command(s,'sunfields','claim').ok,true);assert.equal(s.village.materials.wood,wood-4);assert.equal(s.adventure.xp,xp+25);assert.equal(s.village.materials.food,food+2);
  const saved=structuredClone({journey:s.journey,village:s.village,adventure:s.adventure});assert.equal(command(s,'sunfields','claim').ok,false);
  assert.deepEqual({journey:s.journey,village:s.village,adventure:s.adventure},saved);
});
test('precompleted discovery counts after accepting, while second-stage acceptance requires the first claim',()=>{
  const s=game();fulfil(s,'quest-dunes-local');assert.equal(command(s,'dunes','accept','regional').ok,false);
  assert.equal(command(s,'dunes','accept').ok,true);assert.equal(questStatus(s,'quest-dunes-local').ready,true);
  assert.equal(command(s,'dunes','accept','regional').ok,false);assert.equal(command(s,'dunes','claim').ok,true);
  assert.equal(command(s,'dunes','accept','regional').ok,true);assert.equal(s.journey.tracked,'quest-dunes-regional');
});
test('wrong residents, remote guides and insufficient delivery materials cannot claim or charge',()=>{
  const s=game();command(s,'sunfields','accept');fulfil(s,'quest-sunfields-local');const guide=npc(s,'sunfields');
  s.village.materials.wood=3;const before=structuredClone(s.journey);assert.equal(townAction(s,'claim',{npcId:guide.id,questId:'quest-sunfields-local'}).ok,false);assert.equal(s.village.materials.wood,3);
  const foreign=npc(s,'coast');assert.equal(townAction(s,'claim',{npcId:foreign.id,questId:'quest-sunfields-local'}).ok,false);
  const merchant=npc(s,'sunfields','merchant');assert.equal(townAction(s,'claim',{npcId:merchant.id,questId:'quest-sunfields-local'}).ok,false);
  npc(s,'sunfields');s.player.x+=12;assert.equal(townAction(s,'claim',{npcId:guide.id,questId:'quest-sunfields-local'}).ok,false);assert.deepEqual(s.journey,before);
});
test('outdoor boss proof requires physical return before granting its unique relic and alliance',()=>{
  const s=game();localClaim(s,'coast');command(s,'coast','accept','regional');fulfil(s,'quest-coast-regional');
  assert.equal(s.journey.relics.length,0);assert.equal(allianceBenefits(s).count,0);const guide=npc(s,'coast');s.player.x+=30;
  assert.equal(townAction(s,'claim',{npcId:guide.id,questId:'quest-coast-regional'}).ok,false);
  assert.equal(command(s,'coast','claim','regional').ok,true);assert.deepEqual(s.journey.relics,['relic-coast']);assert.equal(allianceBenefits(s).count,1);
  const xp=s.adventure.xp,rep=s.village.reputation;assert.equal(command(s,'coast','claim','regional').ok,false);assert.equal(s.adventure.xp,xp);assert.equal(s.village.reputation,rep);
});
test('dungeon reward and regional quest reward have separate once-only ownership',()=>{
  const s=game();localClaim(s,'sunfields');command(s,'sunfields','accept','regional');fulfil(s,'quest-sunfields-regional');
  assert.equal(grantRelic(s,'relic-sunfields').ok,true);const relics=[...s.journey.relics],xp=s.adventure.xp;
  assert.equal(command(s,'sunfields','claim','regional').ok,true);assert.deepEqual(s.journey.relics,relics);assert.equal(s.adventure.xp,xp+70);
  assert.equal(grantRelic(s,'relic-sunfields').ok,false);assert.equal(command(s,'sunfields','claim','regional').ok,false);
});
test('all sixteen quest stages can complete with their defined proof and each town yields one alliance',()=>{
  const s=game();
  for(const t of TOWNS){
    localClaim(s,t.biomeId);command(s,t.biomeId,'accept','regional');fulfil(s,`quest-${t.biomeId}-regional`);
    assert.equal(command(s,t.biomeId,'claim','regional').ok,true);
  }
  assert.equal(Object.values(s.journey.quests).filter(n=>n===2).length,16);assert.equal(s.journey.allies.length,8);
  assert.deepEqual(allianceBenefits(s),{count:8,towerDamage:.25,flasks:2});
});
test('regional services execute their catalog recipes and reject empty budgets atomically',()=>{
  for(const t of TOWNS){
    const s=game(),service=SERVICES[t.service];s.player.flasks=1;
    if(service.effect.respec){learnSkill(s,'edge');learnSkill(s,'sunbolt');}
    const old=structuredClone({v:s.village,p:s.player});assert.equal(command(s,t.biomeId,'service','local','merchant').ok,true,t.service);
    for(const [id,n] of Object.entries(service.cost))assert.equal(id==='crystals'?s.player.crystals:s.village.materials[id],(id==='crystals'?old.p.crystals:old.v.materials[id])-n,t.service);
    for(const [id,n] of Object.entries(service.effect.materials||{}))assert.equal(s.village.materials[id],old.v.materials[id]+n,t.service);
    for(const [id,n] of Object.entries(service.effect.seeds||{}))assert.equal(s.village.seeds[id],old.v.seeds[id]+n,t.service);
    s.village.materials={wood:0,stone:0,food:0};s.player.crystals=0;const before=structuredClone(s.village);
    assert.equal(command(s,t.biomeId,'service','local','merchant').ok,false);assert.deepEqual(s.village,before);
  }
});
test('resource exchanges cannot grow both stocks by cycling between caravan and forge',()=>{
  const s=game(),wood=s.village.materials.wood,stone=s.village.materials.stone;
  assert.equal(command(s,'dunes','service','local','merchant').ok,true);assert.equal(command(s,'canyon','service','local','merchant').ok,true);
  assert.equal(s.village.materials.wood,wood-1);assert.equal(s.village.materials.stone,stone-1);
});
test('full service inventory and redundant respec reject before charging',()=>{
  const s=game();s.player.flasks=6;let food=s.village.materials.food;assert.equal(command(s,'alpine','service','local','merchant').ok,false);assert.equal(s.village.materials.food,food);
  s.village.seeds.moonflower=9999;assert.equal(command(s,'mistwood','service','local','merchant').ok,false);assert.equal(s.village.materials.food,food);
  s.village.materials.food=99999;const wood=s.village.materials.wood;assert.equal(command(s,'sunfields','service','local','merchant').ok,false);assert.equal(s.village.materials.wood,wood);
  const crystals=s.player.crystals;assert.equal(command(s,'lavender','service','local','merchant').ok,false);assert.equal(s.player.crystals,crystals);
});
test('observatory respec refunds earned budget and preserves relics and permanent progress',()=>{
  const s=game();awardXP(s,80);learnSkill(s,'edge');learnSkill(s,'sunbolt');grantRelic(s,'relic-coast');
  const xp=s.adventure.xp,owned=[...s.journey.relics];assert.equal(command(s,'lavender','service','local','merchant').ok,true);
  assert.deepEqual(s.adventure.learned,[]);assert.deepEqual(s.adventure.equipped,[null,null]);assert.equal(s.adventure.points,4);assert.equal(s.adventure.xp,xp);assert.deepEqual(s.journey.relics,owned);
});
test('keeper rest is free but does not unlock an undiscovered waypoint or allow combat healing',()=>{
  const s=game();s.player.hp=20;s.player.flasks=0;assert.equal(command(s,'dunes','rest','local','keeper').ok,true);assert.equal(s.player.hp,100);assert.equal(s.player.flasks,3);
  assert.equal(s.player.checkpoint,'camp');assert.equal(s.adventure.waypoints.includes(town('dunes').waypointId),false);
  s.adventure.waypoints.push(town('dunes').waypointId);assert.equal(command(s,'dunes','rest','local','keeper').ok,true);assert.equal(s.player.checkpoint,town('dunes').waypointId);
  s.player.hp=25;s.enemies.push({x:s.player.x+2,y:s.player.y,z:s.player.z,hp:10,state:'chase'});assert.equal(command(s,'dunes','rest','local','keeper').ok,false);assert.equal(s.player.hp,25);
});
test('two flexible relic slots only equip unique owned IDs and reject unsafe swaps',()=>{
  const s=game();assert.equal(equipRelic(s,'relic-coast',0).ok,false);grantRelic(s,'relic-coast');grantRelic(s,'relic-canyon');
  assert.deepEqual(s.journey.equipped,['relic-coast','relic-canyon']);assert.equal(equipRelic(s,'relic-coast',1).ok,true);assert.deepEqual(s.journey.equipped,[null,'relic-coast']);
  s.expedition.active={id:'dungeon-alpine'};assert.equal(equipRelic(s,'relic-canyon',0).ok,true,'safe indoor equipment swaps are permitted');
  s.enemies.push({x:s.player.x,y:s.player.y,z:s.player.z,hp:1});assert.equal(equipRelic(s,null,0).ok,false);
  s.enemies=[];s.village.raid.status='active';assert.equal(equipRelic(s,null,0).ok,false);s.village.raid.status='idle';assert.equal(equipRelic(s,null,0).ok,true);
  assert.equal(grantRelic(s,'constructor').ok,false);assert.equal(equipRelic(s,'relic-coast',9).ok,false);
});
test('relic modifiers affect actual combat/travel capacities and farming, without duplicate stacking',()=>{
  const s=game();grantRelic(s,'relic-canyon');grantRelic(s,'relic-dunes');assert.equal(modifiers(s).bladeDamage,4);assert.equal(modifiers(s).speed,1.08);
  grantRelic(s,'relic-sunfields');equipRelic(s,'relic-sunfields',0);
  const x=VILLAGE.x+8,z=VILLAGE.z;Object.assign(s.player,{x:x-3,y:heightAt(x-3,z),z});const built=villageAction(s,'build',{type:'plot',x,z});assert.equal(built.ok,true);
  Object.assign(s.player,{x,y:heightAt(x,z),z});villageAction(s,'plant',{id:built.id,crop:'wheat'});villageAction(s,'water',{id:built.id});
  for(let i=0;i<76;i++)tickVillage(s,1);assert.equal(villageAction(s,'harvest',{id:built.id}).food,6);
  s.journey.equipped=['relic-canyon','relic-canyon'];assert.equal(modifiers(s).bladeDamage,4);
});
test('alliance home benefits are derived, capped and do not stack when resting repeatedly',()=>{
  const s=game();for(const t of TOWNS)s.journey.quests[`quest-${t.biomeId}-regional`]=2;
  assert.equal(modifiers(s).towerDamage,1.25);assert.equal(villageAction(s,'rest').ok,true);assert.equal(s.player.flasks,5);
  s.village.structures.push({id:'building-100',type:'well',hp:140});
  for(let i=0;i<5;i++)assert.equal(villageAction(s,'rest').ok,true);assert.equal(s.player.flasks,6);
  const empty=game();empty.journey.allies=Array(100).fill('town-coast');assert.equal(allianceBenefits(empty).count,0);
});
test('indoor coordinates cannot access home actions, interactions or tick crops and raids',()=>{
  const s=game();s.expedition.active={id:'dungeon-sunfields'};const before=structuredClone(s.village);
  assert.equal(villageAction(s,'rest').ok,false);assert.equal(villageAction(s,'repair',{id:'beacon'}).ok,false);assert.equal(villageInteraction(s),null);
  tickVillage(s,1);assert.deepEqual(s.village,before);
});
test('journey normalization bounds catalogs, derives alliances and removes impossible quest order',()=>{
  const raw={visited:Array(100).fill('town-coast').concat('__proto__'),quests:{'quest-coast-local':2,'quest-coast-regional':2,'quest-dunes-regional':2,'made-up':2},
    relics:['relic-coast','relic-coast','fake'],equipped:['relic-coast','relic-coast'],tracked:'quest-coast-regional',allies:Array(20).fill('town-dunes')};
  const j=validateJourney(raw);assert.deepEqual(j.visited,['town-coast']);assert.equal(Object.keys(j.quests).length,16);
  assert.equal(j.quests['quest-dunes-regional'],0);assert.deepEqual(j.allies,['town-coast']);assert.deepEqual(j.relics,['relic-coast']);assert.deepEqual(j.equipped,['relic-coast',null]);assert.equal(j.tracked,null);
});
test('normalization with validated game facts rejects forged completed quests and relic sources',()=>{
  const s=game(),raw=initJourney();raw.quests['quest-coast-local']=2;raw.quests['quest-coast-regional']=2;raw.relics=['relic-coast','relic-sunfields'];raw.equipped=['relic-coast','relic-sunfields'];
  const rejected=validateJourney(raw,s);assert.equal(rejected.quests['quest-coast-local'],1);assert.equal(rejected.quests['quest-coast-regional'],0);assert.deepEqual(rejected.relics,[]);assert.deepEqual(rejected.allies,[]);
  fulfil(s,'quest-coast-local');fulfil(s,'quest-coast-regional');fulfil(s,'quest-sunfields-regional');
  const valid=validateJourney(raw,s);assert.deepEqual(valid.relics,['relic-coast','relic-sunfields']);assert.deepEqual(valid.allies,['town-coast']);
});
test('quest tracking only accepts active quests and names the physical return when ready',()=>{
  const s=game();assert.equal(trackQuest(s,'quest-dunes-local').ok,false);command(s,'dunes','accept');fulfil(s,'quest-dunes-local');
  assert.equal(trackQuest(s,'quest-dunes-local').ok,true);assert.match(journeyObjective(s),/돌아가/);assert.equal(questStatus(s,'quest-dunes-local').destinationId,'town-dunes');
  command(s,'dunes','claim');assert.equal(s.journey.tracked,null);assert.equal(trackQuest(s,'bad').ok,false);assert.equal(trackQuest(s,null).ok,true);
});
test('missing old-save journey data defaults safely without modifying existing gameplay state',()=>{
  const s=game(),before=structuredClone({adventure:s.adventure,village:s.village,progress:s.progress});
  assert.deepEqual(validateJourney(undefined,s),initJourney());assert.deepEqual(validateJourney(null,s),initJourney());
  assert.deepEqual({adventure:s.adventure,village:s.village,progress:s.progress},before);
});
test('version-three save roundtrip preserves claimed town rewards and immediately derives relic capacities',async()=>{
  const {createGame,exportSave,loadSave}=await import('../sim.mjs');const s=createGame();
  localClaim(s,'coast');command(s,'coast','accept','regional');fulfil(s,'quest-coast-regional');command(s,'coast','claim','regional');
  const saved=exportSave(s),loaded=loadSave(JSON.parse(JSON.stringify(saved)));assert.equal(saved.version,3);
  assert.deepEqual(loaded.journey,s.journey);assert.equal(loaded.player.maxStamina,125);const xp=loaded.adventure.xp;
  assert.equal(command(loaded,'coast','claim','regional').ok,false);assert.equal(loaded.adventure.xp,xp);
});
test('actual version-one and version-two save migration preserve legacy progress and default journeys',async()=>{
  const {createGame,exportSave,loadSave}=await import('../sim.mjs');const s=createGame();s.progress.sigils=['forest'];s.player.crystals=37;awardXP(s,80);s.village.materials.wood=17;
  s.village.raid={...s.village.raid,status:'queued',day:1,timer:7};s.village.clock=450;
  const saved=exportSave(s),v2={...saved,version:2};delete v2.journey;delete v2.expedition;
  const migrated=loadSave(v2);assert.deepEqual(migrated.journey,initJourney());assert.equal(migrated.expedition.active,null);
  assert.equal(migrated.adventure.xp,80);assert.equal(migrated.village.materials.wood,17);assert.equal(migrated.village.raid.status,'queued');assert.equal(migrated.village.raid.timer,7);
  const v1={...v2,version:1};delete v1.adventure;delete v1.village;const legacy=loadSave(v1);
  assert.deepEqual(legacy.progress.sigils,['forest']);assert.equal(legacy.player.crystals,37);assert.deepEqual(legacy.journey,initJourney());
});
