import {VILLAGE,RESOURCE_NODES,heightAt,querySolids} from './world.mjs';
import {awardXP,modifiers} from './progression.mjs';

export const DAY_SECONDS=600;
export const DUSK_SECONDS=450;
const crop=(id,name,growthSeconds,food,colorToken)=>Object.freeze({id,name,growthSeconds,food,seedYield:1,colorToken});
export const CROPS=Object.freeze({
  turnip:crop('turnip','순무',45,3,'cropRipe'),wheat:crop('wheat','밀',75,5,'gold'),
  pumpkin:crop('pumpkin','호박',110,8,'autumn'),moonflower:crop('moonflower','달꽃',140,11,'lavender'),
});
const building=(id,name,description,cost,hp,level,w,d,h,solid)=>Object.freeze({id,name,description,cost,hp,level,w,d,h,solid});
export const BUILDINGS=Object.freeze({
  plot:building('plot','텃밭','씨앗을 심고 물을 주어 식량을 기릅니다.',{wood:4},60,1,3,3,.18,false),
  cottage:building('cottage','작은 집','첫 수확을 마치면 마을의 밤 방어가 시작됩니다.',{wood:12,stone:4},180,1,3.2,3.2,3.8,true),
  well:building('well','우물','우물 곁에서 쉬면 회복약을 넉넉하게 보충합니다.',{wood:3,stone:8},140,1,1.8,1.8,1.2,true),
  granary:building('granary','곡물 창고','텃밭 수확 식량이 2개 늘어납니다.',{wood:14,stone:8},190,2,3.2,3.2,3,true),
  tower:building('tower','바람 방어탑','접근하는 습격자를 자동으로 공격합니다.',{wood:10,stone:8},160,1,1.8,1.8,4.6,true),
  fence:building('fence','나무 울타리','습격자를 막고 공격을 대신 받습니다.',{wood:3,stone:1},110,1,3.6,.6,1.6,true),
  flowers:building('flowers','꽃밭','여행 끝에 반기는 작은 꽃밭입니다.',{wood:1,food:1},35,1,2,2,.5,false),
  lantern:building('lantern','길잡이 등불','밤에도 마을 길을 환하게 비춥니다.',{wood:2,stone:2},65,1,.5,.5,2.5,false),
});
const MATERIALS=['wood','stone','food'];
const DIRECTIONS={north:'북쪽',east:'동쪽',south:'남쪽',west:'서쪽'};
const TASKS=['gather','build','plant','water','harvest','defend'];
const RAID_TYPES=['stalker','wolf','charger','slime'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const number=(n,min=0,max=99999,fallback=min)=>Number.isFinite(n)?clamp(n,min,max):fallback;
const integer=(n,max=99999)=>Math.floor(number(n,0,max));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const has=(obj,key)=>typeof key==='string' && Object.hasOwn(obj,key);
const home=()=>({x:VILLAGE.x,y:heightAt(VILLAGE.x,VILLAGE.z),z:VILLAGE.z});
const fail=reason=>({ok:false,reason});
const emptyRaid=()=>({status:'idle',day:0,wave:0,waves:2,spawned:false,timer:0,elapsed:0,direction:'north',rewarded:false,enemies:[],defeated:[]});
function event(s,type,text,at=s.player){
  if(!Array.isArray(s.events))s.events=[];
  s.events.push({type,text,x:at?.x??VILLAGE.x,y:at?.y??heightAt(VILLAGE.x,VILLAGE.z),z:at?.z??VILLAGE.z});
  if(s.events.length>100)s.events.splice(0,s.events.length-100);
}
function notice(s,text,hooks={}){if(hooks.toast)hooks.toast(text,'notice');else event(s,'notice',text);}
function task(s,id,hooks={}){
  if(s.village.tasks.includes(id))return;
  s.village.tasks.push(id);
  if(hooks.rewardXP)hooks.rewardXP(15);else awardXP(s,15);
}
function canReach(s,target,range=4.5){
  return Number.isFinite(s.player?.x) && Number.isFinite(s.player?.z) && Number.isFinite(s.player?.y)
    && dist(s.player,target)<=range && Math.abs(s.player.y-target.y)<=3;
}
const afford=(v,cost)=>MATERIALS.every(id=>v.materials[id]>=(cost[id]||0));
function spend(v,cost){for(const id of MATERIALS)v.materials[id]-=cost[id]||0;}
function gain(v,cost){for(const id of MATERIALS)v.materials[id]=Math.min(99999,v.materials[id]+(cost[id]||0));}
function stage(p){
  if(!p.crop)return 'empty';
  const ratio=p.growth/CROPS[p.crop].growthSeconds;
  return ratio>=1?'ripe':ratio>=.65?'growing':ratio>=.25?'sprout':'seed';
}
function validCell(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  const gx=Math.round((x-VILLAGE.x)/VILLAGE.cellSize),gz=Math.round((z-VILLAGE.z)/VILLAGE.cellSize);
  const cell={x:VILLAGE.x+gx*VILLAGE.cellSize,z:VILLAGE.z+gz*VILLAGE.cellSize};
  const radius=dist(cell,VILLAGE);
  if(radius<5 || radius>VILLAGE.radius-2 || RESOURCE_NODES.some(n=>dist(cell,n)<3))return null;
  cell.y=heightAt(cell.x,cell.z);return cell;
}
export function initVillage(){
  return {clock:90,day:1,elapsed:0,materials:{wood:48,stone:30,food:6},
    seeds:{turnip:4,wheat:2,pumpkin:1,moonflower:1},structures:[],plots:[],level:1,reputation:0,nextId:1,
    beaconHp:180,maxBeaconHp:180,gathered:{},tasks:[],builtTypes:[],raid:emptyRaid()};
}
export function villageSolids(s){
  return (s.village?.structures||[]).filter(b=>b.hp>0 && BUILDINGS[b.type]?.solid).map(b=>{
    const def=BUILDINGS[b.type],rotate=Math.abs(Math.sin(b.facing||0))>.5;
    return {id:b.id,kind:'village',x:b.x,y:b.y,z:b.z,w:rotate?def.d:def.w,d:rotate?def.w:def.d,h:def.h};
  });
}
export function villageAction(s,action,payload={}){
  if(s?.mode!=='playing' || !s.village)return fail('모험 중에 마을을 돌볼 수 있습니다.');
  if(!payload || typeof payload!=='object')return fail('선택한 행동을 확인해 주세요.');
  const v=s.village,p=s.player;
  if(action==='build'){
    if(!has(BUILDINGS,payload.type))return fail('알 수 없는 건물입니다.');
    const def=BUILDINGS[payload.type],cell=validCell(payload.x,payload.z);
    if(!cell)return fail('마을 경계와 집결지·자원 터를 피해 배치해 주세요.');
    if(!canReach(s,cell,12) || dist(p,VILLAGE)>VILLAGE.radius+4)return fail('배치할 곳 가까이 다가가세요.');
    if(v.level<def.level)return fail(`마을 ${def.level}단계에서 열립니다.`);
    if(v.structures.length>=32 || (payload.type==='plot'&&v.plots.length>=16))return fail('마을의 건설 공간이 가득 찼습니다.');
    if(v.structures.some(b=>dist(b,cell)<.1))return fail('이미 건물이 있는 자리입니다.');
    if(payload.facing!==undefined && !Number.isFinite(payload.facing))return fail('건물 방향을 확인해 주세요.');
    const facing=Math.round((payload.facing||0)/(Math.PI/2))*Math.PI/2,rotate=Math.abs(Math.sin(facing))>.5;
    const width=rotate?def.d:def.w,depth=rotate?def.w:def.d;
    if(def.solid && Math.abs(p.x-cell.x)<width/2+.6 && Math.abs(p.z-cell.z)<depth/2+.6)return fail('자신이 서 있는 곳에는 건물을 놓을 수 없습니다.');
    if(!afford(v,def.cost))return fail('목재·돌·식량이 부족합니다. 가까운 자원 터에서 채집하세요.');
    const id=`building-${v.nextId++}`;
    const b={id,type:def.id,...cell,facing:((facing%(Math.PI*2))+Math.PI*2)%(Math.PI*2),hp:def.hp,maxHp:def.hp,cooldown:0};
    spend(v,def.cost);v.structures.push(b);
    if(def.id==='plot')v.plots.push({id,...cell,crop:null,watered:false,growth:0,stage:'empty'});
    if(!v.builtTypes.includes(def.id)){v.builtTypes.push(def.id);v.reputation++;}
    task(s,'build');event(s,'build',`${def.name} 완성`,b);return {ok:true,id,...cell};
  }
  if(action==='gather'){
    const n=RESOURCE_NODES.find(n=>n.id===payload.id);
    if(!n)return fail('알 수 없는 자원 터입니다.');
    if(!canReach(s,n))return fail('자원 터 가까이 다가가세요.');
    if(Object.hasOwn(v.gathered,n.id) && v.elapsed-v.gathered[n.id]<(n.cooldown||90))
      return fail('자원이 다시 자라고 있습니다. 잠시 뒤 돌아오세요.');
    if(!MATERIALS.includes(n.material))return fail('채집할 수 없는 자원입니다.');
    v.gathered[n.id]=v.elapsed;gain(v,{[n.material]:n.amount});task(s,'gather');
    event(s,'gather',`${n.name} · +${n.amount}`,n);return {ok:true,material:n.material,amount:n.amount};
  }
  if(['rest','trade','upgrade'].includes(action) || action==='repair'&&payload.id==='beacon'){
    if(!canReach(s,home(),7))return fail('마을 중앙의 귀환 봉화로 돌아오세요.');
    if(action==='repair'){
      if(v.raid.status==='active')return fail('습격이 끝나면 봉화를 무료로 복구할 수 있습니다.');
      v.beaconHp=v.maxBeaconHp;event(s,'repair','봉화 복구 · 재료 없이 다시 시작합니다.');return {ok:true};
    }
    if(action==='rest'){
      if(v.raid.status==='active' || (s.enemies||[]).some(e=>e.hp>0&&dist(e,p)<13&&e.state!=='idle'))return fail('적이 가까이 있습니다. 방어를 마친 뒤 쉬세요.');
      p.hp=p.maxHp;p.stamina=p.maxStamina;p.energy=p.maxEnergy;
      p.flasks=Math.max(p.flasks||0,v.structures.some(b=>b.type==='well'&&b.hp>0)?5:3);
      if(v.raid.status!=='active')v.beaconHp=v.maxBeaconHp;
      event(s,'rest','귀환 봉화 · 체력과 회복약을 보충했습니다.');return {ok:true};
    }
    if(action==='trade'){
      if(payload.kind==='recovery'){
        if(Object.values(v.seeds).some(n=>n>0)||v.plots.some(plot=>plot.crop))return fail('남아 있는 씨앗이나 작물을 먼저 가꾸어 주세요.');
        v.seeds.turnip=1;event(s,'reward','새 출발의 순무 씨앗을 받았습니다.');return {ok:true};
      }
      if(payload.kind==='seed'){
        if(!has(CROPS,payload.crop))return fail('씨앗 종류를 선택해 주세요.');
        if(v.materials.food<1)return fail('씨앗을 교환하려면 식량 1개가 필요합니다.');
        if(v.seeds[payload.crop]>=9999)return fail('씨앗 주머니가 가득 찼습니다.');
        v.materials.food--;v.seeds[payload.crop]++;event(s,'trade',`${CROPS[payload.crop].name} 씨앗 교환`);return {ok:true};
      }
      if(payload.kind==='food'){
        if(v.materials.food<2)return fail('식량 2개가 필요합니다.');
        if(p.hp>=p.maxHp)return fail('이미 체력이 가득 찼습니다.');
        v.materials.food-=2;p.hp=Math.min(p.maxHp,p.hp+35);event(s,'heal','따뜻한 식사 · 체력 회복');return {ok:true};
      }
      return fail('교환할 물품을 선택해 주세요.');
    }
    if(v.level>=3)return fail('마을이 최고 단계에 도달했습니다.');
    const cost=v.level===1?{wood:12,stone:8,food:4}:{wood:20,stone:14,food:8},rep=v.level===1?6:16;
    if(v.reputation<rep)return fail(`마을 평판 ${rep}이 필요합니다. 수확과 건설·방어를 이어가세요.`);
    if(!afford(v,cost))return fail('마을 확장에 필요한 재료가 부족합니다.');
    spend(v,cost);v.level++;event(s,'reward',`마을 ${v.level}단계 달성`);return {ok:true,level:v.level};
  }
  if(!['remove','repair','plant','water','harvest'].includes(action))return fail('알 수 없는 마을 행동입니다.');
  const b=v.structures.find(b=>b.id===payload.id);
  if(!b)return fail('선택한 건물이 없습니다.');
  if(!canReach(s,b))return fail('건물이나 텃밭 가까이 다가가세요.');
  const plot=v.plots.find(p=>p.id===b.id),def=BUILDINGS[b.type];
  if(action==='remove'){
    if(v.raid.status==='active')return fail('습격 중에는 건물을 철거할 수 없습니다.');
    gain(v,Object.fromEntries(MATERIALS.map(id=>[id,Math.floor((def.cost[id]||0)/2)])));
    if(plot?.crop)v.seeds[plot.crop]=Math.min(9999,v.seeds[plot.crop]+1);
    v.structures=v.structures.filter(item=>item.id!==b.id);v.plots=v.plots.filter(item=>item.id!==b.id);
    event(s,'build',`${def.name} 철거 · 재료 일부와 심은 씨앗 반환`,b);return {ok:true};
  }
  if(action==='repair'){
    if(b.hp>=b.maxHp)return fail('이미 튼튼한 건물입니다.');
    if(!afford(v,{wood:2,stone:1}))return fail('수리에 목재 2개와 돌 1개가 필요합니다.');
    spend(v,{wood:2,stone:1});b.hp=b.maxHp;event(s,'repair',`${def.name} 수리`,b);return {ok:true};
  }
  if(!plot)return fail('텃밭을 선택해 주세요.');
  if(b.hp<=0)return fail('텃밭을 먼저 수리해 주세요. 작물은 그대로 남아 있습니다.');
  if(action==='plant'){
    if(plot.crop)return fail('이미 자라는 작물이 있습니다.');
    if(!has(CROPS,payload.crop))return fail('심을 씨앗을 선택해 주세요.');
    if(v.seeds[payload.crop]<=0)return fail('씨앗이 없습니다. 봉화에서 식량과 교환하세요.');
    v.seeds[payload.crop]--;Object.assign(plot,{crop:payload.crop,watered:false,growth:0,stage:'seed'});
    task(s,'plant');event(s,'plant',`${CROPS[payload.crop].name} 심기 · 물을 주세요.`,plot);return {ok:true};
  }
  if(action==='water'){
    if(!plot.crop)return fail('씨앗을 먼저 심어 주세요.');
    if(plot.watered)return fail('이미 물을 준 작물입니다.');
    plot.watered=true;task(s,'water');event(s,'water','물을 주었습니다. 모험하는 동안 자랍니다.',plot);return {ok:true};
  }
  if(!plot.crop || plot.growth<CROPS[plot.crop].growthSeconds)return fail('아직 수확할 때가 아닙니다.');
  const defCrop=CROPS[plot.crop],bonus=v.structures.some(b=>b.type==='granary'&&b.hp>0)?2:0;
  const food=Math.floor(defCrop.food*modifiers(s).harvest)+bonus;
  gain(v,{food});v.seeds[plot.crop]=Math.min(9999,v.seeds[plot.crop]+1);v.reputation=Math.min(99999,v.reputation+2);
  Object.assign(plot,{crop:null,watered:false,growth:0,stage:'empty'});task(s,'harvest');
  event(s,'harvest',`${defCrop.name} 수확 · 식량 ${food}개와 씨앗 1개`,plot);return {ok:true,food,crop:defCrop.id};
}
export function villageInteraction(s){
  if(!s?.village || s.mode!=='playing')return null;
  const v=s.village,candidates=[];
  const add=(target,kind,name,description,action,payload,range=4.5)=>{
    if(canReach(s,target,range))candidates.push({...target,kind,name,description,action,payload,d:dist(s.player,target)});
  };
  for(const plot of v.plots){
    const b=v.structures.find(b=>b.id===plot.id);if(!b||b.hp<=0)continue;
    if(plot.stage==='ripe')add(plot,'crop',`${CROPS[plot.crop].name} 수확`,'익은 작물을 거두어 식량과 씨앗 얻기','harvest',{id:plot.id});
    else if(plot.crop && !plot.watered)add(plot,'crop','작물 물주기','물은 무료이며 한 번이면 충분합니다.','water',{id:plot.id});
    else if(!plot.crop){const crop=Object.keys(CROPS).find(id=>v.seeds[id]>0);if(crop)add(plot,'crop',`${CROPS[crop].name} 심기`,'씨앗을 심고 물을 주세요.','plant',{id:plot.id,crop});}
  }
  for(const n of RESOURCE_NODES)if(!Object.hasOwn(v.gathered,n.id)||v.elapsed-v.gathered[n.id]>=(n.cooldown||90))
    add(n,'resource',n.name,`${n.description||'재료를 채집합니다.'} · +${n.amount}`,'gather',{id:n.id});
  const beacon={id:'home',...home()};
  if(v.beaconHp<v.maxBeaconHp && v.raid.status!=='active')add(beacon,'village','봉화 무료 복구','재료 없이 봉화를 다시 밝힙니다.','repair',{id:'beacon'},7);
  else if(!Object.values(v.seeds).some(n=>n>0)&&!v.plots.some(p=>p.crop))add(beacon,'village','새 출발의 씨앗','순무 씨앗 한 개를 무료로 받습니다.','trade',{kind:'recovery'},7);
  else add(beacon,'village','귀환 봉화','휴식 · 마을 메뉴에서 건설과 확장','rest',{},7);
  candidates.sort((a,b)=>a.d-b.d);return candidates[0]||null;
}
export function villageObjective(s){
  const v=s.village;if(!v)return '남쪽 마을의 귀환 봉화를 찾아보세요.';
  if(v.raid.status==='queued')return `${DIRECTIONS[v.raid.direction]} 습격 예고 · 귀환하면 방어가 시작됩니다.`;
  if(v.raid.status==='active')return `마을 방어 ${v.raid.wave}/${v.raid.waves} · 봉화 ${Math.ceil(v.beaconHp)} / ${v.maxBeaconHp}`;
  if(v.beaconHp<v.maxBeaconHp)return '중앙 봉화에서 무료로 복구하고 마을을 수리하세요.';
  if(!v.tasks.includes('gather'))return '마을 주변 나무·돌·열매 터에서 E로 채집하세요.';
  if(!v.structures.some(b=>b.type==='plot'))return '마을 메뉴에서 빈 셀에 텃밭을 놓으세요. 목재 4개가 필요합니다.';
  if(!v.tasks.includes('plant'))return '텃밭 곁에서 E로 씨앗을 심으세요.';
  if(v.plots.some(p=>p.crop&&!p.watered))return '씨앗을 심은 텃밭 곁에서 E로 무료 물주기를 하세요.';
  if(!v.tasks.includes('harvest'))return '순무는 물을 준 뒤 45초 후 수확할 수 있습니다.';
  if(!v.structures.some(b=>b.type==='cottage'))return '작은 집을 지어 마을을 세우세요. 첫 수확 뒤부터 해질녘 습격이 옵니다.';
  if(!v.structures.some(b=>b.type==='tower'))return '방어탑과 울타리를 지어 해질녘 방어를 준비하세요.';
  if(v.level<3)return `수확·건설·방어로 평판을 모아 마을을 확장하세요. 현재 평판 ${v.reputation}`;
  return '마을이 번영합니다. 네 지역의 수호자를 이기고 북쪽 변경으로 향하세요.';
}

const waveCount=wave=>wave===1?3:4;
const raidId=(day,wave,index)=>`raid-${day}-${wave}-${index}`;
const recordKeys=['id','type','x','y','z','yaw','hp','maxHp','state','timer','attackCount','raid','raidDay','raidWave','raidIndex','raidTarget'];
function recordEnemy(e){return Object.fromEntries(recordKeys.map(key=>[key,e[key]]));}
export function captureRaid(s){
  const raid=s.village?.raid;if(!raid)return [];
  if(raid.status!=='active')return raid.enemies;
  // Missing actors may be waiting for an entity slot or restore. Absence is never death.
  const updated=[];
  for(const saved of raid.enemies){
    const e=(s.enemies||[]).find(e=>e.id===saved.id);
    if(e && e.hp<=0){if(!raid.defeated.includes(saved.id))raid.defeated.push(saved.id);}
    else updated.push(e?recordEnemy(e):saved);
  }
  raid.enemies=updated;return updated;
}
export function restoreRaid(s,hooks={}){
  const raid=s.village?.raid;if(!raid || raid.status!=='active')return 0;
  let count=0;
  for(const saved of raid.enemies){
    if((s.enemies||[]).some(e=>e.id===saved.id))continue;
    const e=hooks.spawn?.(saved.type,saved.x,saved.z,{...saved});
    if(e){Object.assign(e,saved,{raid:true});count++;}
  }
  return count;
}
export function failRaid(s,hooks={}){
  const v=s.village,raid=v?.raid;if(!raid || !['queued','active'].includes(raid.status))return false;
  raid.status='lost';raid.enemies=[];raid.rewarded=false;raid.spawned=false;
  if(Array.isArray(s.enemies))s.enemies=s.enemies.filter(e=>!e.raid);
  notice(s,'방어를 마쳤습니다. 봉화는 무료로 복구할 수 있고, 작물과 성장 기록은 남습니다.',hooks);return true;
}
function prepareWave(s,hooks){
  const v=s.village,r=v.raid;r.spawned=true;r.defeated=[];r.enemies=[];
  const angle={north:0,east:Math.PI/2,south:Math.PI,west:-Math.PI/2}[r.direction];
  for(let i=0;i<waveCount(r.wave);i++){
    const spread=(i-(waveCount(r.wave)-1)/2)*3.8;
    const x=VILLAGE.x+Math.sin(angle)*35+Math.cos(angle)*spread,z=VILLAGE.z+Math.cos(angle)*35-Math.sin(angle)*spread;
    const hp=42+Math.min(30,(r.day-1)*4)+(r.wave===2?12:0);
    r.enemies.push({id:raidId(r.day,r.wave,i),type:RAID_TYPES[(i+r.wave-1)%RAID_TYPES.length],x,y:heightAt(x,z),z,yaw:angle+Math.PI,
      hp,maxHp:hp,state:'chase',timer:0,attackCount:0,raid:true,raidDay:r.day,raidWave:r.wave,raidIndex:i});
  }
  restoreRaid(s,hooks);notice(s,`마을 방어 · ${r.wave}/${r.waves}번째 물결`,hooks);
}
function hitStructure(s,target,amount){
  if(target.id==='beacon')s.village.beaconHp=Math.max(0,s.village.beaconHp-amount);
  else target.hp=Math.max(0,target.hp-amount);
}
// Slab intersection for actual 3D segments. Horizontal expansion and lower padding
// also allow the same geometry to sweep a standing raider's body through a move.
function segmentEntry(a,b,box,expand=0,lower=0){
  const min=[box.x-box.w/2-expand,box.y-lower,box.z-box.d/2-expand];
  const max=[box.x+box.w/2+expand,box.y+box.h,box.z+box.d/2+expand];
  const start=[a.x,a.y,a.z],end=[b.x,b.y,b.z];let near=0,far=1;
  for(let axis=0;axis<3;axis++){
    const delta=end[axis]-start[axis];
    if(Math.abs(delta)<1e-9){if(start[axis]<min[axis]||start[axis]>max[axis])return null;}
    else{
      let t0=(min[axis]-start[axis])/delta,t1=(max[axis]-start[axis])/delta;
      if(t0>t1)[t0,t1]=[t1,t0];near=Math.max(near,t0);far=Math.min(far,t1);
      if(near>far)return null;
    }
  }
  return far>1e-6&&near<1-1e-6?near:null;
}
function raidSolids(s,hooks,a,b=a,padding=3){
  const x=(a.x+b.x)/2,z=(a.z+b.z)/2,radius=dist(a,b)/2+padding;
  const supplied=hooks.solidQuery?hooks.solidQuery(x,z,radius):querySolids(x,z,radius);
  const seen=new Set();
  return [...(Array.isArray(supplied)?supplied:[]),...villageSolids(s)].filter(box=>{
    if(box.id&&seen.has(box.id))return false;if(box.id)seen.add(box.id);return true;
  });
}
function clearRaidSight(s,a,b,hooks,ignoredId=null){
  // Hooks use actor feet as input and lift both ends by .95m, like the core sim.
  // A structure target contains its own endpoint, so test its approach ourselves.
  if(!ignoredId&&hooks.lineClear&&!hooks.lineClear(a,b))return false;
  const from={...a,y:a.y+.95},to={...b,y:b.y+.95};
  return !raidSolids(s,hooks,a,b).some(box=>box.id!==ignoredId&&segmentEntry(from,to,box)!==null);
}
function selectRaidTarget(s,e){
  const p=s.player,beacon={id:'beacon',...home()};
  const intended=dist(e,p)<4.5&&Math.abs(e.y-p.y)<2.6?p:beacon;
  const from={...e,y:e.y+.95},to={...intended,y:intended.y+.95};
  const blocker=villageSolids(s).map(box=>({box,t:segmentEntry(from,to,box)}))
    .filter(hit=>hit.t!==null).sort((a,b)=>a.t-b.t)[0];
  return blocker?s.village.structures.find(b=>b.id===blocker.box.id):intended;
}
function lockedRaidTarget(s,e){
  if(e.raidTarget==='player')return s.player;
  if(e.raidTarget==='beacon')return {id:'beacon',...home()};
  return s.village.structures.find(b=>b.id===e.raidTarget&&b.hp>0)||null;
}
function moveRaidActor(s,e,dx,dz,hooks){
  const end={x:e.x+dx,z:e.z+dz,y:heightAt(e.x+dx,e.z+dz)};
  if(Math.abs(end.y-e.y)>.5)return false;
  const from={x:e.x,y:e.y+.03,z:e.z},to={...end,y:end.y+.03};
  if(raidSolids(s,hooks,e,end).some(box=>segmentEntry(from,to,box,.45,1.55)!==null))return false;
  Object.assign(e,end);return true;
}
function updateRaidActor(s,e,dt,hooks){
  const p=s.player;
  e.timer=Math.max(0,(e.timer||0)-dt);e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);
  if(e.state==='hit' && e.timer>0)return;
  if(e.state==='telegraph'){
    // Old saves without a target can adopt one once; a windup never tracks a dodge.
    if(!e.raidTarget){const selected=selectRaidTarget(s,e);e.raidTarget=selected===p?'player':selected.id;}
    const target=lockedRaidTarget(s,e);
    if(e.timer<=0){
      const yaw=target?Math.atan2(target.x-e.x,target.z-e.z):0;
      const facing=Math.abs(Math.atan2(Math.sin(yaw-e.yaw),Math.cos(yaw-e.yaw)))<1.1;
      if(target&&dist(e,target)<(target===p?3:3.2)&&Math.abs(e.y-target.y)<1.8&&facing
        &&clearRaidSight(s,e,target,hooks,target===p||target.id==='beacon'?null:target.id)){
        const damage=8+Math.min(8,s.village.day);
        if(target===p)hooks.damagePlayer?.(damage,e);else hitStructure(s,target,damage);
        event(s,'enemy-attack',undefined,e);
      }
      e.state='recover';e.timer=.9;e.raidTarget=null;
    }
    return;
  }
  if(e.state==='recover' && e.timer>0)return;
  const target=selectRaidTarget(s,e),d=dist(e,target),range=target===p?2.3:2.5;
  e.yaw=Math.atan2(target.x-e.x,target.z-e.z);
  if(d<range&&Math.abs(e.y-target.y)<1.8){
    e.state='telegraph';e.timer=.9;e.pattern='slam';e.attackCount++;e.raidTarget=target===p?'player':target.id;return;
  }
  e.state='chase';const step=Math.min(d,2.6*dt),dx=Math.sin(e.yaw)*step,dz=Math.cos(e.yaw)*step;
  if(!moveRaidActor(s,e,dx,dz,hooks)){
    const side=e.raidIndex%2?1:-1,sx=Math.cos(e.yaw)*step*side,sz=-Math.sin(e.yaw)*step*side;
    if(!moveRaidActor(s,e,sx,sz,hooks))moveRaidActor(s,e,-sx,-sz,hooks);
  }
}
function towerCanSee(s,tower,target,hooks){
  const dx=target.x-tower.x,dz=target.z-tower.z,d=Math.max(.001,Math.hypot(dx,dz)),nx=dx/d,nz=dz/d;
  // Place the muzzle outside the tower's own box and above its roof. This keeps
  // both core LOS hooks and the pure geometry fallback clear of the shooter.
  const offset=1.05/Math.max(Math.abs(nx),Math.abs(nz),.001);
  const muzzle={x:tower.x+nx*offset,z:tower.z+nz*offset,y:tower.y+BUILDINGS.tower.h+.2-.95};
  return clearRaidSight(s,muzzle,target,hooks);
}
export function tickVillage(s,dt,hooks={}){
  if(s?.mode!=='playing'||!s.village||!Number.isFinite(dt)||dt<=0||dt>1)return;
  const v=s.village,r=v.raid;v.elapsed=Math.min(1e9,v.elapsed+dt);
  for(const p of v.plots)if(p.crop&&p.watered){p.growth=Math.min(CROPS[p.crop].growthSeconds,p.growth+dt);p.stage=stage(p);}
  const unresolved=r.status==='queued'||r.status==='active';
  if(!unresolved){
    v.clock+=dt;
    if(v.clock>=DAY_SECONDS){v.clock-=DAY_SECONDS;v.day++;}
    if(v.clock>=DUSK_SECONDS&&r.day<v.day&&v.beaconHp>0&&v.tasks.includes('harvest')&&v.structures.some(b=>b.type==='cottage'&&b.hp>0)){
      Object.assign(r,emptyRaid(),{status:'queued',day:v.day,timer:10,direction:['north','east','south','west'][(v.day-1)%4]});
      notice(s,`해질녘 경보 · ${DIRECTIONS[r.direction]}! 귀환하면 방어가 시작됩니다. 멀리 있을 때 마을은 안전합니다.`,hooks);
    }
  }
  if(r.status!=='queued'&&r.status!=='active')return;
  if(dist(s.player,VILLAGE)>64)return;
  if(r.status==='queued'){
    r.timer=Math.max(0,r.timer-dt);
    if(r.timer<=0){r.status='active';r.wave=1;prepareWave(s,hooks);}return;
  }
  captureRaid(s);restoreRaid(s,hooks);r.elapsed+=dt;
  if(v.beaconHp<=0||r.elapsed>=180){failRaid(s,hooks);return;}
  if(!r.spawned){r.timer=Math.max(0,r.timer-dt);if(r.timer<=0)prepareWave(s,hooks);return;}
  const actors=(s.enemies||[]).filter(e=>e.raid&&e.raidDay===r.day&&e.raidWave===r.wave&&e.hp>0);
  for(const tower of v.structures.filter(b=>b.type==='tower'&&b.hp>0)){
    tower.cooldown=Math.max(0,tower.cooldown-dt);
    const target=actors.filter(e=>e.hp>0&&dist(e,tower)<22&&towerCanSee(s,tower,e,hooks)).sort((a,b)=>dist(a,tower)-dist(b,tower))[0];
    if(target&&tower.cooldown===0){
      const damage=14*modifiers(s).towerDamage;
      if(hooks.damageEnemy)hooks.damageEnemy(target,damage,'tower');else target.hp=Math.max(0,target.hp-damage);
      tower.cooldown=.9;event(s,'tower',undefined,tower);
      if(Array.isArray(s.effects)){s.effects.push({type:'hit',x:target.x,y:target.y+1,z:target.z,age:0,life:.3,power:damage});if(s.effects.length>100)s.effects.shift();}
    }
  }
  for(const e of actors)if(e.hp>0)updateRaidActor(s,e,dt,hooks);
  captureRaid(s);
  if(v.beaconHp<=0){failRaid(s,hooks);return;}
  if(r.enemies.length===0&&r.defeated.length===waveCount(r.wave)){
    if(r.wave<r.waves){r.wave++;r.spawned=false;r.timer=4;r.defeated=[];notice(s,'물결을 막았습니다. 다음 습격까지 4초 · 수리하고 준비하세요.',hooks);}
    else if(!r.rewarded){
      r.status='won';r.rewarded=true;gain(v,{wood:12,stone:8,food:4});v.reputation=Math.min(99999,v.reputation+6);
      if(hooks.rewardXP)hooks.rewardXP(60);else awardXP(s,60);task(s,'defend',hooks);
      notice(s,'마을을 지켰습니다! 목재 12 · 돌 8 · 식량 4 · 평판 6',hooks);
    }
  }
}

