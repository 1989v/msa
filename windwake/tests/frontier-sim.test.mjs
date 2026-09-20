import test from 'node:test';
import assert from 'node:assert/strict';
import { DT, createGame, stepGame, spawnEnemy, useAbility, interact, fastTravel, exportSave, loadSave, respawn } from '../sim.mjs';
import { learnSkill, equipSkill, awardXP, SKILLS } from '../progression.mjs';
import { villageAction } from '../village.mjs';
import { WORLD, VILLAGE, WAYPOINTS, BOSS_SITES, LANDMARKS, OBSTACLES, heightAt, spawnsNear, worldStats } from '../world.mjs';
import { runFrontierAdventure } from './frontier-routes.mjs';

// These are controlled integration fixtures exercising the actual sim/physics/
// save pipeline. Natural journeys are separately in frontier-routes.mjs.
function place(s,x,z,y=heightAt(x,z)){
  Object.assign(s.player,{x,y,z,vx:0,vy:0,vz:0,yaw:0,grounded:true,coyote:.12,
    safeX:x,safeY:y,safeZ:z});s.streamCell=null;return s.player;
}
function advance(s,frames,input={}){for(let i=0;i<frames;i++)stepGame(s,input);return s;}
function isolated(){const s=createGame();s.enemies=[];place(s,VILLAGE.x,VILLAGE.z);return s;}
function learn(s,...ids){awardXP(s,5000);for(const id of ids)assert.equal(learnSkill(s,id).ok,true,id);}
function stationary(s,type,x,z,extra={}){return spawnEnemy(s,type,x,z,heightAt(x,z),{state:'recover',timer:99,...extra});}
function finiteState(s){for(const [key,value] of Object.entries(s.player))if(typeof value==='number')assert.ok(Number.isFinite(value),key);
  for(const e of s.enemies)for(const key of ['x','y','z','hp','maxHp'])assert.ok(Number.isFinite(e[key]),`${e.id}.${key}`);}

test('equipped sunbolt input creates a real projectile, damages a reachable target and cannot bypass cooldown',()=>{
  const s=isolated();learn(s,'edge','sunbolt');assert.equal(equipSkill(s,'sunbolt',0).ok,true);
  const e=stationary(s,'sentinel',s.player.x,s.player.z+8),hp=e.hp;
  stepGame(s,{skill1:true});assert.ok(s.projectiles.some(p=>p.type==='sunbolt'&&p.team==='player'));
  assert.ok(s.player.energy<77);assert.ok(s.player.abilityCooldowns.sunbolt>2.7);
  assert.equal(useAbility(s,0),false);advance(s,30);assert.ok(e.hp<hp);
  const after=e.hp;advance(s,20,{skill1:true});assert.equal(e.hp,after,'held input never re-fires within cooldown');
});

test('sunbolt and quake respect the existing solid quarry wall and separate floors',()=>{
  for(const ability of ['sunbolt','quake']){
    const s=isolated();learn(s,'edge','sunbolt','heavyblade','quake');equipSkill(s,ability,0);
    place(s,-57.4,0);s.player.yaw=Math.PI/2;
    const behind=stationary(s,'sentinel',-54.6,0),above=stationary(s,'sentinel',-57.4,2,{y:s.player.y+6});
    const hp=behind.hp,high=above.hp;
    assert.equal(useAbility(s,0),true);advance(s,35);
    assert.equal(behind.hp,hp,`${ability} cover`);assert.equal(above.hp,high,`${ability} vertical separation`);
  }
});

test('wind dash has real directional displacement and cannot tunnel through a wall',()=>{
  const open=isolated();learn(open,'quickstep','winddash');equipSkill(open,'winddash',0);
  open.player.yaw=Math.PI/2;const x=open.player.x;assert.equal(useAbility(open,0),true);advance(open,24);
  assert.ok(open.player.x>x+4);assert.ok(open.player.abilityCooldowns.winddash>2.5);
  const wall=isolated();learn(wall,'quickstep','winddash');equipSkill(wall,'winddash',0);
  const solid=OBSTACLES.find(b=>b.id==='wall-west');place(wall,solid.x-3,solid.z);wall.player.yaw=Math.PI/2;
  useAbility(wall,0);advance(wall,24);assert.ok(wall.player.x<=solid.x-solid.w/2-.3);
});

