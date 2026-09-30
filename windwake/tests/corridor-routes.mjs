import {CORRIDORS,TOWNS,RUIN_APPROACHES} from '../world.mjs';
import {frontierWalk,runFrontierTrail} from './frontier-routes.mjs';
// Ordinary inputs only. Optional fixture starts are the caller's responsibility.
export function runCorridor(driver,id,{reverse=false,freshStart=false}={}){
  const c=CORRIDORS.find(c=>c.id===id);if(!c)throw Error(`Unknown corridor ${id}`);
  const points=reverse?[...c.points].reverse():c.points;
  if(freshStart){const town=TOWNS.find(t=>t.id===(reverse?c.toTownId:c.fromTownId));runFrontierTrail(driver,`route-${town.biomeId}`);frontierWalk(driver,town,{combat:false});}
  const falls=driver.state().metrics.falls;
  for(const p of points)frontierWalk(driver,p,{combat:false});
  const s=driver.state();if(s.metrics.falls!==falls)throw Error(`${id} used fall recovery`);
  return{id,reverse,frames:s.frame,distance:s.metrics.distance,falls:s.metrics.falls,hp:s.player.hp};
}
export function runRuinApproach(driver,id){const route=RUIN_APPROACHES.find(r=>r.entranceId===id);if(!route)throw Error(`Unknown ruin ${id}`);for(const p of route.points)frontierWalk(driver,p,{combat:false});return driver.state();}
