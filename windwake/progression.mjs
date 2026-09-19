import { WAYPOINTS, BOSS_SITES } from './world.mjs';

const node = (id, name, branch, cost, requires, description, effects = {}, active = false) =>
  Object.freeze({ id, name, branch, cost, requires, description, effects, active });

export const SKILLS = Object.freeze([
  node('edge','검의 기초','blade',1,[],'검 공격력 +3',{bladeDamage:3}),
  node('sunbolt','햇살 화살','blade',1,['edge'],'전방으로 빛의 화살을 발사합니다.',{},true),
  node('heavyblade','묵직한 날','blade',2,['edge'],'검 공격력 +5',{bladeDamage:5}),
  node('quake','대지 울림','blade',2,['heavyblade'],'주변 지면에 강한 충격파를 보냅니다.',{},true),
  node('guard','단단한 자세','blade',1,['edge'],'받는 피해 10% 감소',{armor:.10}),
  node('mastery','검의 달인','blade',3,['heavyblade','guard'],'검 공격력 +8',{bladeDamage:8}),
  node('quickstep','가벼운 발걸음','wind',1,[],'이동 속도 +8%',{speed:.08}),
  node('winddash','바람 질주','wind',1,['quickstep'],'바라보는 방향으로 짧게 질주합니다.',{},true),
  node('endurance','긴 숨','wind',1,['quickstep'],'최대 기력 +25',{stamina:25}),
  node('current','순풍','wind',2,['winddash'],'이동 속도 +12%',{speed:.12}),
  node('reservoir','바람 그릇','wind',1,['endurance'],'최대 에너지 +25',{energy:25}),
  node('zephyr','높은 하늘','wind',3,['current','reservoir'],'최대 기력 +35, 에너지 +20',{stamina:35,energy:20}),
  node('gardener','첫 정원','hearth',1,[],'수확 식량 +25%',{harvest:.25}),
  node('bloom','치유의 꽃','hearth',1,['gardener'],'꽃의 온기로 체력을 회복합니다.',{},true),
  node('mason','돌의 온기','hearth',1,['gardener'],'받는 피해 8% 감소',{armor:.08}),
  node('abundance','풍성한 계절','hearth',2,['gardener'],'수확 식량 +40%',{harvest:.40}),
  node('sentry','마을의 눈','hearth',2,['mason'],'방어탑 공격력 +35%',{towerDamage:.35}),
  node('steward','마을 지킴이','hearth',3,['abundance','sentry'],'방어탑 공격력 +40%, 수확 식량 +35%',{towerDamage:.40,harvest:.35}),
]);

export const ACTIVE_SKILLS = Object.freeze(Object.fromEntries([
  ['sunbolt',24,2.8],['winddash',18,3],['bloom',34,12],['quake',40,7],
].map(([id,energy,cooldown]) => [id,Object.freeze({id,name:SKILLS.find(n=>n.id===id).name,
  description:SKILLS.find(n=>n.id===id).description,energy,cooldown})])));

const byId = new Map(SKILLS.map(n=>[n.id,n]));
const bounded = (value,max=1e6) => Number.isFinite(value) ? Math.max(0,Math.min(max,Math.floor(value))) : 0;
const knownList = (value,allowed,max) => Array.isArray(value)
  ? [...new Set(value.filter(id=>typeof id==='string' && allowed.has(id)))].slice(0,max) : [];