test('bloom heals actual HP and quake strikes grounded nearby targets with energy/cooldown gates',()=>{
  const s=isolated();learn(s,'gardener','bloom','edge','heavyblade','quake');equipSkill(s,'bloom',0);equipSkill(s,'quake',1);
  assert.equal(useAbility(s,0),false,'full-health bloom spends nothing');assert.equal(s.player.energy,100);
  s.player.hp=30;assert.equal(useAbility(s,0),true);assert.equal(s.player.hp,75);assert.equal(s.player.energy,66);
  assert.equal(useAbility(s,0),false);const e=stationary(s,'sentinel',s.player.x,s.player.z+3),hp=e.hp;
  assert.equal(useAbility(s,1),true);assert.ok(e.hp<hp);assert.equal(s.player.energy,29,'40 energy cost, then 3 energy from the actual hit');assert.equal(useAbility(s,1),false);
  const air=isolated();learn(air,'edge','heavyblade','quake');equipSkill(air,'quake',0);air.player.grounded=false;
  assert.equal(useAbility(air,0),false);assert.equal(air.player.energy,100);
});

test('passive effects reach real movement, capacity and sword combat after save restore',()=>{
  const base=isolated(),boost=isolated();learn(boost,'edge','quickstep','endurance','reservoir');
  advance(base,60,{moveZ:1});advance(boost,60,{moveZ:1});
  assert.ok(boost.player.z>base.player.z+.2);assert.equal(boost.player.maxStamina,125);assert.equal(boost.player.maxEnergy,125);
  const restored=loadSave(exportSave(boost));assert.equal(restored.player.maxStamina,125);assert.equal(restored.player.maxEnergy,125);
  function sword(s){place(s,VILLAGE.x,VILLAGE.z);s.enemies=[];const e=stationary(s,'stalker',s.player.x,s.player.z+2);stepGame(s,{attack:true});advance(s,10);return e.maxHp-e.hp;}
  assert.ok(sword(restored)>sword(base));
});

test('waypoints require a physical interaction, persist, and reset travel motion on safe ground',()=>{
  const s=createGame(),w=WAYPOINTS.find(w=>w.id!=='home');assert.equal(fastTravel(s,w.id),false);
  place(s,w.x,w.z);advance(s,2);assert.equal(s.adventure.waypoints.includes(w.id),false);
  interact(s);assert.ok(s.adventure.waypoints.includes(w.id));const xp=s.adventure.xp;interact(s);assert.equal(s.adventure.xp,xp);
  s.enemies=s.enemies.filter(e=>Math.hypot(e.x-s.player.x,e.z-s.player.z)>13);
  Object.assign(s.player,{vx:12,vy:8,vz:-4,gliding:true});assert.equal(fastTravel(s,'home'),true);
  assert.equal(s.player.vx,0);assert.equal(s.player.vy,0);assert.equal(s.player.vz,0);assert.equal(s.player.gliding,false);
  assert.equal(s.player.y,heightAt(s.player.x,s.player.z));assert.ok(s.player.y>WORLD.waterLevel);
  const loaded=loadSave(exportSave(s));assert.ok(loaded.adventure.waypoints.includes(w.id));assert.equal(fastTravel(loaded,w.id),true);
});

test('active raids block travel while a safe distant queued raid permits home return',()=>{
  const s=isolated();s.village.raid.status='queued';place(s,0,-350);assert.equal(fastTravel(s,'home'),true);
  s.village.raid.status='active';assert.equal(fastTravel(s,'home'),false);assert.ok(s.toast.length>0);
});

