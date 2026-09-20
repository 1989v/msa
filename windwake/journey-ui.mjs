import {TOWNS,LANDMARKS} from './world.mjs';
import {QUESTS,SERVICES,townAction,questStatus,trackQuest,journeyObjective} from './settlements.mjs';
import {RELICS,equipRelic,allianceBenefits} from './relics.mjs';

const element=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
function button(text,action,disabled=false){const b=element('button',text);b.type='button';b.disabled=disabled;b.onclick=action;return b;}
const roles={guide:'안내인 · 의뢰와 동맹',merchant:'상인 · 지역 서비스',keeper:'여관지기 · 무료 휴식'};
const names={wood:'목재',stone:'돌',food:'식량',crystals:'결정'};
const states={unavailable:'아직 열리지 않음',available:'받을 수 있는 의뢰',active:'진행 중',ready:'돌아가 보상 받기',claimed:'보상 수령 완료'};
const costs=value=>Object.entries(value||{}).map(([id,n])=>`${names[id]||id} ${n}`).join(' · ');
const destination=id=>LANDMARKS.find(l=>l.id===id)?.name||TOWNS.find(t=>t.id===id)?.name||id;
function rewardText(q){return [`경험치 ${q.reward.xp}`,q.reward.food?`식량 ${q.reward.food}`:null,q.reward.reputation?`마을 평판 ${q.reward.reputation} · 도시 동맹`:null,q.reward.relic?`유물 ${RELICS[q.reward.relic].name}`:null].filter(Boolean).join(' · ');}
function near(s,npc){return !s.expedition?.active&&Math.hypot(s.player.x-npc.x,s.player.z-npc.z)<=4.2&&Math.abs(s.player.y-npc.y)<=2.5;}
function feedbackLine(text){const line=element('p',text,'action-feedback');line.setAttribute('role','status');return line;}

export function townPanel(root,s,townId,changed=()=>{}){
  const town=TOWNS.find(t=>t.id===townId);let feedback='';
  if(!town||!s.journey){root.replaceChildren(element('p','도시 기록을 찾을 수 없습니다.'));return;}
  function action(kind,payload){const result=townAction(s,kind,payload);feedback=result.ok?'완료했습니다.':result.reason;changed(result);render();}
  function render(){
    root.replaceChildren();root.append(element('h3',town.name),element('p',town.description),element('p',`${costs(s.village.materials)} · 결정 ${s.player.crystals||0} · 회복약 ${s.player.flasks}/6`,'save-status'));
    root.append(element('p','주민 곁에서 대화하세요. 다른 주민을 만나려면 메뉴를 닫고 그쪽으로 걸어가세요.','hint-box'),feedbackLine(feedback));
    for(const npc of town.npcs){
      const available=near(s,npc),section=element('section',undefined,'journal-item town-resident');section.dataset.npc=npc.id;
      section.append(element('h3',npc.name),element('p',`${roles[npc.role]} · ${Math.round(Math.hypot(s.player.x-npc.x,s.player.z-npc.z))}m`));
      if(!available)section.append(element('p',s.expedition?.active?'던전 밖에서 만날 수 있습니다.':`${npc.name}에게 가까이 가면 이용할 수 있습니다.`,'save-status'));
      if(npc.role==='guide'){
        for(const q of QUESTS.filter(q=>q.townId===town.id)){
          const info=questStatus(s,q.id),row=element('article',undefined,'quest-row');row.dataset.quest=q.id;
          row.append(element('strong',`${q.stage}. ${q.name} · ${states[info.status]}`),element('p',q.description),element('small',`목적지: ${destination(info.destinationId)} · 보상: ${rewardText(q)}`));
          if(Object.keys(q.cost).length)row.append(element('p',`보고할 때 전달: ${costs(q.cost)}`,'save-status'));
          if(info.status==='available'){
            const accept=button('의뢰 받기',()=>action('accept',{npcId:npc.id,questId:q.id}),!available);accept.dataset.action='accept';row.append(accept);
          }else if(info.status==='ready'){
            const claim=button('보고하고 보상 받기',()=>action('claim',{npcId:npc.id,questId:q.id}),!available);claim.dataset.action='claim';row.append(claim);
          }else row.append(element('p',info.reason,'save-status'));
          section.append(row);
        }
      }else if(npc.role==='merchant'){
        const service=SERVICES[town.service];section.append(element('strong',service.name),element('p',service.description));
        if(service.effect.respec)section.append(element('p','초기화하면 배운 기술과 1·2번 능력 장착이 비워집니다. 경험치·유물·진행 기록은 그대로 남습니다.','save-status'));
        const buy=button(service.name,()=>action('service',{npcId:npc.id,serviceId:service.id}),!available);buy.dataset.action='service';section.append(buy);
      }else if(npc.role==='keeper'){
        section.append(element('p','무료로 체력·기력·에너지와 회복약 3병을 보충합니다. 점화한 도시 등대만 부활 지점으로 설정됩니다.'));
        const rest=button('무료로 쉬어 가기',()=>action('rest',{npcId:npc.id}),!available);rest.dataset.action='rest';section.append(rest);
      }
      root.append(section);
    }
  }
  render();
}