export function xpForLevel(level) {
  const n=Math.max(0,Math.min(29,Math.floor(level)-1));
  return 80*n+20*n*(n-1);
}
function levelForXP(xp) {
  let level=1;
  while(level<30 && xp>=xpForLevel(level+1))level++;
  return level;
}
export function initAdventure() {
  return {xp:0,level:1,points:2,learned:[],equipped:[null,null],bosses:[],waypoints:['home'],
    completedTasks:[],worldDefeated:{},chapter:1,finalDefeated:false};
}
export function awardXP(s,amount) {
  if(!s?.adventure || !Number.isFinite(amount) || amount<0)return {ok:false,amount:0,levels:0};
  const a=s.adventure,old=a.level,increment=bounded(amount);
  a.xp=bounded(a.xp+increment);a.level=levelForXP(a.xp);
  a.points=Math.max(0,2+(a.level-1)*2-a.learned.reduce((sum,id)=>sum+(byId.get(id)?.cost||0),0));
  return {ok:true,amount:increment,levels:a.level-old};
}
export function learnSkill(s,id) {
  if(s?.mode!=='playing' || !s.adventure)return {ok:false,reason:'모험 중에 기술을 배울 수 있습니다.'};
  const n=byId.get(id),a=s.adventure;
  if(!n)return {ok:false,reason:'알 수 없는 기술입니다.'};
  if(a.learned.includes(id))return {ok:false,reason:'이미 배운 기술입니다.'};
  const missing=n.requires.filter(key=>!a.learned.includes(key));
  if(missing.length)return {ok:false,reason:`먼저 ${missing.map(key=>byId.get(key).name).join(', ')} 기술을 배우세요.`};
  if(a.points<n.cost)return {ok:false,reason:`기술 점수 ${n.cost}점이 필요합니다.`};
  a.points-=n.cost;a.learned.push(id);
  if(n.active){const slot=a.equipped.indexOf(null);if(slot!==-1)a.equipped[slot]=id;}
  return {ok:true};
}
export function equipSkill(s,id,slot) {
  if(s?.mode!=='playing' || !s.adventure)return {ok:false,reason:'모험 중에 기술을 장착할 수 있습니다.'};
  if(slot!==0 && slot!==1)return {ok:false,reason:'기술 슬롯은 1번 또는 2번입니다.'};
  if(id!==null && (!Object.hasOwn(ACTIVE_SKILLS,id) || !s.adventure.learned.includes(id)))
    return {ok:false,reason:'먼저 사용할 기술을 배우세요.'};
  if(id!==null)s.adventure.equipped=s.adventure.equipped.map(value=>value===id?null:value);
  s.adventure.equipped[slot]=id;return {ok:true};
}
export function modifiers(s) {
  const result={bladeDamage:0,speed:1,stamina:0,energy:0,armor:0,harvest:1,towerDamage:1};
  for(const id of new Set(s?.adventure?.learned||[])){
    const effects=byId.get(id)?.effects||{};
    for(const key of Object.keys(result))result[key]+=effects[key]||0;
  }
  result.armor=Math.min(.35,result.armor);return result;
}
export function validateAdventure(raw) {
  const a=initAdventure();if(!raw || typeof raw!=='object')return a;
  a.xp=bounded(raw.xp);a.level=levelForXP(a.xp);a.points=2+(a.level-1)*2;
  const requested=new Set(Array.isArray(raw.learned)?raw.learned.slice(0,256):[]);
  for(const skill of SKILLS)if(requested.has(skill.id) && skill.cost<=a.points && skill.requires.every(id=>a.learned.includes(id))){
    a.learned.push(skill.id);a.points-=skill.cost;
  }
  if(Array.isArray(raw.equipped))for(let i=0;i<2;i++){
    const id=raw.equipped[i];if(Object.hasOwn(ACTIVE_SKILLS,id) && a.learned.includes(id) && !a.equipped.includes(id))a.equipped[i]=id;
  }
  a.bosses=knownList(raw.bosses,new Set(BOSS_SITES.filter(b=>!b.final).map(b=>b.id)),8);
  a.waypoints=[...new Set(['home',...knownList(raw.waypoints,new Set(WAYPOINTS.map(w=>w.id)),9)])];
  if(Array.isArray(raw.completedTasks))a.completedTasks=[...new Set(raw.completedTasks.filter(id=>typeof id==='string' && /^[a-zA-Z0-9:_-]{1,64}$/.test(id)))].slice(0,128);
  if(raw.worldDefeated && typeof raw.worldDefeated==='object' && !Array.isArray(raw.worldDefeated)){
    for(const [id,value] of Object.entries(raw.worldDefeated).slice(0,4096))
      if(value===true && /^[a-zA-Z0-9:_-]{1,96}$/.test(id) && !['__proto__','constructor','prototype'].includes(id))a.worldDefeated[id]=true;
  }
  a.chapter=raw.chapter===2?2:1;
  a.finalDefeated=raw.finalDefeated===true && a.bosses.length>=4;
  return a;
}