test('regional first-clear pays once, survives reload and does not respawn after streaming away',()=>{
  const s=isolated(),site=BOSS_SITES.find(b=>!b.final);place(s,site.x,site.z-3);
  const e=stationary(s,'boss',site.x,site.z,{id:site.id,bossId:site.id,family:site.family,frontier:true,name:site.name,hp:1});
  stepGame(s,{skill:true});assert.equal(e.hp,0);assert.ok(s.adventure.bosses.includes(site.id));assert.equal(s.mode,'playing');
  const earned={wood:s.village.materials.wood,xp:s.adventure.xp,crystals:s.player.crystals};advance(s,20,{skill:true});
  assert.deepEqual({wood:s.village.materials.wood,xp:s.adventure.xp,crystals:s.player.crystals},earned);
  const loaded=loadSave(exportSave(s));place(loaded,site.x,site.z);advance(loaded,3);
  assert.equal(loaded.enemies.some(e=>e.bossId===site.id&&e.hp>0),false);assert.deepEqual(loaded.adventure.bosses,[site.id]);
});

test('defeated streamed regular enemies stay defeated across unload, return and save reload',()=>{
  const s=isolated();let spec;
  for(const w of WAYPOINTS){spec=spawnsNear(w.x,w.z,110).find(e=>e.type!=='boss'&&!e.id.startsWith('enemy-'));if(spec)break;}
  assert.ok(spec,'finite streamed regular spawn exists');place(s,spec.x,spec.z-2);advance(s,1);
  const e=s.enemies.find(e=>e.id===spec.id);assert.ok(e);e.hp=1;e.state='recover';e.timer=99;
  stepGame(s,{skill:true});assert.equal(e.hp,0);assert.equal(s.adventure.worldDefeated[e.id],true);
  place(s,850,-850);advance(s,2);place(s,spec.x,spec.z);advance(s,2);
  assert.equal(s.enemies.some(a=>a.id===spec.id&&a.hp>0),false);
  const loaded=loadSave(exportSave(s));place(loaded,spec.x,spec.z);advance(loaded,2);
  assert.equal(loaded.enemies.some(a=>a.id===spec.id&&a.hp>0),false);
});

test('three streamed out-and-return circuits keep simulation entity, effect and projectile budgets bounded',()=>{
  const s=createGame();let samples=0,maxEnemies=0;
  for(let loop=0;loop<3;loop++)for(const waypoint of [...WAYPOINTS,...WAYPOINTS.toReversed()]){
    place(s,waypoint.x,waypoint.z);advance(s,3);samples++;maxEnemies=Math.max(maxEnemies,s.enemies.length);
    assert.ok(s.enemies.length<=64);assert.ok(s.effects.length<=100);assert.ok(s.projectiles.length<=60);
    assert.ok(worldStats().cachedChunks<=96);finiteState(s);
  }
  assert.equal(samples,54);assert.ok(maxEnemies>0);
  // CPU/simulation-only fixture: renderer/GPU/frame-rate evidence belongs to Chrome.
});

test('v1 migration retains completed original progress and initializes the new adventure safely',()=>{
  const chests=LANDMARKS.filter(l=>l.kind==='chest'&&l.id.startsWith('chest-')).map(l=>l.id);
  const old={version:1,seed:1234,progress:{sigils:['quarry','forest','ruins'],discovered:['meadow','camp','camp-east','camp-forest'],
    chests,glider:true,bossDefeated:true,upgrades:{health:2,power:3}},crystals:87,checkpoint:'camp-east',metrics:{kills:22,parries:9},time:181.25};
  const s=loadSave(old);assert.equal(s.version,3);assert.equal(s.mode,'playing');assert.deepEqual(s.progress,old.progress);
  assert.equal(s.player.crystals,87);assert.equal(s.player.checkpoint,'camp-east');assert.equal(s.player.maxHp,150);
  assert.equal(s.metrics.kills,22);assert.equal(s.metrics.parries,9);assert.equal(s.time,181.25);
  assert.equal(s.enemies.find(e=>e.id==='boss').hp,0);assert.deepEqual(s.adventure.waypoints,['home']);assert.equal(s.village.level,1);
  advance(s,10);finiteState(s);
});

