import {WORLD,TOWNS,RUIN_APPROACHES} from '../world.mjs';
import {RUINS} from '../ruins.mjs';
import {runFrontierTrail,frontierWalk,frontierPress} from './frontier-routes.mjs';
import {dungeonWalk,dungeonFight,dungeonUse,dungeonCheckpoint} from './dungeon-routes.mjs';
const ensure=(v,m)=>{if(!v)throw new Error(m);};
export function runRuinRoute(driver,id='dungeon-tide',{freshStart=true,optional=true,archive=true}={}){
 const d=RUINS.find(d=>d.id===id),biome=d.theme==='tide'?'coast':'autumn',start=driver.state(),falls=start.metrics.falls;
 if(freshStart){
  ensure(start.frame===0&&Math.hypot(start.player.x-WORLD.spawn.x,start.player.z-WORLD.spawn.z)<.001&&start.adventure.xp===0,'Fresh ruin journey requires unmodified starting game');
  if(driver.learn&&driver.equip){for(const key of ['edge','sunbolt'])ensure(driver.learn(key)?.ok,'Learn starter skill');ensure(driver.equip('sunbolt',0)?.ok,'Equip starter skill');}
  runFrontierTrail(driver,`route-${biome}`);
  const town=TOWNS.find(t=>t.biomeId===biome);frontierWalk(driver,town,{combat:false});
  if(driver.town){const keeper=town.npcs.find(n=>n.role==='keeper');frontierWalk(driver,keeper,{combat:false});frontierPress(driver,'interact');ensure(driver.town('rest',{npcId:keeper.id})?.ok,'Natural rest');frontierWalk(driver,town,{combat:false});}
  const approach=RUIN_APPROACHES.find(a=>a.entranceId===id);for(const p of approach.points)frontierWalk(driver,p,{combat:false});
  frontierPress(driver,'interact');
 }
 ensure(driver.state().expedition.active?.id===id,'Physical entrance must enter ruin');
 dungeonCheckpoint(driver,`${id}-entry`);
 const room=k=>d.rooms.find(r=>r.kind===k),center=k=>{const r=room(k);dungeonWalk(driver,{x:r.x,y:r.y,z:r.z});dungeonFight(driver);};
 const connect=(a,b)=>{ensure(d.links.some(([x,y])=>x===room(a).id&&y===room(b).id||y===room(a).id&&x===room(b).id),'Follow authored room connection');center(a);center(b);dungeonCheckpoint(driver,`${id}-${b}`);};
 dungeonUse(driver,d.landmarks.find(l=>l.kind==='clue'));
 connect('entry','lower');
 const q=d.puzzles[0],useNode=i=>dungeonUse(driver,d.landmarks.find(l=>l.puzzleId===q.id&&l.index===i));
 useNode(0);connect('lower','upper');useNode(1);
 if(d.theme==='canopy')connect('upper','crown');
 useNode(2);ensure(driver.state().expedition.progress[id].solved.includes(q.id),'Walking relay/height sequence must solve');
 connect(d.theme==='tide'?'upper':'crown','boss');driver.step(6,{});
 ensure(driver.state().expedition.progress[id].claimed,'Principal puzzle and guardian clear');
 ensure(driver.state().journey.relics.includes(d.relicId),'Source relic awarded');
 dungeonCheckpoint(driver,`${id}-cleared`);
 if(optional||archive){
  connect('boss',d.theme==='tide'?'upper':'crown');if(d.theme==='canopy')connect('crown','upper');connect('upper','lower');connect('lower','treasure');
  if(optional)dungeonUse(driver,d.landmarks.find(l=>l.kind==='chest'&&!l.afterClear));
  if(archive)dungeonUse(driver,d.landmarks.find(l=>l.kind==='chest'&&l.afterClear));
  connect('treasure','lower');connect('lower','upper');if(d.theme==='canopy')connect('upper','crown');connect(d.theme==='tide'?'upper':'crown','boss');
 }
 dungeonUse(driver,d.landmarks.find(l=>l.kind==='exit'&&l.afterClear));
 ensure(!driver.state().expedition.active,'Return light exits');ensure(driver.state().metrics.falls===falls,'Ruin route cannot rely on fall recovery');
 return dungeonCheckpoint(driver,`${id}-returned`);
}
if(typeof process!=='undefined'&&process.argv?.[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
 const {createGame,stepGame}=await import('../sim.mjs'),{learnSkill,equipSkill}=await import('../progression.mjs'),{townAction}=await import('../settlements.mjs');
 for(const id of process.argv.slice(2).length?process.argv.slice(2):RUINS.map(d=>d.id)){
  const s=createGame(),driver={state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;},learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot),town:(action,payload)=>townAction(s,action,payload),onCheckpoint:r=>console.log(JSON.stringify(r))};
  try{runRuinRoute(driver,id);}catch(e){console.error(`RUIN ROUTE FAIL ${id}: ${e.stack}`);process.exitCode=1;}
 }
 if(!process.exitCode)console.log('RUIN FRESH ROUTES PASS');
}
