import {WORLD,TOWNS,CORRIDORS,RUIN_APPROACHES} from '../world.mjs';
import {runFrontierTrail,frontierWalk,frontierPress,frontierCheckpoint} from './frontier-routes.mjs';
import {runCorridor,runRuinApproach} from './corridor-routes.mjs';
import {runRuinRoute} from './ruin-routes.mjs';
const ensure=(v,m)=>{if(!v)throw Error(m);};
const durable=s=>({proof:s.expedition.progress['dungeon-canopy'],relics:s.journey.relics,equipped:s.journey.equipped,xp:s.adventure.xp,materials:s.village.materials,crystals:s.player.crystals});
// Fresh accepted route: no teleport, restore, grants, actor edits or clock skips.
export function runCrossroadsRoute(driver){
  const initial=driver.state();ensure(initial.frame===0&&initial.adventure.xp===0&&Math.hypot(initial.player.x-WORLD.spawn.x,initial.player.z-WORLD.spawn.z)<.001,'Combined journey requires fresh unmodified start');
  for(const id of ['edge','sunbolt'])ensure(driver.learn(id)?.ok,`Learn ${id}`);ensure(driver.equip('sunbolt',0)?.ok,'Equip sunbolt');
  runFrontierTrail(driver,'route-coast');
  const coast=TOWNS.find(t=>t.biomeId==='coast'),autumn=TOWNS.find(t=>t.biomeId==='autumn');
  frontierWalk(driver,coast,{combat:false});frontierCheckpoint(driver,'crossroads-coast-town');
  const corridor=CORRIDORS.find(c=>c.fromTownId===coast.id&&c.toTownId===autumn.id);
  const crossed=runCorridor(driver,corridor.id);frontierCheckpoint(driver,'crossroads-autumn-arrival');
  const keeper=autumn.npcs.find(n=>n.role==='keeper');frontierWalk(driver,keeper,{combat:false});ensure(driver.town('rest',{npcId:keeper.id})?.ok,'Rest with autumn keeper');frontierWalk(driver,autumn,{combat:false});
  runRuinApproach(driver,'dungeon-canopy');frontierPress(driver,'interact');
  const ruin=runRuinRoute(driver,'dungeon-canopy',{freshStart:false});
  ensure(driver.equipRelic('relic-canopy',0)?.ok,'Equip earned canopy relic');driver.step(1,{});ensure(driver.state().player.maxEnergy===110,'Equipped relic supplies actual energy capacity');
  for(const p of [...RUIN_APPROACHES.find(r=>r.entranceId==='dungeon-canopy').points].reverse())frontierWalk(driver,p,{combat:false});
  ensure(Math.hypot(driver.state().player.x-autumn.x,driver.state().player.z-autumn.z)<2,'Return to actual town');
  frontierCheckpoint(driver,'crossroads-equipped-return');
  const before=durable(driver.state());ensure(driver.state().metrics.falls===0,'Combined route uses no fall recovery');
  for(let i=0;i<2;i++){driver.load(JSON.parse(JSON.stringify(driver.save())));ensure(JSON.stringify(durable(driver.state()))===JSON.stringify(before),'Reload preserves earned proof/equipment/resources without duplicating rewards');}
  const finish=frontierCheckpoint(driver,'crossroads-reloaded');
  return{corridor:crossed,ruin,finish,saveReloads:2,relic:'relic-canopy',proof:driver.state().expedition.progress['dungeon-canopy']};
}
export async function runNodeCrossroadsRoute(){
  const {createGame,stepGame,exportSave,loadSave}=await import('../sim.mjs'),{learnSkill,equipSkill}=await import('../progression.mjs'),{townAction}=await import('../settlements.mjs'),{equipRelic}=await import('../relics.mjs');
  let s=createGame();return runCrossroadsRoute({state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;},learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot),equipRelic:(id,slot)=>equipRelic(s,id,slot),town:(a,p)=>townAction(s,a,p),save:()=>exportSave(s),load:data=>{s=loadSave(data);return s;},onCheckpoint:r=>console.log(JSON.stringify(r))});
}
if(typeof process!=='undefined'&&process.argv?.[1]?.endsWith('/crossroads-routes.mjs'))console.log('CROSSROADS FRESH COMBINED ROUTE PASS',JSON.stringify(await runNodeCrossroadsRoute()));