test('v2 roundtrip preserves learned abilities, home placement and watered crop growth without offline ticks',()=>{
  const s=isolated();learn(s,'gardener','bloom','quickstep','winddash');equipSkill(s,'winddash',1);
  const built=villageAction(s,'build',{type:'plot',x:VILLAGE.x-8,z:VILLAGE.z});assert.equal(built.ok,true);place(s,built.x,built.z);
  assert.equal(villageAction(s,'plant',{id:built.id,crop:'turnip'}).ok,true);assert.equal(villageAction(s,'water',{id:built.id}).ok,true);
  advance(s,180);const saved=exportSave(s),loaded=loadSave(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(new Set(loaded.adventure.learned),new Set(s.adventure.learned));assert.deepEqual(loaded.adventure.equipped,s.adventure.equipped);
  assert.deepEqual(loaded.village.structures,s.village.structures);assert.deepEqual(loaded.village.plots,s.village.plots);
  assert.equal(loaded.village.clock,s.village.clock);const growth=loaded.village.plots[0].growth;advance(loaded,60);
  assert.ok(Math.abs(loaded.village.plots[0].growth-growth-1)<1e-7);
});

test('malformed v2 saves normalize nested values and remain playable after actual simulation steps',()=>{
  const save=exportSave(createGame());save.seed=Infinity;save.crystals=-5;save.time=Infinity;save.checkpoint='__proto__';
  save.adventure={xp:Infinity,points:999999,level:999999,learned:SKILLS.map(s=>s.id).concat('made-up'),
    equipped:['quake','__proto__'],bosses:['not-a-boss'],waypoints:['missing'],worldDefeated:JSON.parse('{"__proto__":true,"fake":false}')};
  save.village={clock:NaN,day:-3,materials:{wood:Infinity,stone:-1,food:NaN},seeds:{turnip:-5},
    structures:[{id:'bad',type:'cottage',x:Infinity,z:0,hp:999999},{id:'bad2',type:'__proto__',x:0,z:0}],
    plots:Array.from({length:100},()=>({id:'orphan',x:Infinity,z:Infinity,crop:'fake'})),
    raid:{status:'active',day:-1,wave:999,spawned:true,rewarded:false,enemies:[{id:'fake',hp:Infinity}]} };
  const s=loadSave(save);assert.equal(s.player.crystals,0);assert.ok(s.adventure.points<=2);assert.ok(s.adventure.learned.length<=2);
  assert.deepEqual(s.adventure.equipped,[null,null]);assert.equal(s.adventure.bosses.length,0);assert.equal(s.village.structures.length,0);
  assert.equal(s.village.plots.length,0);assert.notEqual(s.village.raid.status,'won');advance(s,120);finiteState(s);
  assert.ok(s.enemies.length<=64);assert.equal(Object.getPrototypeOf(s.adventure.worldDefeated),Object.prototype);
});

function activeRaid(){
  const s=isolated();const build=villageAction(s,'build',{type:'cottage',x:VILLAGE.x+8,z:VILLAGE.z+8});assert.equal(build.ok,true);
  s.village.tasks.push('harvest');s.village.clock=449.99;advance(s,610);
  assert.equal(s.village.raid.status,'active');assert.equal(s.enemies.filter(e=>e.raid&&e.hp>0).length,3);return s;
}

test('active raid save and death-respawn retain exact survivor identities and HP without early rewards',()=>{
  const s=activeRaid(),enemies=s.enemies.filter(e=>e.raid);enemies[0].hp=17;enemies[1].hp=0;
  const before={xp:s.adventure.xp,wood:s.village.materials.wood,rep:s.village.reputation};
  const save=exportSave(s),loaded=loadSave(save),expected=enemies.filter(e=>e.hp>0).map(e=>[e.id,e.hp]).sort();
  assert.deepEqual(loaded.enemies.filter(e=>e.raid&&e.hp>0).map(e=>[e.id,e.hp]).sort(),expected);
  assert.equal(loaded.village.raid.wave,1);assert.equal(loaded.village.raid.status,'active');
  assert.deepEqual({xp:loaded.adventure.xp,wood:loaded.village.materials.wood,rep:loaded.village.reputation},before);
  loaded.mode='dead';respawn(loaded);assert.deepEqual(loaded.enemies.filter(e=>e.raid&&e.hp>0).map(e=>[e.id,e.hp]).sort(),expected);
});

test('completed raid rewards cannot replay after full save reload and simulation advance',()=>{
  const s=activeRaid();for(const e of s.enemies)if(e.raid)e.hp=0;advance(s,250);
  assert.equal(s.village.raid.wave,2);assert.equal(s.enemies.filter(e=>e.raid&&e.hp>0).length,4);
  for(const e of s.enemies)if(e.raid)e.hp=0;advance(s,2);assert.equal(s.village.raid.status,'won');assert.equal(s.village.raid.rewarded,true);
  const loaded=loadSave(exportSave(s)),before={xp:loaded.adventure.xp,wood:loaded.village.materials.wood,rep:loaded.village.reputation};advance(loaded,180);
  assert.deepEqual({xp:loaded.adventure.xp,wood:loaded.village.materials.wood,rep:loaded.village.reputation},before);
  assert.equal(loaded.village.raid.rewarded,true);
});

test('final completion remains complete across reload and does not reinstantiate the capstone',()=>{
  const s=isolated(),site=BOSS_SITES.find(b=>b.final);s.adventure.bosses=BOSS_SITES.filter(b=>!b.final).slice(0,4).map(b=>b.id);s.village.level=3;
  place(s,site.x,site.z-3);stationary(s,'boss',site.x,site.z,{id:site.id,bossId:site.id,family:site.family,final:true,frontier:true,hp:1});
  stepGame(s,{skill:true});assert.equal(s.adventure.finalDefeated,true);assert.equal(s.mode,'won');
  const loaded=loadSave(exportSave(s));assert.equal(loaded.adventure.finalDefeated,true);place(loaded,site.x,site.z);advance(loaded,3);
  assert.equal(loaded.enemies.some(e=>e.bossId===site.id&&e.hp>0),false,'completed capstone cannot return after reload');
});

test('one fresh natural adventure earns farming, two defense waves, village3 and the capstone through public actions',()=>{
  const s=createGame(),checkpoints=[],actions=[];
  const driver={
    // Clone reads so accidental controller writes cannot alter the real game.
    state:()=>structuredClone(s),
    step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return structuredClone(s);},
    village(action,payload){actions.push(action);return villageAction(s,action,payload);},
    learn:id=>learnSkill(s,id),equip:(id,slot)=>equipSkill(s,id,slot),travel:id=>fastTravel(s,id),
    onCheckpoint:checkpoint=>checkpoints.push(checkpoint),
  };
  const result=runFrontierAdventure(driver);
  assert.equal(s.mode,'won');assert.equal(s.adventure.finalDefeated,true);assert.equal(s.village.level,3);
  assert.equal(s.adventure.bosses.filter(id=>id!=='boss-frontier').length,4);
  assert.equal(s.village.raid.status,'won');assert.equal(s.village.raid.rewarded,true);assert.equal(s.village.raid.wave,2);
  for(const id of ['gather','build','plant','water','harvest','defend'])assert.ok(s.village.tasks.includes(id),id);
  assert.equal(actions.filter(action=>action==='upgrade').length,2);
  assert.ok(checkpoints.find(c=>c.stage==='natural-first-dusk-warning').seconds>=360);
  assert.ok(checkpoints.find(c=>c.stage==='natural-two-wave-defense-complete').seconds>=370);
  assert.ok(result.distance>3000);assert.equal(result.falls,0);assert.ok(s.metrics.parries>0);
});
