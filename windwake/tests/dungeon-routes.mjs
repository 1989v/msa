import {WORLD,TOWNS,DUNGEON_ENTRANCES} from '../world.mjs';
import {DUNGEONS,dungeonFloor,dungeonGeometry} from '../dungeons.mjs';
import {runFrontierTrail,frontierWalk,frontierPress} from './frontier-routes.mjs';

// Shared CLI/Chrome controller. Only normal held inputs and validated public
// town/skill actions are available; no grants, state edits or scene shortcuts.
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const ensure=(ok,message)=>{if(!ok)throw new Error(message);};
const at=p=>[p.x,p.y,p.z].map(n=>+n.toFixed(2));
const toward=(p,target,scale=1)=>{const d=Math.max(.001,gap(p,target));return {cameraYaw:0,moveX:(target.x-p.x)/d*scale,moveZ:(target.z-p.z)/d*scale};};
function advance(driver,frames,input={}){
  const s=driver.step(frames,input)||driver.state();
  ensure(s.mode==='playing',`Dungeon route stopped ${s.mode} at ${at(s.player)}, frame ${s.frame}`);
  ensure(s.enemies.length<=64,'Dungeon actor budget exceeded');return s;
}
export function dungeonCheckpoint(driver,stage){
  const s=driver.state(),id=s.expedition.active?.id,geometry=dungeonGeometry(s);
  const result={stage,frame:s.frame,seconds:+s.time.toFixed(2),position:at(s.player),hp:s.player.hp,flasks:s.player.flasks,
    distance:+s.metrics.distance.toFixed(2),jumps:s.metrics.jumps,falls:s.metrics.falls,kills:s.metrics.kills,parries:s.metrics.parries,
    dungeon:id||null,room:s.expedition.active?.roomId||null,progress:id?structuredClone(s.expedition.progress[id]):null,
    openDoors:geometry?.doors.filter(d=>d.open).map(d=>d.id)||[],relics:[...(s.journey?.relics||[])]};
  driver.onCheckpoint?.(result);return result;
}
function fight(driver,{frames=15000}={}){
  let lastAttack=-100;
  for(let t=0;t<frames;t+=3){
    const s=driver.state(),p=s.player,e=s.enemies.filter(e=>e.hp>0&&e.dungeonId===s.expedition.active?.id&&gap(e,p)<24&&Math.abs(e.y-p.y)<4).sort((a,b)=>gap(a,p)-gap(b,p))[0];
    if(!e){advance(driver,6);return;}
    const d=gap(e,p),input=toward(p,e,d>2.1?1:.08);
    if(p.hp<=60&&p.flasks>0&&!s.previousInput.heal)input.heal=true;
    if(e.state==='telegraph'&&e.timer<.18&&p.parryCooldown<=0&&p.stamina>=10&&!s.previousInput.parry)input.parry=true;
    else if(d<6.3&&p.energy>=35&&p.skillCooldown<=0&&!s.previousInput.skill)input.skill=true;
    else if(d<22&&s.adventure.equipped[0]==='sunbolt'&&p.energy>=24&&!(p.abilityCooldowns.sunbolt>0)&&!s.previousInput.skill1)input.skill1=true;
    else if(d<3&&s.frame-lastAttack>=13&&!s.previousInput.attack){input.attack=true;lastAttack=s.frame;}
    advance(driver,3,input);
  }
  throw new Error(`Dungeon combat timeout ${JSON.stringify(driver.state().enemies.map(e=>({id:e.id,hp:e.hp,state:e.state,position:at(e)})))}`);
}
function walk(driver,target,{tolerance=.35,jump=true,combat=true}={}){
  let stalled=0,previous=driver.state().player;
  for(let i=0;i<3600;i+=3){
    let s=driver.state(),p=s.player;
    if(gap(p,target)<tolerance&&(!Number.isFinite(target.y)||Math.abs(p.y-target.y)<.3)&&p.grounded){advance(driver,4);return;}
    if(combat&&s.enemies.some(e=>e.hp>0&&e.dungeonId&&gap(e,p)<10)){fight(driver);s=driver.state();p=s.player;}
    const input=toward(p,target,Math.min(1,Math.max(.13,gap(p,target)/2))),ahead={x:p.x+input.moveX*1.1,z:p.z+input.moveZ*1.1};
    if(jump&&p.grounded&&!s.previousInput.jump&&dungeonFloor(s,ahead.x,ahead.z)>p.y+.5)input.jump=true;
    previous={x:p.x,z:p.z};advance(driver,3,input);const next=driver.state().player;
    stalled=gap(previous,next)<.005?stalled+3:0;
    ensure(stalled<180,`Dungeon physical path blocked toward ${JSON.stringify(target)} at ${at(next)}`);
  }
  throw new Error(`Dungeon walk timeout toward ${JSON.stringify(target)} at ${at(driver.state().player)}`);
}
function use(driver,l){
  walk(driver,l);frontierPress(driver,'interact');
}
function roomCenter(driver,r){
  if(r.kind==='weights'&&driver.state().player.x<r.x-1){
    walk(driver,{x:r.x-7,z:r.z});walk(driver,{x:r.x-7,z:r.z-7});walk(driver,{x:r.x,z:r.z-7});
  }
  walk(driver,{x:r.x,z:r.z},{combat:true});
}
function solveRoom(driver,d,r){
  const q=d.puzzles.find(q=>q.roomId===r.id);if(!q)return;
  const clue=d.landmarks.find(l=>l.kind==='clue'&&(q.type==='plate'?l.id.endsWith('weight-clue'):l.id.endsWith('light-clue')));
  use(driver,clue);dungeonCheckpoint(driver,`${d.id}-${r.kind}-clue`);
  if(q.type==='sequence'){
    for(const index of q.order)use(driver,d.landmarks.find(l=>l.puzzleId===q.id&&l.index===index));
  }else if(q.type==='relays'){
    for(let index=0;index<q.target.length;index++)if(q.target[index])use(driver,d.landmarks.find(l=>l.puzzleId===q.id&&l.index===index));
  }else{
    const reset=d.landmarks.find(l=>l.kind==='reset'&&l.puzzleId===q.id);use(driver,reset);
    for(const original of d.blocks.filter(b=>b.puzzleId===q.id)){
      // Approach each stone from the west without crossing its collider. Q's
      // normal impulse must actually move it onto the matching receiver.
      walk(driver,{x:r.x-7,z:original.z},{combat:false});walk(driver,{x:original.x-3,z:original.z},{combat:false});
      for(let i=0;i<240&&driver.state().player.energy<35;i++)advance(driver,6);
      frontierPress(driver,'skill');advance(driver,180);
      const block=driver.state().expedition.active.blocks.find(b=>b.id===original.id),target=q.targets.find(t=>t.blockId===block.id);
      ensure(gap(block,target)<.85,`Pulse missed pressure plate ${block.id}: ${at(block)}`);
    }
    advance(driver,60);
  }
  ensure(driver.state().expedition.progress[d.id].solved.includes(q.id),`Puzzle did not solve through physical interactions: ${q.id}`);
  dungeonCheckpoint(driver,`${d.id}-${r.kind}-solved`);
}
function ascent(driver,d,r){
  const axis=d.jumpAxis,point=(offset,y)=>({x:r.x+(axis==='x'?offset:0),z:r.z+(axis==='z'?offset:0),...(y===undefined?{}:{y})});
  walk(driver,point(-7,0));walk(driver,point(-3,1.4));dungeonCheckpoint(driver,`${d.id}-low-terrace`);
  walk(driver,point(1,2.8));dungeonCheckpoint(driver,`${d.id}-high-terrace`);walk(driver,point(7,0));
}
function connect(driver,d,from,to){
  ensure(d.links.some(([a,b])=>a===from.id&&b===to.id||b===from.id&&a===to.id),'Route must follow an authored physical corridor');
  // Recenter before leaving a side interaction; direct diagonals between rooms
  // would run into the real walls that intentionally enclose each chamber.
  if(from.kind!=='ascent')roomCenter(driver,from);
  if(from.kind==='weights'&&to.x>from.x){walk(driver,{x:from.x,z:from.z-7});walk(driver,{x:from.x+7,z:from.z-7});walk(driver,{x:from.x+7,z:from.z});}
  if(to.kind==='ascent')ascent(driver,d,to);else roomCenter(driver,to);
  fight(driver);dungeonCheckpoint(driver,`${d.id}-entered-${to.kind}`);
}
const visits={sunfields:['entry','guard','runes','treasure','runes','weights','ascent','boss'],
  canyon:['entry','ascent','guard','treasure','guard','runes','boss'],
  mistwood:['entry','runes','treasure','runes','guard','weights','ascent','boss'],
  alpine:['entry','weights','guard','treasure','guard','ascent','runes','boss']};

