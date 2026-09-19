import {VILLAGE,RESOURCE_NODES,WAYPOINTS,BOSS_SITES,BIOMES,heightAt,distance} from './world.mjs';
import {SKILLS,ACTIVE_SKILLS,learnSkill,equipSkill} from './progression.mjs';
import {BUILDINGS,CROPS,villageAction,villageObjective} from './village.mjs';

function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,action,disabled=false){const b=el('button',text);b.disabled=disabled;b.onclick=action;return b;}
const BRANCHES={blade:['검의 길','빈틈을 읽고 강하게 잇는 공격'],wind:['바람의 길','먼 곳까지 이어지는 기력과 이동'],hearth:['불씨의 길','농사와 마을을 지키는 힘']};
const COST_NAMES={wood:'목재',stone:'돌',food:'식량'};
function costText(cost){return Object.entries(cost||{}).map(([k,n])=>`${COST_NAMES[k]||k} ${n}`).join(' · ');}
export function skillsPanel(root,s,onChange){
  const redraw=()=>skillsPanel(root,s,onChange);root.replaceChildren();
  root.append(el('p',`여행자 Lv.${s.adventure.level} · 경험치 ${s.adventure.xp} · 사용할 기술 포인트 ${s.adventure.points}`,'skill-summary'));
  root.append(el('p','탐험, 성소, 전투, 농사로 경험치를 얻습니다. 윗 기술을 익히면 다음 기술이 열립니다. 처음부터 2포인트를 사용할 수 있습니다.'));
  const slots=el('div',undefined,'equipped-skills');
  s.adventure.equipped.forEach((id,i)=>{const slot=el('div');slot.append(el('kbd',String(i+1)),el('strong',id?ACTIVE_SKILLS[id].name:'장착한 기술 없음'));slots.append(slot);});root.append(slots);
  const trees=el('div',undefined,'skill-trees');
  for(const [branch,[name,description]] of Object.entries(BRANCHES)){
    const column=el('section',undefined,'skill-branch');column.append(el('h3',name),el('p',description,'branch-description'));
    for(const node of SKILLS.filter(n=>n.branch===branch)){
      const learned=s.adventure.learned.includes(node.id),requirements=node.requires||[],available=requirements.every(id=>s.adventure.learned.includes(id));
      const row=el('article',undefined,`skill-node ${learned?'learned':available?'available':'locked'}`);row.dataset.skill=node.id;
      row.append(el('strong',`${learned?'◆':'◇'} ${node.name}`),el('p',node.description));
      if(requirements.length)row.append(el('small',`↑ ${requirements.map(id=>SKILLS.find(n=>n.id===id)?.name||id).join(' + ')}`));
      const actions=el('div',undefined,'node-actions');
      if(!learned)actions.append(button(`익히기 · ${node.cost} P`,()=>{const result=learnSkill(s,node.id);onChange(result);redraw();},!available||s.adventure.points<node.cost));
      else if(ACTIVE_SKILLS[node.id])for(let i=0;i<2;i++)actions.append(button(`${i+1}번 ${s.adventure.equipped[i]===node.id?'장착됨':'장착'}`,()=>{onChange(equipSkill(s,node.id,i));redraw();},s.adventure.equipped[i]===node.id));
      else actions.append(el('small','항상 적용 중','learned-label'));
      row.append(actions);column.append(row);
    }trees.append(column);
  }root.append(trees);
}
let blueprint='plot',facing=0,selectedCell=null,selectedCrop='turnip',feedback='';
export function villagePanel(root,s,onChange){
  root.replaceChildren();const v=s.village,p=s.player;
  const redraw=()=>villagePanel(root,s,onChange);
  const act=(action,payload)=>{const result=villageAction(s,action,payload);feedback=result.ok?'완료했습니다.':result.reason||'아직 할 수 없습니다.';if(result.ok&&action==='build'&&selectedCell){selectedCell.id=result.id;delete s.buildPreview;}onChange(result);redraw();};
  const top=el('div',undefined,'village-summary');top.append(el('strong',`바람뜰 마을 · ${v.level}단계`),el('span',costText(v.materials)),el('span',`명성 ${v.reputation} · 봉화 ${Math.ceil(v.beaconHp)}/${v.maxBeaconHp||180}`));root.append(top);
  root.append(el('p',villageObjective(s),'hint-box'));
  const dayPhase=v.clock>=450?'밤':v.clock>=420?'해질녘':'낮';
  root.append(el('p',`${v.day}일째 ${dayPhase} · ${v.raid.status==='active'?`방어 중 ${v.raid.wave}/${v.raid.waves}차 습격`:v.raid.status==='queued'?'침공 대기 — 마을로 돌아와 대비하세요':v.raid.status==='lost'?'봉화를 수리하고 다시 준비하세요':'첫 집과 첫 수확을 마치면 밤에 침공이 찾아옵니다.'}`));
  const homeDistance=distance(p,VILLAGE);
  if(homeDistance>VILLAGE.radius+4){root.append(el('p','마을에 돌아오면 건설하고 작물을 돌볼 수 있습니다. 지도 M의 「바람뜰 마을」로 이동하세요.'));return;}
  const layout=el('div',undefined,'village-layout'),left=el('div'),right=el('div');
  left.append(el('h3','내 발밑의 마을 설계도'),el('p','설계도와 빈 칸을 선택해 배치를 확인한 뒤 건설하세요. 한 칸은 4m입니다. 걸어가면 다른 자리도 꾸밀 수 있습니다.','save-status'));
  const grid=el('div',undefined,'village-grid');grid.setAttribute('aria-label','플레이어 주변 7×7 마을 배치');
  const cx=VILLAGE.x+Math.round((p.x-VILLAGE.x)/4)*4,cz=VILLAGE.z+Math.round((p.z-VILLAGE.z)/4)*4;
  const symbols={plot:'▧',cottage:'⌂',well:'○',granary:'▤',tower:'♜',fence:'═',flowers:'✿',lantern:'✦'};
  for(let iz=3;iz>=-3;iz--)for(let ix=-3;ix<=3;ix++){
    const x=cx+ix*4,z=cz+iz*4,object=[...v.structures,...v.plots.map(a=>({...a,type:'plot'}))].find(a=>Math.hypot(a.x-x,a.z-z)<1);
    const here=Math.abs(p.x-x)<2&&Math.abs(p.z-z)<2;
    const cell=button(object?symbols[object.type]||'◆':here?'●':'·',()=>{selectedCell={x,z};if(object){selectedCell.id=object.id;delete s.buildPreview;}else s.buildPreview={x,z,y:heightAt(x,z),type:blueprint,facing,valid:true};redraw();},distance({x,z},VILLAGE)>VILLAGE.radius-2||distance({x,z},VILLAGE)<5||RESOURCE_NODES.some(n=>distance(n,{x,z})<3)||Math.hypot(p.x-x,p.z-z)>12);
    cell.title=object?`${BUILDINGS[object.type]?.name||object.type} · 선택하여 관리`:`${x}, ${z} · ${BUILDINGS[blueprint]?.name||blueprint} 짓기`;
    cell.setAttribute('aria-label',cell.title);cell.dataset.x=x;cell.dataset.z=z;
    if(object)cell.classList.add('occupied');if(here)cell.classList.add('player-cell');if(selectedCell?.x===x&&selectedCell?.z===z)cell.classList.add('selected');grid.append(cell);
  }
  const confirm=button(selectedCell&&!selectedCell.id?`${BUILDINGS[blueprint].name} 건설 · ${costText(BUILDINGS[blueprint].cost)}`:'빈 칸을 선택해 배치 확인',()=>{const cell=selectedCell;act('build',{type:blueprint,x:cell.x,z:cell.z,facing});delete s.buildPreview;},!selectedCell||!!selectedCell.id);confirm.id='confirm-build';confirm.classList.add('primary');
  left.append(confirm,grid,el('small','북쪽 ↑ · ● 내 위치 · 선택 후 건설 · 회색은 범위 밖'));
  const feedbackLine=el('p',feedback,'action-feedback');feedbackLine.setAttribute('role','status');left.append(feedbackLine);
  right.append(el('h3','설계도'),el('p','가까운 나무·돌무더기에서 E로 재료를 모으세요. 타워는 가까운 적을 자동 공격하고 울타리는 침공을 늦춥니다.','save-status'));
  const designs=el('div',undefined,'blueprints');
  for(const [id,b] of Object.entries(BUILDINGS)){
    const choice=button(`${symbols[id]||'◇'} ${b.name||id}\n${costText(b.cost)}`,()=>{blueprint=id;if(s.buildPreview)s.buildPreview.type=id;feedback='빈 칸을 선택한 뒤 건설 버튼을 누르세요.';redraw();},v.level<(b.level||1));choice.classList.toggle('selected',blueprint===id);choice.dataset.blueprint=id;designs.append(choice);
  }right.append(designs,button(`방향 바꾸기 · ${Math.round(facing*180/Math.PI)}°`,()=>{facing=(facing+Math.PI/2)%(Math.PI*2);if(s.buildPreview)s.buildPreview.facing=facing;redraw();}));
  layout.append(left,right);root.append(layout);
  const object=selectedCell&&[...v.plots,...v.structures].find(a=>a.id===selectedCell.id);
  if(object){
    const detail=el('section',undefined,'village-detail');
    detail.append(el('h3',object.type?`${BUILDINGS[object.type]?.name||object.type} · ${Math.ceil(object.hp)}/${object.maxHp}`:'작은 밭'));
    if(!object.type){
      const structure=v.structures.find(b=>b.id===object.id);if(structure&&structure.hp<structure.maxHp)detail.append(button(`텃밭 수리 · ${Math.ceil(structure.hp)}/${structure.maxHp}`,()=>act('repair',{id:object.id})));
      const crop=CROPS[object.crop];detail.append(el('p',crop?`${crop.name} · ${object.stage==='ripe'?'수확 가능':object.watered?'자라는 중':'물을 주세요'} · ${Math.floor(object.growth||0)}초`:'심을 작물을 선택하세요.'));
      const options=el('div',undefined,'button-row');
      if(!object.crop){for(const [id,c] of Object.entries(CROPS))options.append(button(`${c.name} (${v.seeds[id]||0})`,()=>{selectedCrop=id;act('plant',{id:object.id,crop:id});},!v.seeds[id]));}
      else if(object.stage==='ripe')options.append(button('수확하기',()=>act('harvest',{id:object.id})));
      else options.append(button('물 주기',()=>act('water',{id:object.id}),object.watered));
      detail.append(options);
    }else detail.append(button('수리 · 목재 2 / 돌 1',()=>act('repair',{id:object.id}),object.hp>=object.maxHp));
    detail.append(button('철거 · 재료 일부 반환',()=>act('remove',{id:object.id})));root.append(detail);
  }
  const farm=el('section');farm.append(el('h3',`농사 기록 · 밭 ${v.plots.length}/16`));
  const crops=el('div',undefined,'crop-list');
  for(const plot of v.plots){const row=el('div',undefined,'crop-row');const c=CROPS[plot.crop];row.append(el('span',c?`${c.name} · ${plot.stage==='ripe'?'수확 가능':!plot.watered?'물 필요':`${Math.floor(plot.growth)}초 성장`}`:'빈 밭'));
    if(!c)row.append(button(`${CROPS[selectedCrop].name} 심기`,()=>act('plant',{id:plot.id,crop:selectedCrop}),!v.seeds[selectedCrop]));
    else row.append(button(plot.stage==='ripe'?'수확':'물 주기',()=>act(plot.stage==='ripe'?'harvest':'water',{id:plot.id}),plot.watered&&plot.stage!=='ripe'));
    row.append(el('small',`거리 ${Math.round(distance(p,plot))}m`));crops.append(row);
  }farm.append(crops);root.append(farm);
  const actions=el('div',undefined,'button-row');actions.append(button('마을 단계 올리기',()=>act('upgrade',{}),v.level>=3),button('봉화 수리',()=>act('repair',{id:'beacon'}),v.beaconHp>=180),button('쉬고 회복하기',()=>act('rest',{})));
  for(const [id,c] of Object.entries(CROPS))actions.append(button(`${c.name} 씨앗 · 식량 1`,()=>act('trade',{kind:'seed',crop:id})));
  actions.append(button('다시 시작할 씨앗 받기',()=>act('trade',{kind:'recovery'})),button('음식 먹기 · 식량 2',()=>act('trade',{kind:'food'})));
  root.append(el('h3','봉화 곁의 생활'),el('p','봉화 근처에서 거래·휴식·마을 승급을 할 수 있습니다. 2단계: 명성 6 + 목재 12 / 돌 8 / 식량 4. 3단계: 명성 16 + 목재 20 / 돌 14 / 식량 8.','save-status'),actions);
}
export function frontierJournal(root,s,travel){
  root.append(el('h3','길을 잇는 웨이포인트'));
  const home=WAYPOINTS.find(w=>w.id==='home');if(home)root.append(button(`⌂ ${home.name}`,()=>travel(home.id)));
  for(const biome of BIOMES){
    const waypoint=WAYPOINTS.find(w=>w.biomeId===biome.id),boss=BOSS_SITES.find(b=>b.biomeId===biome.id&&!b.final),done=boss&&s.adventure.bosses.includes(boss.id);
    const row=el('div',undefined,'journal-item');row.append(el('h3',`${done?'◆':'◇'} ${biome.name}`),el('p',`${biome.description} · ${done?'수호자 격파 완료':boss?.name||'수호자의 흔적'}`));
    if(waypoint)row.append(button(s.adventure.waypoints.includes(waypoint.id)?`이동 · ${waypoint.name}`:'직접 찾아가 점화하기',()=>travel(waypoint.id),!s.adventure.waypoints.includes(waypoint.id)));root.append(row);
  }
  root.append(el('p',`외곽 수호자 ${s.adventure.bosses.filter(id=>id!=='boss-frontier').length}/8 · 마을 ${s.village.level}/3단계 · 탐험 시련 ${s.adventure.completedTasks.filter(id=>id.startsWith('trial-')).length}/8`,'hint-box'));
  root.append(el('p',s.adventure.finalDefeated?'세계의 수호자를 물리쳤습니다. 남은 지역과 마을의 다음 밤이 기다립니다.':'네 지역 수호자와 마을 3단계 → 북쪽 끝의 세계 수호자에게 도전하세요.'));
}
