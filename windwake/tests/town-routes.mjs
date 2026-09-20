import {TOWNS,BIOMES,LANDMARKS,WAYPOINTS,DUNGEON_ENTRANCES,BOSS_SITES} from '../world.mjs';
import {QUESTS,questStatus} from '../settlements.mjs';
import {runFrontierTrail,frontierWalk,frontierPress,frontierFight} from './frontier-routes.mjs';
import {runDungeonRoute} from './dungeon-routes.mjs';

const ensure=(value,message)=>{if(!value)throw new Error(message);};
export function townCheckpoint(driver,stage){
  const s=driver.state(),result={stage,frame:s.frame,seconds:+s.time.toFixed(2),position:[s.player.x,s.player.y,s.player.z].map(n=>+n.toFixed(2)),hp:s.player.hp,distance:+s.metrics.distance.toFixed(2),falls:s.metrics.falls,kills:s.metrics.kills,visited:[...s.journey.visited],quests:{...s.journey.quests},relics:[...s.journey.relics],allies:[...s.journey.allies]};
  driver.onCheckpoint?.(result);return result;
}
function command(driver,kind,payload){const r=driver.town(kind,payload);ensure(r?.ok,`Town ${kind}: ${r?.reason}`);return r;}
function walk(driver,point){return frontierWalk(driver,point,{combat:false});}
export function approachTown(driver,id,{freshStart=true}={}){
  const town=TOWNS.find(t=>t.id===id||t.biomeId===id);ensure(town,'Unknown town');
  if(freshStart)runFrontierTrail(driver,`route-${town.biomeId}`);
  else walk(driver,WAYPOINTS.find(w=>w.id===town.waypointId));
  walk(driver,town);walk(driver,town.npcs.find(n=>n.role==='guide'));
  frontierPress(driver,'interact');ensure(driver.state().journey.visited.includes(town.id),'Physical NPC dialogue must record visit');
  townCheckpoint(driver,`visit-${town.id}`);return town;
}
export function completeTownLocal(driver,id,options={}){
  ensure(driver.town,'Needs the validated town command adapter');
  const town=approachTown(driver,id,options),guide=town.npcs.find(n=>n.role==='guide');
  const q=QUESTS.find(q=>q.townId===town.id&&q.stage===1);
  command(driver,'accept',{npcId:guide.id,questId:q.id});
  const biome=BIOMES.find(b=>b.id===town.biomeId),waypoint=WAYPOINTS.find(w=>w.id===town.waypointId);
  if(!questStatus(driver.state(),q.id).ready){
    walk(driver,town);walk(driver,waypoint);walk(driver,biome);
    const objective=LANDMARKS.find(l=>l.id===q.objective.id);ensure(objective,'Objective has a physical marker');
    walk(driver,objective);frontierPress(driver,'interact');
    if(q.objective.kind==='trial'&&!questStatus(driver.state(),q.id).ready)frontierFight(driver,{radius:22});
    ensure(questStatus(driver.state(),q.id).ready,`Objective did not complete ${q.id}`);
    walk(driver,biome);walk(driver,waypoint);walk(driver,town);walk(driver,guide);
  }
  command(driver,'claim',{npcId:guide.id,questId:q.id});
  const repeated=driver.town('claim',{npcId:guide.id,questId:q.id});ensure(!repeated.ok,'Duplicate quest claim rejected');
  const regional=QUESTS.find(q=>q.townId===town.id&&q.stage===2);command(driver,'accept',{npcId:guide.id,questId:regional.id});
  const keeper=town.npcs.find(n=>n.role==='keeper');walk(driver,town);walk(driver,keeper);command(driver,'rest',{npcId:keeper.id});
  walk(driver,town);return townCheckpoint(driver,`local-${town.id}-complete`);
}
export function claimTownRegional(driver,id){
  const town=TOWNS.find(t=>t.id===id||t.biomeId===id),guide=town.npcs.find(n=>n.role==='guide');
  walk(driver,town);walk(driver,guide);command(driver,'claim',{npcId:guide.id,questId:`quest-${town.biomeId}-regional`});
  ensure(driver.state().journey.allies.includes(town.id),'Return creates an alliance');
  return townCheckpoint(driver,`allied-${town.id}`);
}
export function runSettlementAdventure(driver,id,{freshStart=true}={}){
  if(!freshStart)runFrontierTrail(driver,`route-${id.replace('town-','')}`,{freshStart:false});
  completeTownLocal(driver,id,{freshStart});
  const town=TOWNS.find(t=>t.id===id||t.biomeId===id),q=QUESTS.find(q=>q.townId===town.id&&q.stage===2);
  if(driver.learn&&driver.equip){
    for(const skill of ['edge','sunbolt'])if(!driver.state().adventure.learned.includes(skill))ensure(driver.learn(skill).ok,`Earned skill ${skill}`);
    ensure(driver.equip('sunbolt',0).ok,'Equip earned ability');
  }
  if(q.objective.kind==='dungeon'){
    walk(driver,DUNGEON_ENTRANCES.find(d=>d.id===q.objective.id));
    runDungeonRoute(driver,q.objective.id,{freshStart:false});
  }else{
    const biome=BIOMES.find(b=>b.id===town.biomeId),waypoint=WAYPOINTS.find(w=>w.id===town.waypointId),boss=BOSS_SITES.find(b=>b.id===q.objective.id);
    walk(driver,waypoint);walk(driver,biome);frontierWalk(driver,boss,{combat:false,tolerance:16});
    frontierFight(driver,{radius:32,frames:18000,bossId:boss.id});
    walk(driver,biome);walk(driver,waypoint);
  }
  ensure(questStatus(driver.state(),q.id).ready,'Regional objective earned before return');
  return claimTownRegional(driver,town.id);
}

if(typeof process!=='undefined'&&process.argv[1]?.endsWith('/town-routes.mjs')){
  const {createGame,stepGame,snapshot,fastTravel,exportSave,loadSave}=await import('../sim.mjs'),{townAction}=await import('../settlements.mjs');
  const {learnSkill,equipSkill}=await import('../progression.mjs');
  const continuous=process.argv.includes('continuous'),adventure=continuous||process.argv.includes('adventure'),selected=process.argv.slice(2).filter(s=>!['adventure','continuous'].includes(s)),towns=selected.length?TOWNS.filter(t=>selected.includes(t.biomeId)||selected.includes(t.id)):TOWNS;
  let s=createGame();
  for(const [i,town] of towns.entries()){if(!continuous)s=createGame();if(continuous&&i)ensure(fastTravel(s,'home'),'Discovered home return');const driver={state:()=>snapshot(s),step:(n,input)=>{for(let i=0;i<n;i++)stepGame(s,input);return snapshot(s);},town:(action,payload)=>townAction(s,action,payload),learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot)};
    console.log(JSON.stringify(adventure?runSettlementAdventure(driver,town.id,{freshStart:!continuous||i===0}):completeTownLocal(driver,town.id)));
  }
  if(continuous){const loaded=loadSave(exportSave(s));ensure(loaded.journey.allies.length===towns.length&&loaded.journey.relics.length===towns.length,'All earned alliances and relics survive one save');ensure(s.metrics.falls===0,'Continuous path cannot use fall recovery');console.log('CONTINUOUS SETTLEMENT JOURNEY PASS',JSON.stringify({frames:s.frame,allies:loaded.journey.allies.length,relics:loaded.journey.relics.length,quests:Object.values(loaded.journey.quests).filter(n=>n===2).length}));
  }
}
