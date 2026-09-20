import {TOWNS,LANDMARKS,RESOURCE_NODES} from './world.mjs';
import {awardXP} from './progression.mjs';
import {dungeonCleared} from './dungeons.mjs';
import {RELICS,grantRelic,equipRelic} from './relics.mjs';
export {grantRelic,equipRelic};

const localObjectives={
  sunfields:{kind:'gather',id:'resource-sunfields',name:'풍차에 필요한 목재',text:'햇살구릉의 고목에서 채집하고 목재 4개를 안내인에게 전달하세요.',cost:{wood:4}},
  dunes:{kind:'chest',id:'cache-dunes',name:'모래에 남은 여행 기록',text:'사막의 여행 기록 보관함을 찾아 연 뒤 안내인에게 돌아오세요.'},
  coast:{kind:'waypoint',id:'waypoint-coast',name:'해안을 잇는 등대',text:'청옥 해안의 등대 곁에서 E로 점화한 뒤 안내인에게 돌아오세요.'},
  autumn:{kind:'gather',id:'resource-autumn',name:'과수원 돌담 보수',text:'고원의 돌무더기에서 채집하고 돌 4개를 안내인에게 전달하세요.',cost:{stone:4}},
  alpine:{kind:'trial',id:'trial-alpine',name:'서리 고개의 조사',text:'서리별 산맥의 야외 시련을 마친 뒤 안내인에게 돌아오세요.'},
  mistwood:{kind:'chest',id:'cache-mistwood',name:'숲길 여행자의 기록',text:'안개수림의 여행 기록 보관함을 찾아 연 뒤 안내인에게 돌아오세요.'},
  canyon:{kind:'trial',id:'trial-canyon',name:'협곡 길의 위협',text:'메아리 협곡의 야외 시련을 마친 뒤 안내인에게 돌아오세요.'},
  lavender:{kind:'waypoint',id:'waypoint-lavender',name:'별꽃 길잡이',text:'별꽃 초원의 등대를 직접 점화하고 안내인에게 돌아오세요.'},
};
const dungeonBiomes=new Set(['sunfields','canyon','mistwood','alpine']);
export const QUESTS=Object.freeze(TOWNS.flatMap(town=>{
  const local=localObjectives[town.biomeId],dungeon=dungeonBiomes.has(town.biomeId),target=`${dungeon?'dungeon':'boss'}-${town.biomeId}`;
  return [Object.freeze({id:`quest-${town.biomeId}-local`,townId:town.id,biomeId:town.biomeId,stage:1,name:local.name,description:local.text,
    objective:{kind:local.kind,id:local.id},cost:local.cost||{},reward:{xp:25,food:2},destinationId:local.id}),
  Object.freeze({id:`quest-${town.biomeId}-regional`,townId:town.id,biomeId:town.biomeId,stage:2,name:`${town.name}의 동맹`,
    description:`${dungeon?'지역 던전의 마지막 보물을 회수':'지역 수호자를 격파'}한 뒤 이 도시 안내인에게 돌아오세요.`,objective:{kind:dungeon?'dungeon':'boss',id:target},cost:{},
    reward:{xp:70,reputation:3,...(dungeon?{}:{relic:`relic-${town.biomeId}`})},destinationId:target})];
}));
const service=(id,name,description,cost,effect)=>Object.freeze({id,name,description,cost,effect});
export const SERVICES=Object.freeze({
  mill:service('mill','풍차의 식량 꾸러미','목재 3개 → 식량 4개',{wood:3},{materials:{food:4}}),
  caravan:service('caravan','대상단의 목재 교환','돌 4개 → 목재 3개',{stone:4},{materials:{wood:3}}),
  fishery:service('fishery','항구의 훈제 생선','목재 4개 → 식량 5개',{wood:4},{materials:{food:5}}),
  orchard:service('orchard','과수원의 씨앗 상자','식량 2개 → 호박·순무 씨앗 각 2개',{food:2},{seeds:{pumpkin:2,turnip:2}}),
  lodge:service('lodge','산장 원정 보급','식량 3개 → 회복약 3병 추가, 최대 6병',{food:3},{flasks:3}),
  herbalist:service('herbalist','약초사의 달꽃 씨앗','식량 2개 → 달꽃 씨앗 2개',{food:2},{seeds:{moonflower:2}}),
  forge:service('forge','대장간의 석재 교환','목재 4개 → 돌 3개',{wood:4},{materials:{stone:3}}),
  observatory:service('observatory','별자리로 길 다시 정하기','결정 3개 → 배운 기술 초기화, 모든 기술 점수 반환. 유물은 유지됩니다.',{crystals:3},{respec:true}),
});
const questById=new Map(QUESTS.map(q=>[q.id,q]));
const townById=new Map(TOWNS.map(t=>[t.id,t]));
const npcs=TOWNS.flatMap(t=>t.npcs.map(n=>({...n,townId:t.id})));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const known=(catalog,id)=>typeof id==='string'&&Object.hasOwn(catalog,id);
const failure=reason=>({ok:false,reason});
const hasCost=(s,cost)=>Object.entries(cost).every(([key,n])=>{
  const value=key==='crystals'?s.player?.crystals:s.village?.materials?.[key];return Number.isFinite(value)&&value>=n;
});
function spend(s,cost){for(const [id,n] of Object.entries(cost)){if(id==='crystals')s.player.crystals-=n;else s.village.materials[id]-=n;}}
function emit(s,type,text,npc,extra={}){
  if(!Array.isArray(s.events))s.events=[];
  s.events.push({type,text,x:npc?.x??s.player.x,y:npc?.y??s.player.y,z:npc?.z??s.player.z,...extra});
  if(s.events.length>100)s.events.splice(0,s.events.length-100);
}
function nearby(s,npc){return Number.isFinite(s.player?.x)&&Number.isFinite(s.player?.z)&&Number.isFinite(s.player?.y)
  &&distance(s.player,npc)<=4.2&&Math.abs(s.player.y-npc.y)<=2.5;}
