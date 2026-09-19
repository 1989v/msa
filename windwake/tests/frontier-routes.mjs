import { WORLD, VILLAGE, TRAIL_ROUTES, WAYPOINTS, BOSS_SITES, RESOURCE_NODES } from '../world.mjs';

// Natural routes: only held player inputs and validated public game actions.
// The adapter never exposes a setter, restore, spawn, XP grant or clock shortcut.
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const ensure=(ok,message)=>{if(!ok)throw new Error(message);};
const at=p=>[p.x,p.y,p.z].map(n=>+n.toFixed(2));
const toward=(p,target,scale=1)=>{const d=Math.max(.001,gap(p,target));return {cameraYaw:0,
  moveX:(target.x-p.x)/d*scale,moveZ:(target.z-p.z)/d*scale};};

export function frontierCheckpoint(driver,stage){
  const s=driver.state(),result={stage,frame:s.frame,seconds:+s.time.toFixed(2),position:at(s.player),
    hp:s.player.hp,flasks:s.player.flasks,distance:+s.metrics.distance.toFixed(2),falls:s.metrics.falls,
    kills:s.metrics.kills,parries:s.metrics.parries,waypoints:[...s.adventure.waypoints],
    bosses:[...s.adventure.bosses],xp:s.adventure.xp,villageTasks:[...s.village.tasks],
    villageLevel:s.village.level,reputation:s.village.reputation,materials:{...s.village.materials},
    day:s.village.day,clock:+s.village.clock.toFixed(2),raid:s.village.raid.status,
    raidWave:s.village.raid.wave,beaconHp:s.village.beaconHp,finalDefeated:s.adventure.finalDefeated};
  driver.onCheckpoint?.(result);return result;
}

function advance(driver,frames,input={}){
  const s=driver.step(frames,input)||driver.state();
  ensure(s.mode!=='dead',`Route died at frame ${s.frame}, ${at(s.player)}, hp ${s.player.hp}`);
  ensure(s.enemies.length<=64,`Entity residency exceeded 64 at frame ${s.frame}`);
  ensure([s.player.x,s.player.y,s.player.z].every(Number.isFinite),'Player position became nonfinite');
  return s;
}

export function frontierPress(driver,action,input={}){
  advance(driver,1,input);return advance(driver,1,{...input,[action]:true});
}

function threats(s,radius,{includeRaid=false,raidOnly=false}={}){return s.enemies.filter(e=>e.hp>0&&(includeRaid||!e.raid)&&(!raidOnly||e.raid)&&
  (e.type!=='boss'||e.bossId||s.progress.sigils.length===3)&&Math.abs(e.y-s.player.y)<4&&gap(e,s.player)<radius)
  .sort((a,b)=>gap(a,s.player)-gap(b,s.player));}

export function frontierFight(driver,{radius=14,frames=15000,bossId,includeRaid=false,raidOnly=false}={}){
  let lastAttack=-100;
  for(let frame=0;frame<frames;frame+=3){
    const s=driver.state(),p=s.player;
    if(bossId&&(s.adventure.bosses.includes(bossId)||bossId==='boss-frontier'&&s.adventure.finalDefeated))return frontierCheckpoint(driver,`defeated-${bossId}`);
    const candidates=threats(s,radius,{includeRaid,raidOnly}),e=candidates[0];
    if(!e){ensure(!bossId,`Boss ${bossId} absent before first-clear reward`);advance(driver,6);return;}
    const d=gap(p,e),input=toward(p,e,d>2.1?1:.08);
    const soon=e.state==='telegraph'&&e.timer<.18;
    if(p.hp<=60&&p.flasks>0&&!s.previousInput.heal)input.heal=true;
    if(soon&&p.parryCooldown<=0&&p.stamina>=10&&!s.previousInput.parry)input.parry=true;
    else if(d<6.3&&p.energy>=35&&p.skillCooldown<=0&&!s.previousInput.skill)input.skill=true;
    else if(d<22&&s.adventure.equipped[0]==='sunbolt'&&p.energy>=24&&!(p.abilityCooldowns.sunbolt>0)&&!s.previousInput.skill1)input.skill1=true;
    else if(d<3&&s.frame-lastAttack>=13&&!s.previousInput.attack){input.attack=true;lastAttack=s.frame;}
    advance(driver,3,input);
  }
  throw new Error(`Combat timeout: ${JSON.stringify({position:at(driver.state().player),
    enemies:threats(driver.state(),radius,{includeRaid,raidOnly}).map(e=>({id:e.id,hp:e.hp,state:e.state,at:at(e)}))})}`);
}

