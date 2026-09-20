import {WORLD,LANDMARKS,RUNES,PLATE,BLOCK_SPAWN,ENEMY_SPAWNS,WAYPOINTS,BOSS_SITES,VILLAGE,querySolids,spawnsNear,heightAt,supportAt,regionAt,clamp,distance} from './world.mjs';

import {ENEMY_STATS,updateExpandedEnemy} from './combat.mjs';
import {initAdventure,awardXP,modifiers,validateAdventure,ACTIVE_SKILLS} from './progression.mjs';
import {initVillage,tickVillage,villageAction,villageInteraction,villageSolids,captureRaid,restoreRaid,validateVillage} from './village.mjs';
import {initJourney,validateJourney,townInteraction,townAction,grantRelic} from './settlements.mjs';
import {DUNGEONS,initExpedition,validateExpedition,dungeonFloor,dungeonSolids,dungeonBounds,dungeonInteraction,dungeonAction,tickDungeon,enterDungeon,leaveDungeon,recordDungeonKill,dungeonObjective} from './dungeons.mjs';

export const DT=1/60;
const TAU=Math.PI*2;
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const SIGILS=['quarry','forest','ruins'];
const BUTTONS=['jump','attack','dodge','parry','skill','interact','heal','skill1','skill2'];

function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function emit(s,type,text,at=s.player,extra={}){s.events.push({type,text,x:at.x,y:at.y,z:at.z,...extra});}
function fx(s,type,at,extra={}){s.effects.push({type,x:at.x,y:at.y,z:at.z,age:0,life:.45,yaw:at.yaw||0,...extra});if(s.effects.length>100)s.effects.splice(0,s.effects.length-100);}
export function spawnEnemy(s,type='stalker',x=s.player.x+6,z=s.player.z+6,y,extra={}) {
  if(!ENEMY_STATS[type] || s.enemies.length>=64)return null;
  const spec=ENEMY_STATS[type];
  const e={id:`spawn-${s.nextId++}`,type,x,z,y:y??supportFor(s,x,z,floorAt(s,x,z)),yaw:0,hp:spec.hp,maxHp:spec.hp,state:'idle',timer:.4,hitFlash:0,homeX:x,homeZ:z,homeY:y??floorAt(s,x,z),vx:0,vz:0,vy:0,attackCount:0,pattern:'slam',phase:1,rewarded:false,poise:0,...extra};
  s.enemies.push(e);return e;
}
export function createGame(seed=WORLD.seed) {
  seed=Number.isFinite(seed)?seed>>>0:WORLD.seed;
  const p={x:WORLD.spawn.x,z:WORLD.spawn.z,y:heightAt(WORLD.spawn.x,WORLD.spawn.z),vx:0,vy:0,vz:0,yaw:0,hp:100,maxHp:100,stamina:100,maxStamina:100,energy:100,maxEnergy:100,grounded:true,airState:'GROUND',gliding:false,action:'idle',actionTime:0,combo:0,attackTimer:0,attackElapsed:0,attackHit:false,attackQueued:false,comboWindow:0,dodgeTimer:0,parryTimer:0,parryCooldown:0,invulnerable:0,skillCooldown:0,abilityCooldowns:{},dashTimer:0,slowTimer:0,crystals:0,flasks:3,checkpoint:'camp',coyote:.12,jumpBuffer:0,plunge:false,safeX:WORLD.spawn.x,safeY:heightAt(WORLD.spawn.x,WORLD.spawn.z),safeZ:WORLD.spawn.z,fallPeak:0};
  const s={version:2,frame:0,time:0,seed,rng:seed,mode:'playing',player:p,enemies:[],projectiles:[],items:[],blocks:[{...BLOCK_SPAWN}],adventure:initAdventure(),village:initVillage(),streamCell:null,trial:null,progress:{sigils:[],discovered:['meadow','camp'],chests:[],upgrades:{health:0,power:0},glider:false,bossDefeated:false},events:[],effects:[],metrics:{jumps:0,landings:0,hits:0,kills:0,parries:0,dodges:0,combos:0,damageTaken:0,distance:0,falls:0,secrets:0},puzzle:{runeStep:0,plateCharge:0},previousInput:{},nextId:1,region:'meadow',toast:'',toastTime:0};
  for(const spec of ENEMY_SPAWNS){const e=spawnEnemy(s,spec.type,spec.x,spec.z,spec.y);e.id=spec.id;}
  s.version=3;s.expedition=initExpedition();s.journey=initJourney();
  return s;
}
export const snapshot=s=>structuredClone(s);
export function restoreSnapshot(data){
  if(!data||![1,2,3].includes(data.version)||!Number.isFinite(data.frame)||!data.player||!Number.isFinite(data.player.x))throw new Error('Invalid simulation snapshot');
  const next=structuredClone(data);next.adventure??=initAdventure();next.village??=initVillage();next.player.abilityCooldowns??={};next.player.dashTimer??=0;next.player.slowTimer??=0;next.expedition??=initExpedition();next.journey??=initJourney();next.version=3;if(next.expedition.active)next.blocks=next.expedition.active.blocks;return next;
}
function toast(s,text,type='notice'){s.toast=text;s.toastTime=4;emit(s,type,text);}
export function floorAt(s,x,z){return s?.expedition?.active?dungeonFloor(s,x,z):heightAt(x,z);}
function solidsFor(s,x,z,r=5,excludeId=null){
  const fixed=s?.expedition?.active?dungeonSolids(s,x,z,r):[...querySolids(x,z,r),...(s?villageSolids(s):[])];
  return [...fixed,...(s?.blocks||[]).filter(b=>b.id!==excludeId&&Math.abs(b.x-x)<r+b.w/2&&Math.abs(b.z-z)<r+b.d/2)];
}
function supportFor(s,x,z,feet=Infinity,radius=.32,excludeId=null){
  let floor=floorAt(s,x,z);
  for(const b of solidsFor(s,x,z,radius,excludeId))if(overlaps(x,z,b,radius)&&b.y+b.h<=feet+.48)floor=Math.max(floor,b.y+b.h);
  return floor;
}
function overlaps(x,z,b,r=.37){return Math.abs(x-b.x)<b.w/2+r-1e-6&&Math.abs(z-b.z)<b.d/2+r-1e-6;}
function verticalOverlap(y,b,h=1.65){return y+ h>b.y+.06 && y < b.y+b.h-.12;}
function horizontalMove(body,dx,dz,solids=querySolids(body.x,body.z,5),r=.37,h=1.65,step=.48,s=null) {
  const oldX=body.x,oldZ=body.z;
  for(const axis of ['x','z']){
    if(Math.abs(axis==='x'?dx:dz)<1e-10)continue;
    body[axis]+=axis==='x'?dx:dz;
    for(const b of solids){
      if(!overlaps(body.x,body.z,b,r)||!verticalOverlap(body.y,b,h))continue;
      const top=b.y+b.h;
      if(body.grounded && top-body.y<=step && top>=body.y-.05){body.y=top;continue;}
      if(axis==='x')body.x=oldX<=b.x?b.x-b.w/2-r:b.x+b.w/2+r;
      else body.z=oldZ<=b.z?b.z-b.d/2-r:b.z+b.d/2+r;
    }
  }
  const ground=floorAt(s,body.x,body.z),oldGround=floorAt(s,oldX,oldZ);
  if(ground-body.y>step && ground-oldGround>Math.hypot(dx,dz)*1.15){body.x=oldX;body.z=oldZ;}
  const bounds=s?.expedition?.active?dungeonBounds(s):{minX:-WORLD.size+2,maxX:WORLD.size-2,minZ:-WORLD.size+2,maxZ:WORLD.size-2};
  body.x=clamp(body.x,bounds.minX,bounds.maxX);body.z=clamp(body.z,bounds.minZ,bounds.maxZ);
}
function verticalMove(body,dt,solids=querySolids(body.x,body.z,5),s=null){
  const before=body.y,wasGrounded=body.grounded;
  body.y+=body.vy*dt;
  let floor=floorAt(s,body.x,body.z);
  for(const b of solids){
    if(!overlaps(body.x,body.z,b,.31))continue;
    const top=b.y+b.h;
    if(before>=top-.18&&body.y<=top&&body.vy<=0)floor=Math.max(floor,top);
    if(before+1.65<=b.y+.05&&body.y+1.65>=b.y&&body.vy>0){body.y=b.y-1.65;body.vy=0;}
  }
  if(body.y<=floor+.015){body.y=floor;body.vy=0;body.grounded=true;}
  else body.grounded=false;
  return !wasGrounded&&body.grounded;
}
function facing(a,b,width=1.5){return Math.abs(angleDelta(Math.atan2(b.x-a.x,b.z-a.z),a.yaw))<width;}
function lineClear(a,b,s){
  const start=[a.x,a.y+.95,a.z],end=[b.x,b.y+.95,b.z];
  for(const box of solidsFor(s,(a.x+b.x)/2,(a.z+b.z)/2,Math.min(180,distance(a,b)/2+3))){
    const min=[box.x-box.w/2,box.y,box.z-box.d/2],max=[box.x+box.w/2,box.y+box.h,box.z+box.d/2];
    let near=0,far=1,blocked=true;
    for(let axis=0;axis<3;axis++){
      const delta=end[axis]-start[axis];
      if(Math.abs(delta)<.00001){if(start[axis]<min[axis]||start[axis]>max[axis]){blocked=false;break;}}
      else {let t0=(min[axis]-start[axis])/delta,t1=(max[axis]-start[axis])/delta;if(t0>t1)[t0,t1]=[t1,t0];near=Math.max(near,t0);far=Math.min(far,t1);if(near>far){blocked=false;break;}}
    }
    if(blocked&&far>.02&&near<.98)return false;
  }
  return true;
}
function target(s,range=5){return s.enemies.filter(e=>e.hp>0&&distance(e,s.player)<range&&Math.abs(e.y-s.player.y)<2.6&&facing(s.player,e,1.5)).sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0];}
function startAttack(s){
  const p=s.player;if(p.dodgeTimer>0||p.parryTimer>0)return;
  const e=target(s);if(e)p.yaw=Math.atan2(e.x-p.x,e.z-p.z);
  p.combo=p.comboWindow>0?p.combo%3+1:1;
  p.attackTimer=[0,.36,.40,.58][p.combo];p.attackElapsed=0;p.attackHit=false;p.attackQueued=false;p.comboWindow=.9;
  p.action='attack';p.actionTime=p.attackTimer;
  if(!p.grounded&&!p.gliding){p.plunge=true;p.vy=Math.min(p.vy,-15);}
  emit(s,`attack${p.combo}`);fx(s,'slash',p,{life:p.attackTimer,combo:p.combo,power:p.combo});
  if(p.combo===3)s.metrics.combos++;
}
function dropReward(s,e){
  if(e.rewarded)return;e.rewarded=true;s.metrics.kills++;
  emit(s,'enemy-death',undefined,e);fx(s,'reward',e,{life:.8,power:e.type==='boss'?6:2});
  if(e.dungeonId){recordDungeonKill(s,e,dungeonHooks(s));return;}
  if(e.raid||e.summonedBy)return;
  if(e.frontier&&!e.summonedBy)s.adventure.worldDefeated[e.id]=true;
  if(e.bossId){
    if(!s.adventure.bosses.includes(e.bossId)){
      s.adventure.bosses.push(e.bossId);awardXP(s,e.final?300:150);payoutMaterials(s,e.final?30:12);
      s.player.crystals+=e.final?30:12;s.player.hp=s.player.maxHp;
      if(e.final){s.adventure.finalDefeated=true;s.mode='won';toast(s,'모든 길의 바람이 깨어났습니다. 마을과 세계에서 여정을 이어가세요.','win');}
      else toast(s,`${e.name||'지역 수호자'} 격파 · 기술 경험치와 마을 재료를 얻었습니다.`,'reward');
    }
    return;
  }
  awardXP(s,e.type==='boss'?180:(ENEMY_STATS[e.type].xp||18));
  if(e.type==='boss'){
    if(!s.progress.bossDefeated){s.progress.bossDefeated=true;s.adventure.chapter=2;s.player.crystals+=15;s.mode='won';toast(s,'바람이 돌아왔습니다. 당신의 여정이 이 하늘을 깨웠습니다.','win');}
  }else for(let i=0;i<(e.type==='charger'?4:2);i++)s.items.push({id:`drop-${s.nextId++}`,type:'crystal',x:e.x+(random(s)-.5)*1.4,y:e.y+.3,z:e.z+(random(s)-.5)*1.4,age:0});
}
function hitEnemy(s,e,damage,kind='sword',knock=3){
  if(e.hp<=0)return;
  const p=s.player,controlHit=kind!=='sword'&&kind!=='plunge';
  if((e.type==='charger'||(e.type==='sentinel'&&e.guarding))&&kind==='sword'&&e.state!=='hit'&&facing(e,p,1.25)){
    damage=Math.ceil(damage*.25);emit(s,'block',undefined,e);fx(s,'parry',e,{life:.24,power:.6});
  }
  e.hp=Math.max(0,e.hp-damage);e.hitFlash=.18;
  // Basic attacks deal damage without cancelling or redirecting enemy actions.
  if(controlHit){const d=Math.max(.1,distance(e,p));e.vx=(e.x-p.x)/d*knock;e.vz=(e.z-p.z)/d*knock;}
  if(e.type==='boss'&&kind==='pulse')e.poise++;
  if(e.hp===0){e.state='dead';e.timer=1;dropReward(s,e);}
  else if(controlHit&&(e.type!=='boss'||kind==='parry'||e.poise>=3)){
    e.state='hit';e.timer=kind==='parry'?1.6:kind==='pulse'?.95:.36;e.poise=0;
    if(e.type==='boss')toast(s,'수호자의 균열 · 지금 검을 이어 휘두르세요!');
  }
  s.metrics.hits++;p.energy=Math.min(p.maxEnergy,p.energy+3);emit(s,'hit',undefined,e,{hitStop:controlHit});fx(s,'hit',e,{power:damage,life:.45});
}
function playerDamage(s,amount,source,unblockable=false){
  const p=s.player;if(s.mode!=='playing'||p.invulnerable>0)return false;
  if(!unblockable&&p.parryTimer>0&&(!source||facing(p,source,1.8))){
    s.metrics.parries++;p.stamina=Math.min(p.maxStamina,p.stamina+18);p.energy=Math.min(p.maxEnergy,p.energy+24);p.invulnerable=.25;
    emit(s,'parry');fx(s,'parry',p,{life:.6,power:3});
    if(source?.hp>0)hitEnemy(s,source,25,'parry',6);
    toast(s,'완벽한 받아치기 · 적이 빈틈을 드러냈습니다.');return false;
  }
  amount=Math.max(1,Math.round(amount*(unblockable?1:1-modifiers(s).armor)));
  p.hp=Math.max(0,p.hp-amount);s.metrics.damageTaken+=amount;p.invulnerable=.7;emit(s,'hurt');fx(s,'hurt',p,{life:.3,power:amount});
  if(source){const d=Math.max(.1,distance(p,source));p.vx+=(p.x-source.x)/d*5;p.vz+=(p.z-source.z)/d*5;}
  if(p.hp<=0){s.mode='dead';p.gliding=false;p.attackTimer=0;toast(s,'바람이 잠시 잦아들었습니다. 모닥불에서 다시 일어나세요.','death');}
  return true;
}
function pulse(s){
  const p=s.player;if(p.energy<35||p.skillCooldown>0||p.dodgeTimer>0)return;
  p.energy-=35;p.skillCooldown=1.3;p.action='pulse';p.actionTime=.4;
  emit(s,'pulse');fx(s,'pulse',p,{life:.65,power:7});
  for(const e of s.enemies)if(e.hp>0&&distance(p,e)<7&&Math.abs(p.y-e.y)<3.2&&lineClear(p,e,s))hitEnemy(s,e,22+s.progress.upgrades.power*3+(s.progress.sigils.length===3?12:0),'pulse',10);
  for(const b of s.blocks){const d=distance(p,b);if(d<7&&Math.abs(b.y-p.y)<3){b.vx=(b.x-p.x)/Math.max(d,.1)*12;b.vz=(b.z-p.z)/Math.max(d,.1)*12;}}
  s.projectiles=s.projectiles.filter(pr=>distance(pr,p)>8);
}
export function awardSigil(s,id){
  if(!SIGILS.includes(id)||s.progress.sigils.includes(id))return false;
  s.progress.sigils.push(id);s.progress.glider=true;s.player.crystals+=5;s.player.hp=s.player.maxHp;
  const n=s.progress.sigils.length;s.player.maxStamina=100+(n-1)*20;s.player.stamina=s.player.maxStamina;s.player.energy=s.player.maxEnergy;awardXP(s,80);
  toast(s,n===1?'첫 봉인 해방 · 바람돛 획득! 공중에서 Space를 다시 눌러 활강하세요.':n===2?'두 번째 봉인 · 기력 확장! 마지막 울림을 찾아가세요.':'세 봉인이 깨어났습니다. 중앙 상승기류로 하늘섬에 오르세요.','solve');
  fx(s,'reward',s.player,{life:1.5,power:5});return true;
}
export function interaction(s){
  if(s.expedition?.active)return dungeonInteraction(s);
  const p=s.player,candidates=[];const home=villageInteraction(s);if(home)candidates.push({...home,d:distance(p,home)-.05});
  const resident=townInteraction(s);if(resident)candidates.push({...resident,d:distance(p,resident)-.1});
  for(const l of LANDMARKS){
    if(['resource','village','town'].includes(l.kind)||l.id==='home')continue;
    if(l.kind==='trial'&&s.adventure.completedTasks.includes(l.id))continue;
    if(distance(p,l)>3.3||Math.abs(p.y-l.y)>2.5)continue;
    if(l.kind==='chest'&&s.progress.chests.includes(l.id))continue;
    if(l.kind==='shrine'&&s.progress.sigils.includes(l.id))continue;
    candidates.push({...l,d:distance(p,l)});
  }
  if(!s.progress.sigils.includes('forest'))for(const r of RUNES)if(distance(p,r)<2.5&&Math.abs(p.y-r.y)<2.3)candidates.push({...r,kind:'rune',d:distance(p,r),description:`${r.name}의 돌에 울림 새기기`});
  return candidates.sort((a,b)=>a.d-b.d)[0]||null;
}
export function interact(s){
  if(s.mode!=='playing')return null;
  const near=interaction(s);if(!near)return null;const p=s.player;
  emit(s,'interact');
  if(s.expedition?.active){const result=dungeonAction(s,'interact',{id:near.id},dungeonHooks(s));if(!result.ok)toast(s,result.reason);return near;}
  if(near.kind==='npc'){
    const result=townAction(s,'talk',{npcId:near.id});if(result.ok){s.activeTown=near.townId;emit(s,'town-open');}else toast(s,result.reason);
  }else if(near.kind==='dungeon'){
    const result=enterDungeon(s,near.id,dungeonHooks(s));if(!result.ok)toast(s,result.reason);
  }else if(['village','resource','crop'].includes(near.kind)){
    if(near.kind==='village'){if(near.action!=='rest'){const result=villageAction(s,near.action,near.payload||{});if(!result.ok)toast(s,result.reason);}else emit(s,'village-open');}
    else {const result=villageAction(s,near.action,near.payload||{id:near.id});if(!result.ok)toast(s,result.reason);}
  }else if(near.kind==='waypoint'){
    if(!s.adventure.waypoints.includes(near.id)){s.adventure.waypoints.push(near.id);awardXP(s,30);toast(s,`${near.name} 점화 · 지도 M에서 빠른 이동할 수 있습니다.`,'reward');}
    else toast(s,'지도 M에서 점화한 웨이포인트로 이동할 수 있습니다.');
  }else if(near.kind==='trial'){
    if(near.challenge==='survive'){
      if(s.trial?.id!==near.id){
        s.enemies=s.enemies.filter(e=>!e.trialId);s.trial={id:near.id,enemies:[],x:near.x,z:near.z};
        for(let i=0;i<3;i++){
          const id=`${near.id}-guardian-${i}`;s.trial.enemies.push(id);
          if(!s.adventure.worldDefeated[id])spawnEnemy(s,['slime','wolf','sentinel'][i],near.x+Math.sin(i*2.1)*7,near.z+Math.cos(i*2.1)*7,undefined,{id,frontier:true,trialId:near.id});
        }
        toast(s,'바람의 시련 · 세 파수꾼을 물리치세요. 이미 이긴 파수꾼은 다시 나타나지 않습니다.');
      }
    }else {completeTrial(s,near.id);}
  }else if(near.kind==='boss')toast(s,near.final&&!(s.adventure.bosses.length>=4&&s.village.level>=3)?'네 지역 수호자 격파와 마을 3단계가 필요합니다.':'수호자의 공격 예고를 읽고 빈틈을 노리세요.');
  else if(near.kind==='camp'){
    const threatened=s.enemies.some(e=>e.hp>0&&distance(e,p)<11&&Math.abs(e.y-p.y)<4&&e.state!=='idle');
    if(threatened){toast(s,'적이 가까이 있습니다. 전투를 마친 뒤 쉬어가세요.');return near;}
    p.hp=p.maxHp;p.stamina=p.maxStamina;p.energy=p.maxEnergy;p.flasks=Math.max(3,p.flasks);p.checkpoint=near.id;
    if(!s.progress.discovered.includes(near.id))s.progress.discovered.push(near.id);
    toast(s,'모닥불의 온기 · 체력과 회복약을 보충했습니다. 강화는 모닥불 메뉴에서.','rest');
  }else if(near.kind==='chest'){
    s.progress.chests.push(near.id);p.crystals+=5;p.flasks=Math.min(6,p.flasks+1);s.metrics.secrets++;awardXP(s,35);payoutMaterials(s,4);
    toast(s,`${near.name} · 결정 5개와 회복약을 발견했습니다.`,'reward');fx(s,'reward',near,{life:1.2,power:4});
  }else if(near.kind==='rune'){
    const correct=RUNES[s.puzzle.runeStep].id===near.id;
    if(correct){s.puzzle.runeStep++;toast(s,`${near.name}의 울림 · ${s.puzzle.runeStep}/3`,'rune');if(s.puzzle.runeStep===3)awardSigil(s,'forest');}
    else{s.puzzle.runeStep=0;toast(s,'이야기가 이어지지 않습니다. 자라나는 것에서 시작해, 빛을 거쳐 날아오르세요.','wrong');}
  }else if(near.id==='quarry'){
    s.blocks[0]={...BLOCK_SPAWN};s.puzzle.plateCharge=0;toast(s,'돌이 제자리로 돌아왔습니다. 돌 남쪽에 서서 Q로 금빛 원을 향해 밀어보세요.');
  }else if(near.id==='ruins')awardSigil(s,'ruins');
  else if(near.id==='forest')toast(s,near.description);
  else if(near.kind==='wind')toast(s,s.progress.sigils.length<3?near.description:'기류 안에서 뛰어오르세요. 높이 34m에서 북쪽 하늘섬으로!');
  return near;
}
export function upgrade(s,kind){
  if(!['health','power'].includes(kind))return false;
  const near=interaction(s);if(near?.kind!=='camp'||s.mode!=='playing'||s.enemies.some(e=>e.hp>0&&distance(e,s.player)<11&&Math.abs(e.y-s.player.y)<4&&e.state!=='idle'))return false;
  const level=s.progress.upgrades[kind],cost=(kind==='health'?5:7)+level*3;
  if(level>=3||s.player.crystals<cost)return false;
  s.player.crystals-=cost;s.progress.upgrades[kind]++;
  s.player.maxHp=100+25*s.progress.upgrades.health;s.player.hp=s.player.maxHp;
  toast(s,kind==='health'?'여정의 체력 강화 · 최대 체력 +25':'울림의 검 강화 · 공격력 증가','reward');return true;
}
function updateBlocks(s){
  for(const b of s.blocks){
    b.vx*=.96;b.vz*=.96;b.grounded=true;
    horizontalMove(b,b.vx*DT,b.vz*DT,solidsFor(s,b.x,b.z,5,b.id),.95,2,.5,s);b.y=supportFor(s,b.x,b.z,b.y+.5,.85,b.id);
    if(!s.expedition?.active&&(distance(b,BLOCK_SPAWN)>24 || b.y<WORLD.waterLevel)){Object.assign(b,BLOCK_SPAWN);toast(s,'멀어진 돌이 제자리로 돌아왔습니다.');}
  }
  if(!s.expedition?.active&&!s.progress.sigils.includes('quarry')){
    const b=s.blocks[0];if(distance(b,PLATE)<PLATE.radius && Math.hypot(b.vx,b.vz)<3){s.puzzle.plateCharge+=DT;if(s.puzzle.plateCharge>1.2)awardSigil(s,'quarry');}
    else s.puzzle.plateCharge=Math.max(0,s.puzzle.plateCharge-DT*.6);
  }
}
function shoot(s,e,count=1,options={}){
  const p=s.player;
  for(let i=0;i<count;i++){
    const a=Math.atan2(p.x-e.x,p.z-e.z)+(i-(count-1)/2)*(options.spread??.18),speed=options.speed??(e.type==='boss'?12:9);
    const d=Math.max(1,distance(p,e));s.projectiles.push({id:`bolt-${s.nextId++}`,type:options.kind||'bolt',team:'enemy',slow:options.slow||0,x:e.x,y:e.y+1.3,z:e.z,vx:Math.sin(a)*speed,vz:Math.cos(a)*speed,vy:(p.y+.8-e.y-1.3)/d*speed,life:4,damage:options.damage??ENEMY_STATS[e.type].damage,owner:e.id});
  }
  if(s.projectiles.length>60)s.projectiles.splice(0,s.projectiles.length-60);emit(s,'enemy-attack',undefined,e);
}
function enemyAttack(s,e){
  const p=s.player,d=distance(p,e),dy=Math.abs(p.y-e.y);
  if(e.type==='ranger'||e.pattern==='bolt'){shoot(s,e,e.type==='boss'?3:1);e.state='recover';e.timer=e.type==='boss'?1.25:1.0;return;}
  if(e.pattern==='charge'){
    e.state='attack';e.timer=.55;e.vx=Math.sin(e.yaw)*15;e.vz=Math.cos(e.yaw)*15;e.didHit=false;return;
  }
  const radius=e.type==='boss'?(e.pattern==='ring'?9:5.1):2.9;
  fx(s,'shockwave',e,{life:.65,power:radius,pattern:e.pattern});emit(s,'enemy-attack',undefined,e);
  // The ring passes below a jumping player. Slam must be dodged or outranged.
  const avoidByJump=e.pattern==='ring'&&p.y-e.y>1.0;
  if(d<radius&&dy<(e.type==='boss'?2.5:1.8)&&!avoidByJump&&facing(e,p,e.type==='boss'?Math.PI:1.3)&&lineClear(e,p,s))playerDamage(s,ENEMY_STATS[e.type].damage,e);
  if(e.state!=='hit'){e.state='recover';e.timer=e.type==='boss'?1.6:.8;}
}
function updateEnemy(s,e){
  if(e.raid)return;
  if(updateExpandedEnemy(s,e,DT,combatHooks(s)))return;
  const p=s.player;e.hitFlash=Math.max(0,e.hitFlash-DT);e.timer-=DT;
  if(e.hp<=0){e.state='dead';return;}
  const d=distance(e,p),dy=Math.abs(e.y-p.y),boss=e.type==='boss';
  if(boss && (s.progress.sigils.length<3||p.y<23)){e.state='idle';return;}
  if(boss&&e.hp<e.maxHp*.5&&e.phase===1){e.phase=2;toast(s,'수호자 격노 · 원형 파동은 점프로, 내려찍기는 회피로!');fx(s,'pulse',e,{life:1,power:9});}
  if(e.state==='hit'){
    horizontalMove(e,e.vx*DT,e.vz*DT,solidsFor(s,e.x,e.z),.55,1.7,.5,s);e.vx*=.84;e.vz*=.84;
    if(e.timer<=0){e.state='chase';e.timer=.2;}
  }else if(e.state==='telegraph'){
    if(e.timer>.28)e.yaw=Math.atan2(p.x-e.x,p.z-e.z);
    if(e.timer<=0)enemyAttack(s,e);
  }else if(e.state==='attack'){
    horizontalMove(e,e.vx*DT,e.vz*DT,solidsFor(s,e.x,e.z),.6,1.8,.5,s);
    if(!e.didHit&&distance(e,p)<2.4&&dy<1.8&&lineClear(e,p,s)){e.didHit=true;playerDamage(s,ENEMY_STATS[e.type].damage,e);}
    if(e.timer<=0&&e.state!=='hit'){e.state='recover';e.timer=1.25;}
  }else if(e.state==='recover'){
    if(e.timer<=0)e.state='chase';
  }else{
    const aggro=boss?40:17;
    if(d<aggro&&dy<(boss?10:5)&&distance(e,{x:e.homeX,z:e.homeZ})<30){
      e.state='chase';e.yaw=Math.atan2(p.x-e.x,p.z-e.z);
      const range=e.type==='ranger'?12:e.type==='charger'?8:boss?8:2.5;
      if(d<range&&dy<2.4){
        e.state='telegraph';e.attackCount++;
        e.pattern=e.type==='charger'?'charge':e.type==='ranger'?'bolt':boss?(['slam','ring',...(e.phase===2?['bolt','ring']:[])][(e.attackCount-1)%(e.phase===2?4:2)]):'slam';
        e.timer=boss?(e.phase===2?.85:1.1):e.type==='charger'?.9:.7;
      }else{
        const speed=ENEMY_STATS[e.type].speed*(boss&&e.phase===2?1.3:1);
        horizontalMove(e,Math.sin(e.yaw)*speed*DT,Math.cos(e.yaw)*speed*DT,solidsFor(s,e.x,e.z),.5,1.65,.4,s);
      }
    }else{
      e.state='idle';const homeD=Math.hypot(e.x-e.homeX,e.z-e.homeZ);
      if(homeD>1){e.yaw=Math.atan2(e.homeX-e.x,e.homeZ-e.z);horizontalMove(e,Math.sin(e.yaw)*2*DT,Math.cos(e.yaw)*2*DT,solidsFor(s,e.x,e.z),.5,1.65,.4,s);}
    }
  }
  // Enemies obey support surfaces as well; the boss cannot walk off its arena.
  if(boss){e.x=clamp(e.x,-12.8,12.8);e.z=clamp(e.z,17,41);e.y=28;}
  else{e.vy-=25*DT;verticalMove(e,DT,solidsFor(s,e.x,e.z),s);if(e.y<(s.expedition?.active?-7:WORLD.waterLevel)){e.x=e.homeX;e.z=e.homeZ;e.y=e.homeY;e.vy=0;}}
}
function updateProjectiles(s){
  const p=s.player;
  for(const pr of s.projectiles){
    pr.x+=pr.vx*DT;pr.y+=pr.vy*DT;pr.z+=pr.vz*DT;pr.life-=DT;
    if(pr.y<floorAt(s,pr.x,pr.z)||solidsFor(s,pr.x,pr.z,2).some(b=>overlaps(pr.x,pr.z,b,.1)&&pr.y>b.y&&pr.y<b.y+b.h)){pr.life=0;continue;}
    if(pr.team==='player'){
      const enemy=s.enemies.find(e=>e.hp>0&&distance(pr,e)<(e.type==='boss'?1.4:.8)&&pr.y>e.y-.2&&pr.y<e.y+2.4);
      if(enemy){hitEnemy(s,enemy,pr.damage,'sunbolt',5);pr.life=0;fx(s,'hit',pr,{power:20});}continue;
    }
    if(Math.hypot(pr.x-p.x,pr.z-p.z)<.65&&pr.y>p.y&&pr.y<p.y+1.7){if(playerDamage(s,pr.damage,s.enemies.find(e=>e.id===pr.owner))&&pr.slow)p.slowTimer=Math.max(p.slowTimer,pr.slow);pr.life=0;fx(s,'hit',pr,{power:8});}
  }
  s.projectiles=s.projectiles.filter(pr=>pr.life>0);
}
function recoverFall(s){
  const p=s.player;s.metrics.falls++;p.gliding=false;p.vy=0;p.vx=0;p.vz=0;p.plunge=false;
  // Recovery itself always happens, even if dodge invulnerability is still active.
  p.x=p.safeX;p.y=p.safeY;p.z=p.safeZ;p.grounded=true;
  p.invulnerable=0;playerDamage(s,15,null,true);p.invulnerable=1.3;toast(s,'거센 물살을 피해 마지막 발판으로 돌아왔습니다.');
}
export function stepGame(s,raw={}){
  s.events=[];
  if(s.mode!=='playing')return s;
  const input={moveX:clamp(Number(raw.moveX)||0,-1,1),moveZ:clamp(Number(raw.moveZ)||0,-1,1),cameraYaw:Number.isFinite(raw.cameraYaw)?raw.cameraYaw:0,sprint:!!raw.sprint};
  const pressed={};for(const b of BUTTONS){input[b]=!!raw[b];pressed[b]=input[b]&&!s.previousInput[b];}s.previousInput={...input};
  s.frame++;s.time=s.frame*DT;const p=s.player,mods=modifiers(s);
  p.maxStamina=100+Math.max(0,s.progress.sigils.length-1)*20+mods.stamina;p.maxEnergy=100+mods.energy;
  streamEnemies(s);
  s.toastTime=Math.max(0,s.toastTime-DT);if(!s.toastTime)s.toast='';
  for(const effect of s.effects)effect.age+=DT;s.effects=s.effects.filter(e=>e.age<e.life);
  for(const key of ['invulnerable','skillCooldown','parryCooldown','comboWindow','actionTime','parryTimer','dashTimer','slowTimer'])p[key]=Math.max(0,p[key]-DT);
  if(p.actionTime===0)p.action='idle';
  p.energy=Math.min(p.maxEnergy,p.energy+DT*6);
  if(pressed.heal&&p.flasks>0&&p.hp<p.maxHp){p.flasks--;p.hp=Math.min(p.maxHp,p.hp+45);emit(s,'heal');fx(s,'reward',p,{life:.8,power:2});}
  for(const id of Object.keys(p.abilityCooldowns))p.abilityCooldowns[id]=Math.max(0,p.abilityCooldowns[id]-DT);
  if(pressed.skill)pulse(s);
  if(pressed.skill1)useAbility(s,0);if(pressed.skill2)useAbility(s,1);
  if(pressed.interact)interact(s);
  let mx=input.moveX,mz=input.moveZ;const mag=Math.hypot(mx,mz);if(mag>1){mx/=mag;mz/=mag;}
  const wx=mx*Math.cos(input.cameraYaw)+mz*Math.sin(input.cameraYaw),wz=mz*Math.cos(input.cameraYaw)-mx*Math.sin(input.cameraYaw);
  if(pressed.dodge&&p.stamina>=22&&p.dodgeTimer<=0){
    p.stamina-=22;p.dodgeTimer=.34;p.invulnerable=.25;p.attackTimer=0;p.attackQueued=false;p.action='dodge';p.actionTime=.34;p.gliding=false;
    if(mag>.1)p.yaw=Math.atan2(wx,wz);
    p.vx=Math.sin(p.yaw)*14;p.vz=Math.cos(p.yaw)*14;s.metrics.dodges++;emit(s,'dodge');fx(s,'dodge',p,{life:.35});
  }
  if(pressed.parry&&p.stamina>=10&&p.parryCooldown===0&&p.dodgeTimer<=0){p.stamina-=10;p.parryTimer=.23;p.parryCooldown=.7;p.action='parry';p.actionTime=.3;emit(s,'guard');}
  if(pressed.attack){if(p.attackTimer>0)p.attackQueued=true;else startAttack(s);}
  if(p.attackTimer>0){
    p.attackTimer-=DT;p.attackElapsed+=DT;
    if(!p.attackHit&&p.attackElapsed>[0,.10,.12,.18][p.combo]){
      p.attackHit=true;const base=[0,16,21,38][p.combo]+s.progress.upgrades.power*5+mods.bladeDamage;
      for(const e of s.enemies)if(e.hp>0&&distance(p,e)<(p.combo===3?3.9:3.2)&&Math.abs(p.y-e.y)<1.9&&facing(p,e,p.combo===3?1.8:1.25)&&lineClear(p,e,s))hitEnemy(s,e,base,'sword',p.combo===3?8:3);
    }
    if(p.attackTimer<=0&&p.attackQueued)startAttack(s);
  }
  p.coyote=p.grounded?.12:Math.max(0,p.coyote-DT);p.jumpBuffer=Math.max(0,p.jumpBuffer-DT);
  if(pressed.jump){
    if(!p.grounded&&p.coyote<=0&&s.progress.glider){p.gliding=!p.gliding&&p.stamina>5;p.plunge=false;if(p.gliding){emit(s,'glide');p.vy=Math.min(p.vy,1);}}
    else p.jumpBuffer=.15;
  }
  if(p.jumpBuffer>0&&p.coyote>0){p.vy=10.8;p.grounded=false;p.coyote=0;p.jumpBuffer=0;p.airState='JUMP';p.fallPeak=p.y;s.metrics.jumps++;emit(s,'jump');}
  const sprint=input.sprint&&mag>.1&&p.stamina>1&&p.grounded&&p.attackTimer<=0;
  let speed=p.gliding?8.4:sprint?9:5.8;speed*=mods.speed*(p.slowTimer>0?.6:1);if(p.attackTimer>0)speed*=.45;
  if(p.dashTimer>0){p.vx=Math.sin(p.yaw)*24;p.vz=Math.cos(p.yaw)*24;}
  else if(p.dodgeTimer>0){p.dodgeTimer-=DT;}
  else{
    const accel=p.grounded?38:p.gliding?14:18;
    p.vx+=clamp(wx*speed-p.vx,-accel*DT,accel*DT);p.vz+=clamp(wz*speed-p.vz,-accel*DT,accel*DT);
    if(mag>.08&&p.attackTimer<=0&&p.parryTimer<=0)p.yaw+=angleDelta(Math.atan2(wx,wz),p.yaw)*Math.min(1,DT*17);
  }
  if(sprint)p.stamina=Math.max(0,p.stamina-DT*13);
  else if(p.gliding){p.stamina=Math.max(0,p.stamina-DT*8);if(!p.stamina)p.gliding=false;}
  else if(p.dodgeTimer<=0&&p.parryTimer<=0)p.stamina=Math.min(p.maxStamina,p.stamina+DT*(p.grounded?24:10));
  const px=p.x,pz=p.z;
  horizontalMove(p,p.vx*DT,p.vz*DT,solidsFor(s,p.x,p.z),.37,1.65,.48,s);s.metrics.distance+=Math.hypot(p.x-px,p.z-pz);
  // Physical silhouettes remain distinct; a dodge can pass through an enemy.
  if(p.dodgeTimer<=0)for(const e of s.enemies){
    if(e.hp<=0||Math.abs(e.y-p.y)>1.5)continue;
    const d=distance(e,p),minimum=e.type==='boss'?1.55:1.02;
    if(d>0.001&&d<minimum){const push=Math.min(.2,minimum-d);horizontalMove(p,(p.x-e.x)/d*push,(p.z-e.z)/d*push,solidsFor(s,p.x,p.z),.37,1.65,.48,s);}
  }
  p.vy-=25*DT;
  if(p.gliding&&p.vy< -2.1)p.vy=-2.1;
  if(!s.expedition?.active&&s.progress.sigils.length===3&&Math.hypot(p.x,p.z-5)<4.2&&p.y<34){p.vy=13;p.gliding=false;p.grounded=false;fx(s,'wind',p,{life:.22,power:1});}
  const fallSpeed=p.vy,landed=verticalMove(p,DT,solidsFor(s,p.x,p.z),s);p.fallPeak=Math.max(p.fallPeak,p.y);
  if(landed){
    s.metrics.landings++;p.airState='LAND';p.gliding=false;emit(s,'land');fx(s,'land',p,{life:.4,power:Math.abs(fallSpeed)});
    if(p.plunge){for(const e of s.enemies)if(e.hp>0&&distance(e,p)<5&&Math.abs(e.y-p.y)<2&&lineClear(p,e,s))hitEnemy(s,e,35,'plunge',9);fx(s,'shockwave',p,{life:.65,power:5});p.plunge=false;}
    else if(fallSpeed < -24)playerDamage(s,Math.min(35,Math.floor((-fallSpeed-24)*2)),null,true);
    p.fallPeak=p.y;
  }else p.airState=p.grounded?'GROUND':p.gliding?'GLIDE':p.vy>1?'ASCENDING':p.vy>=-1?'APEX':'FALLING';
  if(p.y<(s.expedition?.active?-7:WORLD.waterLevel-.3))recoverFall(s);
  if(p.grounded&&p.y>(s.expedition?.active?-.1:WORLD.waterLevel+.8)&&!s.blocks.some(b=>overlaps(p.x,p.z,b,.8))){p.safeX=p.x;p.safeY=p.y;p.safeZ=p.z;}
  if(s.mode!=='playing')return s;
  if(!s.expedition?.active&&distance(p,WORLD.spawn)<180)updateBlocks(s);
  for(const e of s.enemies)if(distance(e,p)<130)updateEnemy(s,e);
  updateProjectiles(s);
  if(s.expedition?.active){tickDungeon(s,DT,dungeonHooks(s));s.region=s.expedition.active?.roomId||'dungeon';return s;}
  tickVillage(s,DT,villageHooks(s));
  // Also capture distant kills: village AI can be paused while a projectile resolves.
  captureRaid(s);
  s.enemies=s.enemies.filter(e=>!e.raid||e.hp>0);
  if(s.trial&&s.trial.enemies.length===3&&s.trial.enemies.every(id=>s.adventure.worldDefeated[id])){completeTrial(s,s.trial.id);s.enemies=s.enemies.filter(e=>!e.trialId);s.trial=null;}
  if(s.trial&&distance(p,s.trial)>80){s.enemies=s.enemies.filter(e=>!e.trialId);s.trial=null;}
  for(const item of s.items){item.age+=DT;const d=distance(item,p);if(d<3.2&&Math.abs(item.y-p.y)<3){item.x+=(p.x-item.x)*.15;item.z+=(p.z-item.z)*.15;if(d<.9){p.crystals++;item.collected=true;emit(s,'collect');}}}
  s.items=s.items.filter(i=>!i.collected&&i.age<180).slice(-120);
  const region=regionAt(p.x,p.y,p.z);s.region=region.id;
  if(!s.progress.discovered.includes(region.id)){s.progress.discovered.push(region.id);awardXP(s,20);toast(s,`${region.name} 발견 · ${region.description}`,'discovery');}
  for(const l of LANDMARKS)if(l.kind==='camp'&&distance(l,p)<8&&!s.progress.discovered.includes(l.id)){s.progress.discovered.push(l.id);toast(s,`${l.name} 발견 · 지도에서 빠른 이동 가능`,'discovery');}
  return s;
}
export function respawn(s){
  const save=exportSave(s),next=loadSave(save);Object.assign(s,next);s.player.flasks=Math.max(3,s.player.flasks);s.mode='playing';s.metrics.falls++;toast(s,s.expedition.active?'던전 입구에서 다시 일어납니다. 해결한 장치와 보물은 그대로입니다.':'모닥불에서 다시 시작합니다. 얻은 봉인과 보물은 그대로입니다.','rest');return s;
}
export function fastTravel(s,campId){
  if(s.expedition?.active){toast(s,'던전 입구나 수호자 방의 귀환문으로 나가세요.');return false;}
  const queuedHome=campId==='home'&&s.village.raid.status==='queued';
  if(s.mode!=='playing'||s.village.raid.status==='active'){toast(s,'진행 중인 마을 방어를 먼저 마쳐야 합니다.');return false;}
  const camp=LANDMARKS.find(l=>l.id===campId&&['camp','waypoint','village'].includes(l.kind))||WAYPOINTS.find(l=>l.id===campId);
  const unlocked=s.progress.discovered.includes(campId)||s.adventure.waypoints.includes(campId);
  if(!camp||!unlocked){toast(s,'먼저 해당 웨이포인트를 찾아 점화하세요.');return false;}
  if(!queuedHome&&s.enemies.some(e=>e.hp>0&&distance(e,s.player)<13&&Math.abs(e.y-s.player.y)<5&&e.state!=='idle')){toast(s,'가까운 적에게서 벗어난 뒤 이동하세요.');return false;}
  const p=s.player,x=camp.x,z=camp.z-2,y=heightAt(x,z);
  Object.assign(p,{x,y,z,vx:0,vy:0,vz:0,gliding:false,grounded:true,checkpoint:campId,safeX:x,safeY:y,safeZ:z,attackTimer:0,dodgeTimer:0,dashTimer:0});p.hp=p.maxHp;
  streamEnemies(s,true);toast(s,`${camp.name}에 도착했습니다.`,'travel');return true;
}
export function exportSave(s){
  if(s.expedition?.active){for(const e of s.enemies)if(e.hp<=0&&e.dungeonId)recordDungeonKill(s,e,dungeonHooks(s));}
  else captureRaid(s);
  return {version:3,seed:s.seed,progress:structuredClone(s.progress),adventure:structuredClone(s.adventure),village:structuredClone(s.village),journey:structuredClone(s.journey),expedition:structuredClone(s.expedition),crystals:s.player.crystals,flasks:s.player.flasks,checkpoint:s.player.checkpoint,metrics:{...s.metrics},time:s.time};
}
export function loadSave(data){
  if(!data||![1,2,3].includes(data.version)||!data.progress||!Array.isArray(data.progress.sigils)||!Array.isArray(data.progress.discovered)||!Array.isArray(data.progress.chests)||(data.version>=2&&(!data.adventure||!data.village)))throw new Error('올바른 WINDWAKE 저장 파일이 아닙니다.');
  const s=createGame(data.seed),p=s.player,raw=data.progress;
  s.progress.sigils=[...new Set(raw.sigils.filter(v=>SIGILS.includes(v)))];
  s.progress.discovered=[...new Set(['meadow','camp',...raw.discovered.filter(v=>typeof v==='string'&&v.length<64)])].slice(0,256);
  s.progress.chests=[...new Set(raw.chests.filter(v=>LANDMARKS.some(l=>l.kind==='chest'&&l.id===v)))];
  const number=(v,max)=>Number.isFinite(v)?clamp(Math.floor(v),0,max):0;
  s.progress.upgrades={health:number(raw.upgrades?.health,3),power:number(raw.upgrades?.power,3)};
  s.progress.glider=s.progress.sigils.length>0;s.progress.bossDefeated=raw.bossDefeated===true&&s.progress.sigils.length===3;
  if(data.version>=2){s.adventure=validateAdventure(data.adventure);s.village=validateVillage(data.village);}
  const expedition=data.version===3?validateExpedition(data.expedition):initExpedition();
  s.journey=data.version===3?validateJourney(data.journey,{...s,expedition}):initJourney();
  if(s.village.level<3)s.adventure.finalDefeated=false;
  const mods=modifiers(s);
  p.crystals=number(data.crystals,9999);p.maxHp=100+s.progress.upgrades.health*25;p.hp=p.maxHp;p.maxStamina=100+Math.max(0,s.progress.sigils.length-1)*20+mods.stamina;p.stamina=p.maxStamina;p.maxEnergy=100+mods.energy;p.energy=p.maxEnergy;
  p.flasks=data.version===3&&Number.isFinite(data.flasks)?number(data.flasks,6):3;
  if((LANDMARKS.some(l=>l.kind==='camp'&&l.id===data.checkpoint)&&s.progress.discovered.includes(data.checkpoint))||s.adventure.waypoints.includes(data.checkpoint))p.checkpoint=data.checkpoint;
  const camp=LANDMARKS.find(l=>l.id===p.checkpoint)||WAYPOINTS.find(l=>l.id===p.checkpoint)||LANDMARKS.find(l=>l.id==='camp');
  Object.assign(p,{x:camp.x,y:heightAt(camp.x,camp.z-2),z:camp.z-2,safeX:camp.x,safeY:heightAt(camp.x,camp.z-2),safeZ:camp.z-2});
  if(s.progress.bossDefeated){const boss=s.enemies.find(e=>e.type==='boss');boss.hp=0;boss.state='dead';boss.rewarded=true;}
  for(const key of Object.keys(s.metrics))s.metrics[key]=Number.isFinite(data.metrics?.[key])?clamp(data.metrics[key],0,1e8):0;
  s.frame=number(data.time?data.time*60:0,21600000);s.time=s.frame*DT;
  restoreRaid(s,villageHooks(s));streamEnemies(s,true);
  // Build the outdoor state first; entering an instance must park a real world.
  s.expedition=expedition;
  if(expedition.active){
    const dungeon=DUNGEONS.find(d=>d.id===expedition.active.id);
    if(dungeon){transitionScene(s,'enter',dungeon.entry);tickDungeon(s,DT,dungeonHooks(s));}
  }
  return s;
}
function resetMotion(p,spawn){
  const {x,y,z}=spawn;
  Object.assign(p,{x,y,z,safeX:x,safeY:y,safeZ:z,vx:0,vy:0,vz:0,grounded:true,airState:'GROUND',gliding:false,plunge:false,action:'idle',actionTime:0,attackTimer:0,attackElapsed:0,attackQueued:false,comboWindow:0,combo:0,dodgeTimer:0,dashTimer:0,parryTimer:0,coyote:.12,jumpBuffer:0,fallPeak:y,yaw:spawn.yaw||0});
}
function transitionScene(s,kind,spawn){
  if(kind==='enter'){
    captureRaid(s);
    s.fieldState={enemies:s.enemies,blocks:s.blocks,items:s.items,trial:s.trial,streamCell:s.streamCell};
    s.enemies=[];s.items=[];s.blocks=s.expedition.active.blocks;s.trial=null;s.streamCell=null;
  }else{
    const field=s.fieldState;
    s.enemies=field?.enemies||[];s.blocks=field?.blocks||[{...BLOCK_SPAWN}];s.items=field?.items||[];s.trial=field?.trial||null;s.streamCell=null;
    delete s.fieldState;spawn={...spawn,y:heightAt(spawn.x,spawn.z)};
  }
  s.projectiles=[];s.effects=[];delete s.buildPreview;delete s.activeTown;
  resetMotion(s.player,spawn);s.previousInput={interact:true};
  if(kind==='leave')streamEnemies(s,true);
  emit(s,kind==='enter'?'dungeon-enter':'dungeon-leave');
}
function dungeonHooks(s){return {
  transition:(kind,spawn)=>transitionScene(s,kind,spawn),
  spawn:(type,x,z,extra)=>spawnEnemy(s,type,x,z,extra.y,extra),
  move:(b,dx,dz,r=.8)=>horizontalMove(b,dx,dz,solidsFor(s,b.x,b.z,5,b.id),r,b.h||2,.48,s),
  ground:(b,dt)=>{b.vy=(b.vy||0)-25*dt;verticalMove(b,dt,solidsFor(s,b.x,b.z,5,b.id),s);},
  rewardXP:n=>awardXP(s,n),grantRelic:id=>grantRelic(s,id),
  rewardMaterials:reward=>{for(const key of ['wood','stone','food'])s.village.materials[key]=Math.min(99999,s.village.materials[key]+(reward[key]||0));s.player.crystals=Math.min(9999,s.player.crystals+(reward.crystals||0));},
  effect:(type,at,extra)=>fx(s,type,at,extra),toast:text=>toast(s,text,'reward'),
};}
export function enterExpedition(s,id){return enterDungeon(s,id,dungeonHooks(s));}
export function exitExpedition(s){return leaveDungeon(s,dungeonHooks(s));}
export function expeditionAction(s,action,payload={}){return dungeonAction(s,action,payload,dungeonHooks(s));}
function payoutMaterials(s,n){s.village.materials.wood+=n;s.village.materials.stone+=Math.ceil(n*.65);}
function completeTrial(s,id){if(s.adventure.completedTasks.includes(id))return;s.adventure.completedTasks.push(id);awardXP(s,65);payoutMaterials(s,6);s.player.crystals+=5;toast(s,'탐험의 시련 완료 · 기술 경험치 65, 결정 5, 마을 재료 획득','reward');fx(s,'reward',s.player,{life:1.3,power:5});}
function combatHooks(s){return {
  move:(e,dx,dz,r=.5)=>horizontalMove(e,dx,dz,solidsFor(s,e.x,e.z),r,1.65,.48,s),
  ground:(e,dt)=>{e.vy=(e.vy||0)-25*dt;verticalMove(e,dt,solidsFor(s,e.x,e.z),s);if(e.y<(s.expedition?.active?-7:WORLD.waterLevel)){e.x=e.homeX;e.z=e.homeZ;e.y=e.homeY;e.vy=0;}},
  lineClear:(a,b)=>lineClear(a,b,s),damagePlayer:(amount,e,u)=>playerDamage(s,amount,e,u),hitEnemy:(e,n,k,knock)=>hitEnemy(s,e,n,k,knock),
  shoot:(e,n,options)=>shoot(s,e,n,options),spawn:(type,x,z,extra)=>spawnEnemy(s,type,x,z,undefined,{...(s.expedition?.active?{dungeonId:s.expedition.active.id}:{frontier:true}),...extra}),
  effect:(type,e,extra)=>fx(s,type,e,extra),emit:(type,e)=>emit(s,type,undefined,e),toast:text=>toast(s,text),random:()=>random(s),
};}
function villageHooks(s){return {
  spawn:(type,x,z,extra)=>spawnEnemy(s,type,x,z,undefined,extra),damageEnemy:(e,n,kind)=>hitEnemy(s,e,n,kind,0),damagePlayer:(n,e)=>playerDamage(s,n,e),
  rewardXP:n=>awardXP(s,n),toast:(text,type)=>toast(s,text,type),solidQuery:(x,z,r)=>solidsFor(s,x,z,r),lineClear:(a,b)=>lineClear(a,b,s),
};}
export function useAbility(s,slot){
  const p=s.player,id=s.adventure.equipped[slot],ability=ACTIVE_SKILLS[id];
  if(s.mode!=='playing'||!ability||!s.adventure.learned.includes(id)||p.energy<ability.energy||(p.abilityCooldowns[id]||0)>0||p.dodgeTimer>0)return false;
  if(id==='bloom'&&p.hp>=p.maxHp){toast(s,'이미 체력이 가득 차 있습니다.');return false;}
  if(id==='quake'&&!p.grounded){toast(s,'대지 울림은 지상에서 사용하세요.');return false;}
  p.energy-=ability.energy;p.abilityCooldowns[id]=ability.cooldown;p.action='pulse';p.actionTime=.35;emit(s,'pulse');
  const mods=modifiers(s);
  if(id==='sunbolt'){
    const aim=target(s,24);if(aim)p.yaw=Math.atan2(aim.x-p.x,aim.z-p.z);
    const speed=24,d=aim?Math.max(1,distance(p,aim)):10;
    s.projectiles.push({id:`sun-${s.nextId++}`,type:'sunbolt',team:'player',x:p.x,y:p.y+1,z:p.z,vx:Math.sin(p.yaw)*speed,vz:Math.cos(p.yaw)*speed,vy:aim?(aim.y-p.y)/d*speed:0,life:2,damage:38+mods.bladeDamage,owner:'player'});
    fx(s,'slash',p,{life:.3,power:3,combo:3});
  }else if(id==='winddash'){
    p.dashTimer=.32;p.invulnerable=Math.max(p.invulnerable,.27);p.attackTimer=0;fx(s,'dodge',p,{life:.45,power:4});
  }else if(id==='bloom'){
    p.hp=Math.min(p.maxHp,p.hp+45);fx(s,'reward',p,{life:1,power:4});emit(s,'heal');
  }else if(id==='quake'){
    for(const e of s.enemies)if(e.hp>0&&distance(p,e)<6.5&&Math.abs(p.y-e.y)<2.5&&lineClear(p,e,s))hitEnemy(s,e,48+mods.bladeDamage,'pulse',11);
    fx(s,'shockwave',p,{life:.8,power:6.5});
  }
  return true;
}
function streamEnemies(s,force=false){
  if(s.expedition?.active)return;
  const p=s.player,cell=`${Math.floor(p.x/30)}:${Math.floor(p.z/30)}`;
  if(!force&&cell===s.streamCell&&s.frame%90!==0)return;s.streamCell=cell;
  s.enemies=s.enemies.filter(e=>!e.frontier||e.raid||e.trialId||distance(e,p)<145);
  const original=new Set(ENEMY_SPAWNS.map(e=>e.id));
  for(const spec of spawnsNear(p.x,p.z,110)){
    if(original.has(spec.id)||s.enemies.some(e=>e.id===spec.id)||s.adventure.worldDefeated[spec.id])continue;
    const site=BOSS_SITES.find(b=>b.id===spec.id);
    if(site&&(s.adventure.bosses.includes(site.id)||(site.final&&(s.adventure.bosses.filter(id=>id!=='boss-frontier').length<4||s.village.level<3))))continue;
    const extra={...spec,frontier:true};
    if(site){Object.assign(extra,{bossId:site.id,family:site.family,name:site.name,final:!!site.final,level:site.level,hp:site.final?1250:480+(site.level||1)*45,maxHp:site.final?1250:480+(site.level||1)*45});}
    spawnEnemy(s,spec.type,spec.x,spec.z,spec.y,extra);
  }
}