function validateRaid(raw,day){
  const r=emptyRaid();if(!raw||typeof raw!=='object')return r;
  if(!['idle','queued','active','won','lost'].includes(raw.status))return r;
  r.status=raw.status;r.day=integer(raw.day,day);r.wave=integer(raw.wave,2);r.waves=2;
  r.timer=number(raw.timer,0,10);r.elapsed=number(raw.elapsed,0,180);r.spawned=raw.spawned===true;
  r.direction=['north','east','south','west'].includes(raw.direction)?raw.direction:'north';
  r.rewarded=r.status==='won';
  if(r.status==='idle'){return r;}
  if(r.day<1 || r.day!==day && ['queued','active'].includes(r.status)){r.status='lost';r.rewarded=false;return r;}
  if(r.status!=='active'){r.spawned=false;return r;}
  if(r.wave<1){r.status='lost';return r;}
  const allowed=new Set(Array.from({length:waveCount(r.wave)},(_,i)=>raidId(r.day,r.wave,i)));
  r.defeated=Array.isArray(raw.defeated)?[...new Set(raw.defeated.filter(id=>allowed.has(id)))]:[];
  const ids=new Set();
  for(const e of (Array.isArray(raw.enemies)?raw.enemies:[]).slice(0,7)){
    if(!e||!allowed.has(e.id)||ids.has(e.id)||r.defeated.includes(e.id)||!RAID_TYPES.includes(e.type))continue;
    if(!Number.isFinite(e.x)||!Number.isFinite(e.z)||Math.hypot(e.x-VILLAGE.x,e.z-VILLAGE.z)>85||!Number.isFinite(e.hp)||e.hp<=0)continue;
    const index=Number(e.id.split('-').at(-1));ids.add(e.id);
    r.enemies.push({id:e.id,type:e.type,x:e.x,y:heightAt(e.x,e.z),z:e.z,yaw:number(e.yaw,-Math.PI*4,Math.PI*4,0),
      hp:number(e.hp,1,120),maxHp:number(e.maxHp,1,120,60),state:['chase','telegraph','recover','hit'].includes(e.state)?e.state:'chase',
      timer:number(e.timer,0,5),attackCount:integer(e.attackCount,100000),raid:true,raidDay:r.day,raidWave:r.wave,raidIndex:index,
      raidTarget:typeof e.raidTarget==='string'&&(['player','beacon'].includes(e.raidTarget)||/^building-[1-9][0-9]{0,8}$/.test(e.raidTarget))?e.raidTarget:null});
    const saved=r.enemies.at(-1);saved.hp=Math.min(saved.hp,saved.maxHp);
  }
  if(r.spawned && r.enemies.length+r.defeated.length!==waveCount(r.wave) || !r.spawned && (r.enemies.length||r.defeated.length)){
    r.status='lost';r.enemies=[];r.defeated=[];r.spawned=false;r.rewarded=false;
  }
  return r;
}
export function validateVillage(raw){
  const v=initVillage();if(!raw||typeof raw!=='object')return v;
  v.clock=number(raw.clock,0,DAY_SECONDS-.00001,90);v.day=Math.max(1,integer(raw.day,100000));v.elapsed=number(raw.elapsed,0,1e9);
  for(const id of MATERIALS)v.materials[id]=integer(raw.materials?.[id]);
  for(const id of Object.keys(CROPS))v.seeds[id]=integer(raw.seeds?.[id],9999);
  v.level=clamp(integer(raw.level,3),1,3);v.reputation=integer(raw.reputation);
  v.beaconHp=number(raw.beaconHp,0,180,180);v.maxBeaconHp=180;
  v.tasks=Array.isArray(raw.tasks)?[...new Set(raw.tasks.filter(id=>TASKS.includes(id)))]:[];
  v.builtTypes=Array.isArray(raw.builtTypes)?[...new Set(raw.builtTypes.filter(id=>has(BUILDINGS,id)))]:[];
  const ids=new Set(),cells=new Set();
  for(const b of (Array.isArray(raw.structures)?raw.structures:[]).slice(0,128)){
    if(v.structures.length>=32)break;
    if(!b||!has(BUILDINGS,b.type)||typeof b.id!=='string'||!/^building-[1-9][0-9]{0,8}$/.test(b.id)||ids.has(b.id))continue;
    const cell=validCell(b.x,b.z),def=BUILDINGS[b.type];if(!cell||def.level>v.level)continue;
    const key=`${cell.x},${cell.z}`;if(cells.has(key)||b.type==='plot'&&v.plots.length>=16)continue;
    ids.add(b.id);cells.add(key);v.nextId=Math.max(v.nextId,Number(b.id.slice(9))+1);
    const facing=Math.round(number(b.facing,-Math.PI*4,Math.PI*4,0)/(Math.PI/2))*Math.PI/2;
    v.structures.push({id:b.id,type:b.type,...cell,facing,hp:number(b.hp,0,def.hp,def.hp),maxHp:def.hp,cooldown:number(b.cooldown,0,.9)});
    if(b.type==='plot'){
      const saved=(Array.isArray(raw.plots)?raw.plots:[]).slice(0,128).find(p=>p?.id===b.id),cropId=has(CROPS,saved?.crop)?saved.crop:null;
      const p={id:b.id,...cell,crop:cropId,watered:cropId!==null&&saved?.watered===true,growth:0,stage:'empty'};
      p.growth=p.watered?number(saved?.growth,0,CROPS[cropId].growthSeconds):0;p.stage=stage(p);v.plots.push(p);
    }
  }
  for(const n of RESOURCE_NODES)if(Number.isFinite(raw.gathered?.[n.id]))v.gathered[n.id]=number(raw.gathered[n.id],0,v.elapsed);
  v.raid=validateRaid(raw.raid,v.day);
  if(v.raid.status==='active' && v.beaconHp===0){v.raid.status='lost';v.raid.enemies=[];v.raid.spawned=false;}
  return v;
}
