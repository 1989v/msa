import {VILLAGE} from '../world.mjs';
import {recipeUnlocked} from '../village.mjs';
import {runCaveRoute} from './cave-routes.mjs';
import {frontierWalk,frontierFight,frontierCheckpoint} from './frontier-routes.mjs';

// Fresh game only. The driver exposes held inputs and validated public commands;
// no teleport, inventory assignment, spawned actor, grant or progress edits.
const ensure=(value,message)=>{if(!value)throw Error(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const walk=(driver,target)=>frontierWalk(driver,target,{combat:false});
function command(driver,action,payload){const result=driver.village(action,payload);ensure(result?.ok,`${action}: ${result?.reason}`);return result;}
function durable(s){return {proof:s.expedition.progress['cave-mistwood'],produce:s.village.produce,items:s.village.items,materials:s.village.materials,seeds:s.village.seeds,plots:s.village.plots,xp:s.adventure.xp};}
export function runDepthLifeRoute(driver){
  ensure(['state','step','village','travel','save','load'].every(key=>typeof driver[key]==='function'),'Life route requires ordinary village/travel and save/load adapters');
  ensure(!recipeUnlocked(driver.state(),'growthTonic'),'Fresh start must not grant recipe');
  const cave=runCaveRoute(driver,'cave-mistwood');
  ensure(recipeUnlocked(driver.state(),'growthTonic'),'Physical cave completion unlocks recipe');
  if(!driver.travel('home')){frontierFight(driver,{radius:14,frames:9000});ensure(driver.travel('home'),'Normal home fast travel after leaving threats');}
  frontierCheckpoint(driver,'depth-life-home-after-cave');
  const plots=[];
  for(const [crop,dz] of [['moonflower',4],['turnip',-4]]){
    const cell={x:VILLAGE.x-8,z:VILLAGE.z+dz};walk(driver,cell);
    const result=command(driver,'build',{type:'plot',...cell});plots.push(result.id);
    command(driver,'plant',{id:result.id,crop});command(driver,'water',{id:result.id});
  }
  const plantedFrame=driver.state().frame;
  for(let second=0;second<145;second++){
    if(plots.every(id=>driver.state().village.plots.find(p=>p.id===id).stage==='ripe'))break;
    driver.step(60,{});ensure(driver.state().mode==='playing','Farming survives simulation time');
  }
  ensure(driver.state().frame-plantedFrame>130*60,'Moonflower used real growth time');
  for(const id of plots){const p=driver.state().village.plots.find(p=>p.id===id);ensure(p.stage==='ripe','Naturally ripe crop');walk(driver,p);command(driver,'harvest',{id});}
  ensure(driver.state().village.produce.moonflower===1&&driver.state().village.produce.turnip===1,'Both required produce earned by harvest');
  frontierCheckpoint(driver,'depth-life-harvest');
  const kitchen={x:VILLAGE.x+8,z:VILLAGE.z+4};walk(driver,{x:kitchen.x-3,z:kitchen.z});command(driver,'build',{type:'kitchen',...kitchen});
  command(driver,'craft',{id:'growthTonic'});
  const crafted=driver.state();ensure(crafted.village.items.growthTonic===1,'Newly unlocked output crafted');ensure(crafted.village.produce.moonflower===0&&crafted.village.produce.turnip===0,'Recipe paid exact earned produce');
  const target=crafted.village.plots.find(p=>p.id===plots[0]);walk(driver,target);command(driver,'plant',{id:target.id,crop:'pumpkin'});
  const before=driver.state().village.plots.find(p=>p.id===target.id);ensure(before.growth===0&&!before.watered,'Actual new pumpkin awaiting cultivation');
  command(driver,'useItem',{id:'growthTonic',targetId:target.id});
  const used=driver.state(),p=used.village.plots.find(p=>p.id===target.id);ensure(p.watered&&p.growth===45,'Crafted tonic applied real watering and growth');ensure(used.village.items.growthTonic===0,'Output consumed once');
  frontierCheckpoint(driver,'depth-life-tonic-used');
  const expected=durable(used);driver.load(JSON.parse(JSON.stringify(driver.save())));
  let reloaded=driver.state();ensure(recipeUnlocked(reloaded,'growthTonic'),'Validated cave unlock persists');ensure(same(durable(reloaded),expected),'Consumed resources, crop effect and awards persist exactly');
  driver.load(JSON.parse(JSON.stringify(driver.save())));reloaded=driver.state();ensure(same(durable(reloaded),expected),'Second reload duplicates no rewards or work');
  ensure(reloaded.metrics.falls===0,'No recovery shortcut throughout cave and life route');
  const finish=frontierCheckpoint(driver,'depth-life-reloaded');
  return {cave,finish,recipe:'growthTonic',produce:reloaded.village.produce,items:reloaded.village.items,plot:reloaded.village.plots.find(p=>p.id===target.id),saveReloads:2};
}
export async function runNodeDepthLifeRoute(){
  const {createGame,stepGame,fastTravel,exportSave,loadSave}=await import('../sim.mjs');const {villageAction}=await import('../village.mjs');
  let s=createGame();return runDepthLifeRoute({state:()=>structuredClone(s),step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return structuredClone(s);},village:(action,payload)=>villageAction(s,action,payload),travel:id=>fastTravel(s,id),save:()=>exportSave(s),load:data=>{s=loadSave(data);return structuredClone(s);}});
}
if(typeof process!=='undefined'&&process.argv[1]?.endsWith('/depth-life-route.mjs'))console.log('DEPTH LIFE ORDINARY ROUTE PASS',JSON.stringify(await runNodeDepthLifeRoute()));