function threatened(s){return s.village?.raid?.status==='active'||(s.enemies||[]).some(e=>e.hp>0&&e.state!=='idle'&&distance(e,s.player)<13&&Math.abs(e.y-s.player.y)<5);}
function proof(s,quest){
  const {kind,id}=quest.objective;
  if(kind==='gather')return RESOURCE_NODES.some(n=>n.id===id)&&Number.isFinite(s.village?.gathered?.[id]);
  if(kind==='chest')return s.progress?.chests?.includes(id)===true;
  if(kind==='waypoint')return s.adventure?.waypoints?.includes(id)===true;
  if(kind==='trial')return s.adventure?.completedTasks?.includes(id)===true;
  if(kind==='boss')return s.adventure?.bosses?.includes(id)===true;
  if(kind==='dungeon')return !!s.expedition&&dungeonCleared(s,id);
  return false;
}
function deriveAllies(journey){return TOWNS.filter(t=>journey.quests[`quest-${t.biomeId}-regional`]===2).map(t=>t.id);}
export function initJourney(){return {visited:[],quests:Object.fromEntries(QUESTS.map(q=>[q.id,0])),relics:[],equipped:[null,null],tracked:null,allies:[]};}
export function validateJourney(raw,state){
  const j=initJourney();if(!raw||typeof raw!=='object')return j;
  if(Array.isArray(raw.visited))j.visited=[...new Set(raw.visited.slice(0,64).filter(id=>townById.has(id)))];
  for(const q of QUESTS){
    const value=raw.quests?.[q.id];j.quests[q.id]=value===1||value===2?value:0;
    if(q.stage===2&&j.quests[`quest-${q.biomeId}-local`]!==2)j.quests[q.id]=0;
    if(state&&j.quests[q.id]===2&&!proof(state,q))j.quests[q.id]=1;
  }
  j.allies=deriveAllies(j);
  if(Array.isArray(raw.relics))j.relics=[...new Set(raw.relics.slice(0,64).filter(id=>{
    if(!known(RELICS,id))return false;if(!state)return true;
    const source=RELICS[id].sourceId;
    return source.startsWith('dungeon-')?!!state.expedition&&dungeonCleared(state,source):j.quests[source]===2;
  }))];
  for(let slot=0;slot<2;slot++){
    const id=raw.equipped?.[slot];if(j.relics.includes(id)&&!j.equipped.includes(id))j.equipped[slot]=id;
  }
  if(questById.has(raw.tracked)&&j.quests[raw.tracked]===1)j.tracked=raw.tracked;
  return j;
}
export function questStatus(s,id){
  const q=questById.get(id);if(!q)return {status:'unavailable',ready:false,reason:'알 수 없는 의뢰입니다.',destinationId:null,objectiveText:''};
  const status=s.journey?.quests?.[id]||0;
  if(status===2)return {status:'claimed',ready:false,reason:'보상을 받았습니다.',destinationId:q.townId,objectiveText:'완료한 의뢰'};
  if(q.stage===2&&s.journey?.quests?.[`quest-${q.biomeId}-local`]!==2)
    return {status:'unavailable',ready:false,reason:'먼저 이 도시의 첫 의뢰를 마치세요.',destinationId:q.townId,objectiveText:'첫 의뢰 보상을 안내인에게 받으세요.'};
  if(status===0)return {status:'available',ready:false,reason:'안내인에게 의뢰를 받으세요.',destinationId:q.townId,objectiveText:q.description};
  const achieved=proof(s,q),paid=hasCost(s,q.cost),ready=achieved&&paid;
  const reason=ready?'도시 안내인에게 돌아가 보상을 받으세요.':achieved?'전달할 재료를 준비한 뒤 안내인에게 돌아오세요.':q.description;
  return {status:ready?'ready':'active',ready,reason,destinationId:ready?q.townId:q.destinationId,objectiveText:reason};
}
export function trackQuest(s,id){
  if(!s?.journey)return failure('여정 기록을 불러오지 못했습니다.');
  if(id!==null&&(!questById.has(id)||s.journey.quests[id]!==1))return failure('진행 중인 의뢰만 추적할 수 있습니다.');
  s.journey.tracked=id;return {ok:true};
}
export function journeyObjective(s){
  const id=s.journey?.tracked,q=questById.get(id);
  if(q){const info=questStatus(s,id),town=townById.get(q.townId);return `${town.name} · ${q.name}: ${info.objectiveText}`;}
  const ready=QUESTS.find(q=>questStatus(s,q.id).ready);
  if(ready)return `${townById.get(ready.townId).name} 안내인에게 돌아가 「${ready.name}」 보상을 받으세요.`;
  return '외곽 등대 곁의 도시에서 안내인·상인·여관지기를 만나보세요.';
}
export function townInteraction(s){
  if(s?.mode!=='playing'||s.expedition?.active||!s.journey)return null;
  const npc=npcs.filter(n=>nearby(s,n)).sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0];if(!npc)return null;
  const town=townById.get(npc.townId),roles={guide:'지역 의뢰와 동맹',merchant:SERVICES[town.service]?.name||'지역 교환',keeper:'무료 휴식과 회복'};
  return {...npc,kind:'npc',townId:town.id,description:`${town.name} · ${roles[npc.role]} · E 대화`,action:'talk',payload:{npcId:npc.id}};
}
export function townAction(s,action,payload={}){
  if(s?.mode!=='playing'||!s.journey)return failure('모험 중에 주민과 이야기할 수 있습니다.');
  if(s.expedition?.active)return failure('던전 밖으로 나온 뒤 도시 주민을 만나세요.');
  if(!payload||typeof payload!=='object')return failure('대화할 주민을 선택하세요.');
  const npc=npcs.find(n=>n.id===payload.npcId);if(!npc)return failure('알 수 없는 주민입니다.');
  if(!nearby(s,npc))return failure(`${npc.name}에게 가까이 다가가세요.`);
  const town=townById.get(npc.townId),j=s.journey;
  if(action==='talk'){
    if(!j.visited.includes(town.id))j.visited.push(town.id);
    emit(s,'town-visit',`${town.name} · ${npc.name}`,npc,{townId:town.id,npcId:npc.id});return {ok:true,townId:town.id,npcId:npc.id,panel:'town'};
  }
  if(action==='accept'||action==='claim'){
    const q=questById.get(payload.questId);
    if(npc.role!=='guide'||!q||q.townId!==town.id)return failure('이 의뢰를 맡긴 도시 안내인에게 돌아가세요.');
    const status=questStatus(s,q.id);
    if(action==='accept'){
      if(status.status!=='available')return failure(status.status==='unavailable'?status.reason:'이미 받은 의뢰입니다.');
      j.quests[q.id]=1;j.tracked=q.id;emit(s,'reward',`의뢰 수락 · ${q.name}`,npc);return {ok:true,questId:q.id};
    }
    if(!status.ready)return failure(status.reason);
    spend(s,q.cost);j.quests[q.id]=2;j.allies=deriveAllies(j);if(j.tracked===q.id)j.tracked=null;
    awardXP(s,q.reward.xp);
    if(q.reward.food)s.village.materials.food=Math.min(99999,s.village.materials.food+q.reward.food);
    if(q.reward.reputation)s.village.reputation=Math.min(99999,s.village.reputation+q.reward.reputation);
    if(q.reward.relic)grantRelic(s,q.reward.relic);
    emit(s,'reward',q.stage===2?`${town.name}과 동맹 · 경험치 70 · 마을 평판 3`:`${q.name} 완료 · 경험치 25 · 식량 2`,npc);
    return {ok:true,questId:q.id,alliance:q.stage===2};
  }
  if(action==='rest'){
    if(npc.role!=='keeper')return failure('여관지기에게 휴식을 부탁하세요.');
    if(threatened(s))return failure('전투에서 벗어난 뒤 쉬어 갈 수 있습니다.');
    const p=s.player;p.hp=p.maxHp;p.stamina=p.maxStamina;p.energy=p.maxEnergy;p.flasks=Math.min(6,Math.max(p.flasks||0,3));
    if(s.adventure.waypoints.includes(town.waypointId))p.checkpoint=town.waypointId;
    emit(s,'rest',`${town.name}의 온기 · 무료로 회복했습니다.`,npc);return {ok:true};
  }
  if(action==='service'){
    if(npc.role!=='merchant'||payload.serviceId!==town.service)return failure('해당 도시 상인에게 서비스를 부탁하세요.');
    const service=SERVICES[town.service];if(!service)return failure('아직 이용할 수 없는 서비스입니다.');
    if(threatened(s))return failure('전투에서 벗어난 뒤 물품을 준비하세요.');
    if(!hasCost(s,service.cost))return failure(`재료가 부족합니다. ${service.description}`);
    const effect=service.effect;
    if(Object.entries(effect.materials||{}).some(([id,n])=>s.village.materials[id]+n>99999)||Object.entries(effect.seeds||{}).some(([id,n])=>s.village.seeds[id]+n>9999))return failure('가방이 가득 찼습니다. 물품을 사용한 뒤 돌아오세요.');
    if(effect.flasks&&s.player.flasks>=6)return failure('회복약이 이미 6병 있습니다.');
    if(effect.respec&&!s.adventure.learned.length)return failure('아직 다시 정할 기술이 없습니다.');
    spend(s,service.cost);
    for(const [id,n] of Object.entries(effect.materials||{}))s.village.materials[id]+=n;
    for(const [id,n] of Object.entries(effect.seeds||{}))s.village.seeds[id]+=n;
    if(effect.flasks)s.player.flasks=Math.min(6,s.player.flasks+effect.flasks);
    if(effect.respec){s.adventure.learned=[];s.adventure.equipped=[null,null];awardXP(s,0);}
    emit(s,'reward',`${service.name} · 준비를 마쳤습니다.`,npc);return {ok:true,serviceId:service.id};
  }
  return failure('알 수 없는 도시 행동입니다.');
}
