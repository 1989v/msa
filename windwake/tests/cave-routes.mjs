import {CAVES} from '../caves.mjs';
import {TOWNS,DUNGEON_ENTRANCES,CAVE_APPROACHES,EXPEDITIONS} from '../world.mjs';
import {dungeonWalk as walk,dungeonFight as fight,dungeonUse as use,dungeonCheckpoint} from './dungeon-routes.mjs';
import {runFrontierTrail,frontierWalk,frontierPress} from './frontier-routes.mjs';
const ensure=(yes,text)=>{if(!yes)throw Error(text);};
export function runCaveRoute(driver,id,{approach=true}={}){
  const d=CAVES.find(d=>d.id===id);ensure(d,'Known natural cave');
  const mark=key=>d.landmarks.find(l=>l.id===`${id}:${key}`),room=kind=>d.rooms.find(r=>r.kind===kind);
  if(approach){
    const biome=id.replace('cave-',''),town=TOWNS.find(t=>t.biomeId===biome);
    runFrontierTrail(driver,`route-${biome}`);frontierWalk(driver,town,{combat:false});
    if(biome==='canyon'){const route=EXPEDITIONS.find(e=>e.biomeId==='canyon');for(const p of route.approachPoints)frontierWalk(driver,p,{combat:false});}
    for(const p of CAVE_APPROACHES.find(a=>a.entranceId===id).points)frontierWalk(driver,p,{combat:false});
    const entrance=DUNGEON_ENTRANCES.find(e=>e.id===id);frontierWalk(driver,entrance,{combat:false});
    frontierPress(driver,'interact');ensure(driver.state().expedition.active?.id===id,`Physical cave entry ${id}`);
  }
  const start=driver.state();ensure(start.expedition.active?.id===id,'Route starts in cave');const falls=start.metrics.falls;
  use(driver,mark('entrance-clue'));walk(driver,room('entry'));walk(driver,room('basin'));fight(driver);
  dungeonCheckpoint(driver,`${id}-basin`);
  if(id==='cave-canyon'){
    use(driver,mark('weight-clue'));use(driver,mark('reset-stones'));
    const b=d.blocks[0];walk(driver,{x:b.x-4,z:b.z-5});walk(driver,{x:b.x-3,z:b.z});
    while(driver.state().player.energy<35)driver.step(10,{});
    frontierPress(driver,'skill');driver.step(210,{});
    const stone=driver.state().expedition.active.blocks.find(a=>a.id===b.id),plate=d.puzzles.find(q=>q.type==='plate').targets[0];
    ensure(Math.hypot(stone.x-plate.x,stone.z-plate.z)<.85,'Wind stone physically rests on the marked plate');
    ensure(driver.state().expedition.progress[id].solved.includes(`${id}:seal`),'Wind-pushed physical cave seal');
  }else{use(driver,mark('light-clue'));use(driver,mark('lower-relay'));}
  walk(driver,room('basin'));walk(driver,room('treasure'));fight(driver);use(driver,mark('side-cache'));
  dungeonCheckpoint(driver,`${id}-side-cache`);walk(driver,room('treasure'));walk(driver,room('basin'));
  // The solved wind stone remains a real solid on its plate. Use the marked
  // open southern aisle instead of attempting to walk through the proof object.
  if(id==='cave-canyon'){walk(driver,{x:0,z:44});walk(driver,{x:8,z:44});}
  walk(driver,room('gallery'));
  if(id==='cave-mistwood')use(driver,mark('upper-relay'));
  dungeonCheckpoint(driver,`${id}-high-gallery`);walk(driver,room('gallery'));walk(driver,room('boss'));fight(driver);driver.step(8,{});
  ensure(driver.state().expedition.progress[id].claimed,'Cave clear earned');
  ensure(driver.state().expedition.progress[id].opened.includes(`${id}:side-cache`),'Optional treasure earned');
  dungeonCheckpoint(driver,`${id}-cleared`);use(driver,mark('deep-exit'));
  const end=driver.state();ensure(end.expedition.active===null,'Return to overworld');ensure(end.metrics.falls===falls,'No fall recovery shortcut');
  const entrance=DUNGEON_ENTRANCES.find(e=>e.id===id);ensure(Math.hypot(end.player.x-entrance.x,end.player.z-entrance.z)<6,'Correct world return');
  return {id,frames:end.frame,hp:end.player.hp,distance:end.metrics.distance,falls:end.metrics.falls,progress:end.expedition.progress[id]};
}
if(typeof process!=='undefined'&&process.argv[1]?.endsWith('/cave-routes.mjs')){
  const {createGame,stepGame}=await import('../sim.mjs');
  for(const id of process.argv.slice(2).length?process.argv.slice(2):CAVES.map(d=>d.id)){
    const s=createGame(),driver={state:()=>structuredClone(s),step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return structuredClone(s);}};
    console.log('CAVE ORDINARY ROUTE PASS',JSON.stringify(runCaveRoute(driver,id)));
  }
}