export function frontierWalk(driver,target,{tolerance=.4,combat=true,sprint=true,frames=30000}={}){
  let stopped=0,previous=at(driver.state().player);
  for(let i=0;i<frames;i+=6){
    let s=driver.state(),p=s.player;
    if(gap(p,target)<tolerance){advance(driver,8);return s;}
    if(combat&&threats(s,9).length){frontierFight(driver);s=driver.state();p=s.player;}
    const d=gap(p,target),input=toward(p,target,Math.min(1,Math.max(.16,d/2)));
    input.sprint=sprint&&d>5;
    advance(driver,6,input);const next=driver.state().player;
    stopped=Math.hypot(next.x-previous[0],next.z-previous[2])<.025?stopped+6:0;previous=at(next);
    ensure(stopped<120,`Physical path blocked toward ${JSON.stringify(target)} at ${at(next)} after ${driver.state().frame} frames`);
  }
  throw new Error(`Walk timed out toward ${JSON.stringify(target)} at ${at(driver.state().player)}`);
}

function fresh(driver){const s=driver.state();ensure(s.frame===0&&gap(s.player,WORLD.spawn)<.001&&
  s.adventure.xp===0&&s.adventure.bosses.length===0,'Route requires a fresh, unmodified game');}

export function runFrontierTrail(driver,id,{freshStart=true}={}){
  if(freshStart)fresh(driver);
  const route=TRAIL_ROUTES.find(r=>r.id===id||r.waypointId===id||r.bossId===id);
  ensure(route,`Unknown physical trail ${id}`);const start=driver.state(),falls=start.metrics.falls;
  frontierCheckpoint(driver,`start-${route.id}`);
  // Stay on the authored walking lane. Sprinting past an off-road patrol is a
  // legal traversal choice; a combat controller chasing it would test a detour.
  for(const point of route.points)frontierWalk(driver,point,{combat:false});
  const waypoint=WAYPOINTS.find(w=>w.id===route.waypointId);
  ensure(gap(driver.state().player,waypoint)<1,'Waypoint reached by walking');
  ensure(!driver.state().adventure.waypoints.includes(waypoint.id),'Physical discovery must not autoactivate waypoint');
  frontierPress(driver,'interact');ensure(driver.state().adventure.waypoints.includes(waypoint.id),`Waypoint activation failed: ${waypoint.id}`);
  ensure(driver.state().metrics.falls===falls,`Trail ${route.id} required a fall/recovery shortcut`);
  ensure(driver.state().metrics.distance>gap(WORLD.spawn,waypoint)*.95,'Insufficient physical distance traveled');
  return frontierCheckpoint(driver,`walked-${route.id}`);
}

export function runFrontierFarm(driver){
  fresh(driver);ensure(typeof driver.village==='function','Farming requires validated village(action,payload) adapter');
  frontierWalk(driver,{x:-12,z:-86});frontierWalk(driver,VILLAGE);
  const resource=RESOURCE_NODES.find(n=>n.id==='resource-home-wood');frontierWalk(driver,resource);
  const wood=driver.state().village.materials.wood;frontierPress(driver,'interact');
  ensure(driver.state().village.materials.wood===wood+resource.amount,'Gathering must use the reachable resource interaction');
  const cell={x:VILLAGE.x-8,z:VILLAGE.z+4};frontierWalk(driver,{x:cell.x,z:cell.z-3});
  const built=driver.village('build',{type:'plot',...cell});ensure(built?.ok,`Legal plot build failed: ${built?.reason}`);
  frontierWalk(driver,cell);frontierPress(driver,'interact');
  ensure(driver.state().village.plots.find(p=>p.id===built.id)?.crop==='turnip','E must sow a turnip in the new plot');
  frontierPress(driver,'interact');ensure(driver.state().village.plots.find(p=>p.id===built.id)?.watered,'E must water the crop');
  const plantedFrame=driver.state().frame;
  for(let i=0;i<480;i++){
    if(driver.state().village.plots.find(p=>p.id===built.id)?.stage==='ripe')break;
    advance(driver,6);
  }
  ensure(driver.state().frame-plantedFrame>=44.9*60,'Crop growth must consume actual simulation time');
  ensure(driver.state().village.plots.find(p=>p.id===built.id)?.stage==='ripe','Turnip did not ripen after real45s');
  const food=driver.state().village.materials.food;frontierPress(driver,'interact');
  ensure(driver.state().village.materials.food>=food+3,'Harvest did not yield usable food');
  ensure(driver.state().village.plots.find(p=>p.id===built.id)?.crop===null,'Harvest should empty the plot');
  frontierWalk(driver,VILLAGE);const seeds=driver.state().village.seeds.turnip;
  ensure(driver.village('trade',{kind:'seed',crop:'turnip'})?.ok,'Harvest food should buy a seed');
  ensure(driver.state().village.seeds.turnip===seeds+1,'Seed trade must alter inventory');
  for(const task of ['gather','build','plant','water','harvest'])ensure(driver.state().village.tasks.includes(task),`Missing earned home objective ${task}`);
  return frontierCheckpoint(driver,'natural-farm-complete');
}