export function journeyJournal(root,s,callbacks={}){
  if(!s.journey)return;
  const benefit=allianceBenefits(s),objectiveLine=element('p',journeyObjective(s),'hint-box'),trackingButtons=[];
  root.append(element('h3','도시와 약속한 여정'),objectiveLine);
  root.append(element('p',`도시 방문 ${s.journey.visited.length}/8 · 의뢰 ${Object.values(s.journey.quests).filter(n=>n===2).length}/16 · 동맹 ${benefit.count}/8`));
  root.append(element('p',`동맹 혜택: 마을 방어탑 +${Math.round(benefit.towerDamage*100)}%, 귀환 휴식 회복약 +${benefit.flasks}병 (최대 6병)`,'save-status'));
  if(callbacks.openRelics)root.append(button(`유물 살펴보기 · ${s.journey.relics.length}/8`,callbacks.openRelics));
  for(const town of TOWNS){
    const section=element('section',undefined,'journal-item');section.dataset.town=town.id;
    section.append(element('h3',`${s.journey.allies.includes(town.id)?'동맹 · ':''}${town.name}`),element('p',`${town.description} · ${SERVICES[town.service].name}`));
    for(const q of QUESTS.filter(q=>q.townId===town.id)){
      const info=questStatus(s,q.id),row=element('div',undefined,'quest-row');row.dataset.quest=q.id;
      row.append(element('strong',`${q.stage}. ${q.name} · ${states[info.status]}`),element('p',info.objectiveText),element('small',`목적지: ${destination(info.destinationId)} · ${rewardText(q)}`));
      if(s.journey.quests[q.id]===1){
        const track=button(s.journey.tracked===q.id?'현재 추적 중':'이 의뢰 추적',()=>{
          const result=trackQuest(s,q.id);if(result.ok){
            callbacks.track?.(q.id);objectiveLine.textContent=journeyObjective(s);
            for(const [id,node] of trackingButtons){node.textContent=s.journey.tracked===id?'현재 추적 중':'이 의뢰 추적';node.disabled=s.journey.tracked===id;}
          }
        },s.journey.tracked===q.id);track.dataset.action='track';trackingButtons.push([q.id,track]);row.append(track);
      }
      section.append(row);
    }
    if(callbacks.travel)section.append(button(s.adventure.waypoints.includes(town.waypointId)?'도시 등대로 이동':'등대를 직접 점화하면 이동 가능',()=>callbacks.travel(town.waypointId),!s.adventure.waypoints.includes(town.waypointId)||!!s.expedition?.active));
    root.append(section);
  }
}

export function relicPanel(root,s,changed=()=>{}){
  let feedback='';
  if(!s.journey){root.replaceChildren(element('p','유물 기록이 없습니다.'));return;}
  function equip(id,slot){const result=equipRelic(s,id,slot);feedback=result.ok?'유물 장착을 바꿨습니다.':result.reason;changed(result);render();}
  function render(){
    root.replaceChildren();root.append(element('p','유물 2개를 자유롭게 조합하세요. 같은 유물은 한 슬롯에만 놓을 수 있고 전투 중에는 바꿀 수 없습니다.','hint-box'),feedbackLine(feedback));
    const slots=element('div',undefined,'equipped-skills');
    s.journey.equipped.forEach((id,i)=>{const slot=element('div');slot.append(element('strong',`유물 ${i+1} · ${id?RELICS[id].name:'빈 슬롯'}`));if(id)slot.append(button('장착 해제',()=>equip(null,i)));slots.append(slot);});root.append(slots);
    for(const relic of Object.values(RELICS)){
      const owned=s.journey.relics.includes(relic.id),row=element('article',undefined,`skill-node ${owned?'learned':'locked'}`);row.dataset.relic=relic.id;
      row.append(element('strong',`${owned?'획득 · ':'미획득 · '}${relic.name}`),element('p',relic.description));
      const quest=QUESTS.find(q=>q.id===relic.sourceId);row.append(element('small',`획득처: ${quest?`${destination(quest.townId)}의 두 번째 의뢰 보고`:destination(relic.sourceId)}`));
      if(owned){const actions=element('div',undefined,'node-actions');for(let slot=0;slot<2;slot++)actions.append(button(`${slot+1}번 ${s.journey.equipped[slot]===relic.id?'장착됨':'장착'}`,()=>equip(relic.id,slot),s.journey.equipped[slot]===relic.id));row.append(actions);}
      root.append(row);
    }
  }
  render();
}