export function runDungeonRoute(driver,id='dungeon-sunfields',{freshStart=true}={}){
  const d=DUNGEONS.find(d=>d.id===id);ensure(d,`Unknown dungeon ${id}`);const biome=id.replace('dungeon-','');
  const start=driver.state(),falls=start.metrics.falls,jumps=start.metrics.jumps;
  if(freshStart){
    ensure(start.frame===0&&gap(start.player,WORLD.spawn)<.001&&start.adventure.xp===0,'Natural dungeon route requires an unmodified fresh game');
    if(driver.learn&&driver.equip){for(const skill of ['edge','sunbolt'])ensure(driver.learn(skill)?.ok,`Starter skill ${skill} unavailable`);ensure(driver.equip('sunbolt',0)?.ok,'Sunbolt equip failed');}
    runFrontierTrail(driver,`route-${biome}`);
    const town=TOWNS.find(t=>t.biomeId===biome);frontierWalk(driver,town,{combat:false});
    if(driver.town){
      const keeper=town.npcs.find(n=>n.role==='keeper');frontierWalk(driver,keeper,{combat:false});frontierPress(driver,'interact');
      ensure(driver.town('rest',{npcId:keeper.id})?.ok,'Town keeper must provide a reachable natural rest');
      frontierWalk(driver,town,{combat:false});
    }
    frontierWalk(driver,DUNGEON_ENTRANCES.find(e=>e.id===id),{combat:false});frontierPress(driver,'interact');
  }else if(!start.expedition.active)frontierPress(driver,'interact');
  ensure(driver.state().expedition.active?.id===id,'E at the physical entrance must enter the requested instance');
  dungeonCheckpoint(driver,`${id}-entered`);
  const rooms=visits[biome].map(kind=>d.rooms.find(r=>r.kind===kind)),seen=new Set();
  for(let i=1;i<rooms.length;i++){
    const r=rooms[i];connect(driver,d,rooms[i-1],r);
    if(!seen.has(r.id)){
      solveRoom(driver,d,r);
      if(r.kind==='treasure'){
        const chest=d.landmarks.find(l=>l.kind==='chest');use(driver,chest);
        ensure(driver.state().expedition.progress[id].opened.includes(chest.id),'Optional treasure must be opened after its real guardian');
        dungeonCheckpoint(driver,`${id}-optional-treasure`);
      }
      seen.add(r.id);
    }
  }
  advance(driver,6);ensure(driver.state().expedition.progress[id].claimed,'All rooms, puzzles and real boss combat must earn first-clear');
  ensure(driver.state().journey.relics.includes(d.relicId),'Clear must award its equippable relic');
  ensure(driver.state().mode==='playing'&&!driver.state().progress.bossDefeated&&!driver.state().adventure.finalDefeated,'Dungeon boss must preserve the original and final world story');
  ensure(driver.state().metrics.jumps>=jumps+2,'Terraces must require at least two actual base jumps');
  ensure(driver.state().metrics.falls===falls,'Complete dungeon path must not use fall recovery as a shortcut');
  dungeonCheckpoint(driver,`${id}-cleared`);
  use(driver,d.landmarks.find(l=>l.kind==='exit'&&l.afterClear));
  ensure(driver.state().expedition.active===null,'Physical final exit must return to the overworld');
  return dungeonCheckpoint(driver,`${id}-returned`);
}

if(typeof process!=='undefined'&&process.argv?.[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const {createGame,stepGame}=await import('../sim.mjs'),{learnSkill,equipSkill}=await import('../progression.mjs'),{townAction}=await import('../settlements.mjs');
  const names=process.argv.slice(2).length?process.argv.slice(2):DUNGEONS.map(d=>d.id);
  for(const id of names){const s=createGame(),driver={state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;},learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot),town:(action,payload)=>townAction(s,action,payload),onCheckpoint:r=>console.log(JSON.stringify(r))};
    try{runDungeonRoute(driver,id);}catch(error){console.error(`DUNGEON ROUTE FAIL ${id}: ${error.stack}`);process.exitCode=1;}
  }
  if(!process.exitCode)console.log('DUNGEON NATURAL ROUTES PASS');
}
