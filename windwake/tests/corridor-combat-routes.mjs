import {CORRIDORS,TOWNS,LANDMARKS,WORLD,TRAIL_ROUTES} from '../world.mjs';
import {runFrontierTrail,frontierWalk,frontierFight,frontierPress} from './frontier-routes.mjs';
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
// CLI and Chrome share this input-only controller. Learning/equipment use public actions.
export function runCorridorCache(driver,id,{freshStart=true}={}){
  const c=CORRIDORS.find(c=>c.id===id);ensure(c,`Unknown corridor ${id}`);
  const town=TOWNS.find(t=>t.id===c.fromTownId),cache=LANDMARKS.find(l=>l.id===c.cacheId),start=driver.state(),falls=start.metrics.falls;
  if(freshStart){
    ensure(start.frame===0&&Math.hypot(start.player.x-WORLD.spawn.x,start.player.z-WORLD.spawn.z)<.001&&start.adventure.xp===0,'Cache route requires a fresh unmodified game');
    for(const skill of ['edge','sunbolt'])ensure(driver.learn(skill)?.ok,`Starter skill unavailable ${skill}`);
    ensure(driver.equip('sunbolt',0)?.ok,'Starter skill equip failed');runFrontierTrail(driver,`route-${town.biomeId}`);
  }
  if(!freshStart)for(const p of TRAIL_ROUTES.find(r=>r.id===`route-${town.biomeId}`).points)frontierWalk(driver,p,{combat:false});
  frontierWalk(driver,town,{combat:false});
  for(const p of c.points.slice(1,-2))frontierWalk(driver,p,{combat:false});
  frontierWalk(driver,cache,{combat:false});
  const before=driver.state(),initialProof=c.guardIds.filter(id=>before.adventure.worldDefeated[id]);
  if(!initialProof.length){frontierPress(driver,'interact');ensure(!driver.state().progress.chests.includes(c.cacheId),'Guarded cache opened before actual guard deaths');}
  const kills=driver.state().metrics.kills;
  for(let attempt=0;attempt<4&&!c.guardIds.every(id=>driver.state().adventure.worldDefeated[id]);attempt++){
    frontierFight(driver,{radius:24,frames:15000});
    if(!c.guardIds.every(id=>driver.state().adventure.worldDefeated[id]))frontierWalk(driver,cache,{combat:false});
  }
  ensure(c.guardIds.every(id=>driver.state().adventure.worldDefeated[id]),'Required guards were not defeated through ordinary combat');
  if(freshStart)ensure(driver.state().metrics.kills>=kills+2-initialProof.length,'Missing actual guard kills');
  frontierWalk(driver,cache,{combat:false});frontierPress(driver,'interact');
  const s=driver.state();ensure(s.progress.chests.includes(c.cacheId),'Guarded supply cache did not open');ensure(s.metrics.falls===falls,'Cache route used fall recovery');
  const result={id,frame:s.frame,distance:s.metrics.distance,hp:s.player.hp,falls:s.metrics.falls,guardIds:[...c.guardIds],cacheId:c.cacheId,kills:s.metrics.kills};driver.onCheckpoint?.({...result,stage:'corridor-cache-earned'});return result;
}