export function runFrontierBoss(driver,id='boss-sunfields',{freshStart=true}={}){
  if(freshStart)fresh(driver);
  else {ensure(driver.travel,'Continuing boss route requires public travel(id)');ensure(driver.travel('camp'),'Discovered starting camp should be reachable before departure');}
  ensure(driver.learn&&driver.equip,'Boss route requires validated learning/equipping adapters');
  for(const skill of ['edge','sunbolt'])if(!driver.state().adventure.learned.includes(skill))ensure(driver.learn(skill)?.ok,`Earned points must unlock ${skill}`);
  ensure(driver.equip('sunbolt',0)?.ok,'Sunbolt equip failed');
  const route=TRAIL_ROUTES.find(r=>r.bossId===id);ensure(route,`Unknown regional boss ${id}`);
  runFrontierTrail(driver,route.id,{freshStart:false});
  for(let i=0;i<route.bossPoints.length;i++)frontierWalk(driver,route.bossPoints[i],
    {combat:false,tolerance:i===route.bossPoints.length-1?16:.4});
  frontierFight(driver,{bossId:id,radius:32,frames:18000});
  ensure(driver.state().adventure.bosses.includes(id),'Regional victory must be earned through attacks');
  ensure(driver.state().mode==='playing','Regional victory must retain free exploration');
  return frontierCheckpoint(driver,`natural-${id}-complete`);
}

function villageCommand(driver,action,payload={}){
  const result=driver.village(action,payload);ensure(result?.ok,`Village ${action} failed: ${result?.reason}`);return result;
}

function travelSafely(driver,id){
  if(driver.travel(id))return;
  frontierFight(driver,{radius:14,frames:9000});
  ensure(driver.travel(id),`Public travel to ${id} remains blocked: ${driver.state().toast}`);
}

function plantAndWater(driver,id){
  const plot=driver.state().village.plots.find(p=>p.id===id);ensure(plot,`Missing owned plot ${id}`);
  frontierWalk(driver,plot,{combat:false});
  if(!plot.crop)villageCommand(driver,'plant',{id,crop:'turnip'});
  if(!driver.state().village.plots.find(p=>p.id===id).watered)villageCommand(driver,'water',{id});
}

function harvestWhenRipe(driver,id){
  plantAndWater(driver,id);
  for(let second=0;second<50&&driver.state().village.plots.find(p=>p.id===id).stage!=='ripe';second++)advance(driver,60);
  ensure(driver.state().village.plots.find(p=>p.id===id).stage==='ripe','Natural second harvest never ripened');
  villageCommand(driver,'harvest',{id});
}

