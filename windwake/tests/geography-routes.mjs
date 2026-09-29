import {EXPEDITIONS,WAYPOINTS,LANDMARKS} from '../world.mjs';
import {frontierWalk,frontierPress} from './frontier-routes.mjs';
// Adapter permits input only: fixtures belong to callers, never to the route.
export function runExpedition(driver,id){
  const route=EXPEDITIONS.find(e=>e.id===id);if(!route)throw Error(`Unknown expedition ${id}`);
  const start=driver.state(),falls=start.metrics.falls;
  const walk=p=>frontierWalk(driver,p,{combat:false});
  walk(WAYPOINTS.find(w=>w.id===route.waypointId));
  for(const p of [...route.approachPoints,...route.points])walk(p);
  const reward=LANDMARKS.find(l=>l.id===route.rewardId);walk(reward);frontierPress(driver,'interact');
  for(const p of route.returnPoints)walk(p);
  for(const p of [...route.approachPoints].reverse())walk(p);
  const state=driver.state();if(state.metrics.falls!==falls)throw Error('Expedition used fall recovery');
  return {id,frames:state.frame,falls:state.metrics.falls,hp:state.player.hp,distance:state.metrics.distance};
}
if(typeof process!=='undefined'&&process.argv[1]?.endsWith('/geography-routes.mjs')){
  const {createGame,stepGame}=await import('../sim.mjs');
  for(const e of EXPEDITIONS){const s=createGame(),w=WAYPOINTS.find(w=>w.id===e.waypointId);Object.assign(s.player,{x:w.x,z:w.z,y:w.y,grounded:true});console.log(JSON.stringify(runExpedition({state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;}},e.id)));}
}
