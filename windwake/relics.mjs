const relic=(biome,name,description,sourceId,effects)=>Object.freeze({id:`relic-${biome}`,name,description,sourceId,effects:Object.freeze(effects)});
export const RELICS=Object.freeze(Object.fromEntries([
  relic('sunfields','황금 씨앗','수확 식량 +25%','dungeon-sunfields',{harvest:.25}),
  relic('canyon','메아리 방울','검 공격력 +4','dungeon-canyon',{bladeDamage:4}),
  relic('mistwood','안개숲 심장','최대 에너지 +20','dungeon-mistwood',{energy:20}),
  relic('alpine','서리별 방패','받는 피해 6% 감소','dungeon-alpine',{armor:.06}),
  relic('dunes','모래바람 깃','이동 속도 +8%','quest-dunes-regional',{speed:.08}),
  relic('coast','푸른 조개','최대 기력 +25','quest-coast-regional',{stamina:25}),
  relic('autumn','붉은잎 등불','마을 방어탑 공격력 +25%','quest-autumn-regional',{towerDamage:.25}),
  relic('lavender','별꽃 반지','검 공격력 +2 · 최대 에너지 +10','quest-lavender-regional',{bladeDamage:2,energy:10}),
].map(r=>[r.id,r])));
const known=id=>typeof id==='string'&&Object.hasOwn(RELICS,id);
const fail=reason=>({ok:false,reason});
function emit(s,text){if(Array.isArray(s.events)){s.events.push({type:'reward',text,x:s.player?.x||0,y:s.player?.y||0,z:s.player?.z||0});if(s.events.length>100)s.events.shift();}}
export function grantRelic(s,id){
  if(!s?.journey||!known(id))return fail('알 수 없는 유물입니다.');
  if(s.journey.relics.includes(id))return fail('이미 가진 유물입니다.');
  s.journey.relics.push(id);const empty=s.journey.equipped.indexOf(null);if(empty>=0)s.journey.equipped[empty]=id;
  emit(s,`${RELICS[id].name} 획득 · ${RELICS[id].description}`);return {ok:true,id};
}
export function equipRelic(s,id,slot){
  if(s?.mode!=='playing'||!s.journey)return fail('모험 중에 유물을 장착할 수 있습니다.');
  if(slot!==0&&slot!==1)return fail('유물 슬롯을 선택해 주세요.');
  if(id!==null&&(!known(id)||!s.journey.relics.includes(id)))return fail('먼저 이 유물을 획득하세요.');
  if(s.village?.raid?.status==='active'||(s.enemies||[]).some(e=>e.hp>0&&Math.hypot(e.x-s.player.x,e.z-s.player.z)<13&&Math.abs(e.y-s.player.y)<5))
    return fail('전투에서 벗어난 뒤 유물을 바꿀 수 있습니다.');
  if(id!==null)s.journey.equipped=s.journey.equipped.map(value=>value===id?null:value);
  s.journey.equipped[slot]=id;return {ok:true};
}
export function relicModifiers(s){
  const modifiers={bladeDamage:0,speed:0,stamina:0,energy:0,armor:0,harvest:0,towerDamage:0};
  for(const id of new Set((s?.journey?.equipped||[]).slice(0,2))){
    if(!known(id)||!s.journey.relics.includes(id))continue;
    for(const [key,value] of Object.entries(RELICS[id].effects))modifiers[key]+=value;
  }
  return modifiers;
}
export function allianceBenefits(s){
  const count=Object.keys(RELICS).filter(id=>s?.journey?.quests?.[`quest-${id.slice(6)}-regional`]===2).length;
  return {count,towerDamage:Math.min(count,5)*.05,flasks:Math.min(2,Math.floor(count/2))};
}