export function runFrontierAdventure(driver){
  fresh(driver);ensure(driver.travel&&driver.learn&&driver.equip&&driver.village,'Adventure needs validated travel/skill/village commands');
  runFrontierFarm(driver);
  const plotId=driver.state().village.plots[0].id;
  for(const skill of ['edge','sunbolt'])ensure(driver.learn(skill)?.ok,`Earned farm progression must unlock ${skill}`);
  ensure(driver.equip('sunbolt',0)?.ok,'Adventure sunbolt equip failed');
  const builds=[{type:'cottage',x:VILLAGE.x+8,z:VILLAGE.z-8},
    {type:'tower',x:VILLAGE.x-8,z:VILLAGE.z+12},{type:'fence',x:VILLAGE.x+8,z:VILLAGE.z+12}];
  for(const building of builds){
    frontierWalk(driver,VILLAGE,{combat:false});
    frontierWalk(driver,{x:building.x,z:building.z-4},{combat:false});villageCommand(driver,'build',building);
  }
  plantAndWater(driver,plotId);frontierWalk(driver,VILLAGE,{combat:false});
  villageCommand(driver,'rest');frontierCheckpoint(driver,'village-defenses-prepared');
  const beforeDusk=driver.state().time;
  for(let i=0;i<600&&driver.state().village.raid.status==='idle';i++)advance(driver,60);
  ensure(driver.state().village.raid.status==='queued','Established village should warn at its first natural dusk');
  ensure(driver.state().village.day===1&&driver.state().village.clock>=450,'First raid must follow the real day1 dusk');
  ensure(driver.state().time>beforeDusk+60,'Dusk must use actual time steps');
  frontierCheckpoint(driver,'natural-first-dusk-warning');
  let sawWave1=false,sawWave2=false;
  for(let i=0;i<240;i++){
    const s=driver.state(),raid=s.village.raid;
    ensure(raid.status!=='lost','Natural defense failed before its two waves resolved');
    if(raid.status==='won')break;
    if(raid.status==='active'&&s.enemies.some(e=>e.raid&&e.hp>0)){
      sawWave1 ||= raid.wave===1;sawWave2 ||= raid.wave===2;
      frontierFight(driver,{includeRaid:true,raidOnly:true,radius:65,frames:6000});
    }else advance(driver,60);
  }
  ensure(sawWave1&&sawWave2,'Player must encounter both real raid waves');
  ensure(driver.state().village.raid.status==='won'&&driver.state().village.raid.rewarded,'Defense should award one genuine victory');
  ensure(driver.state().village.tasks.includes('defend'),'Defense objective must be earned');
  frontierCheckpoint(driver,'natural-two-wave-defense-complete');

  // Reinvest crops and renewable resources earned in this same game. No clock,
  // inventory, reputation or skill points are assigned by the route controller.
  harvestWhenRipe(driver,plotId);harvestWhenRipe(driver,plotId);
  frontierWalk(driver,VILLAGE,{combat:false});
  for(const resourceId of ['resource-home-wood','resource-home-stone']){
    const resource=RESOURCE_NODES.find(n=>n.id===resourceId);
    frontierWalk(driver,resource,{combat:false});villageCommand(driver,'gather',{id:resourceId});
    frontierWalk(driver,VILLAGE,{combat:false});
  }
  villageCommand(driver,'upgrade');villageCommand(driver,'upgrade');villageCommand(driver,'rest');
  ensure(driver.state().village.level===3&&driver.state().village.reputation>=16,'Harvest/defense must fund village3');
  frontierCheckpoint(driver,'natural-village-level-three');

  const regional=['boss-sunfields','boss-dunes','boss-coast','boss-alpine'];
  for(const id of regional){
    runFrontierBoss(driver,id,{freshStart:false});
    if(id!==regional.at(-1)){travelSafely(driver,'home');villageCommand(driver,'rest');}
  }
  ensure(regional.every(id=>driver.state().adventure.bosses.includes(id)),'Four regional victories must unlock the capstone');
  ensure(driver.state().village.level===3,'Village prerequisite must remain durable across exploration');
  frontierCheckpoint(driver,'natural-capstone-unlocked');
  const alpine=BOSS_SITES.find(b=>b.id==='boss-alpine'),final=BOSS_SITES.find(b=>b.final);
  frontierWalk(driver,alpine,{combat:false});frontierWalk(driver,final,{combat:false,tolerance:18});
  frontierFight(driver,{bossId:final.id,radius:35,frames:24000});
  const end=driver.state();ensure(end.adventure.finalDefeated&&end.mode==='won','Final encounter must reach its independent completion state');
  ensure(end.village.tasks.includes('defend')&&end.village.level===3,'One continuous game must retain village and defense milestones');
  return frontierCheckpoint(driver,'natural-frontier-adventure-complete');
}

if(typeof process!=='undefined'&&process.argv?.[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const {createGame,stepGame,fastTravel}=await import('../sim.mjs');
  const {learnSkill,equipSkill}=await import('../progression.mjs');
  const {villageAction}=await import('../village.mjs');
  const names=process.argv.slice(2).length?process.argv.slice(2):[...TRAIL_ROUTES.map(r=>r.id),'farm','boss-sunfields'];
  for(const name of names){
    const s=createGame(),driver={state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;},
      village:(action,payload)=>villageAction(s,action,payload),learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot),travel:id=>fastTravel(s,id),
      onCheckpoint:result=>console.log(JSON.stringify(result))};
    try{if(name==='adventure')runFrontierAdventure(driver);else if(name==='farm')runFrontierFarm(driver);else if(BOSS_SITES.some(b=>b.id===name))runFrontierBoss(driver,name);else runFrontierTrail(driver,name);}
    catch(error){console.error(`FRONTIER ROUTE FAIL ${name}: ${error.stack}`);process.exitCode=1;}
  }
  if(!process.exitCode)console.log('FRONTIER NATURAL ROUTES PASS');
}
