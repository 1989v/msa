import {WORLD,LANDMARKS,RUNES,REGIONS,PLATE,VILLAGE,WAYPOINTS,TOWNS,DUNGEON_ENTRANCES,worldStats,heightAt,terrainColor,regionAt,distance,clamp} from './world.mjs';
import {DT,createGame,stepGame,snapshot,restoreSnapshot,spawnEnemy,awardSigil,interaction,upgrade,respawn,fastTravel,exportSave,loadSave,useAbility,floorAt,enterExpedition,exitExpedition,expeditionAction} from './sim.mjs';
import {Renderer} from './render.mjs';
import {AudioSystem} from './audio.mjs';
import {SKILLS,ACTIVE_SKILLS,learnSkill,equipSkill,awardXP} from './progression.mjs';
import {villageAction,villageObjective} from './village.mjs';
import {ENEMY_NAMES} from './combat.mjs';
import {skillsPanel,villagePanel,frontierJournal} from './frontier-ui.mjs';
import {InputBuffer} from './input.mjs';
import {townPanel,journeyJournal,relicPanel} from './journey-ui.mjs';
import {townAction,journeyObjective,trackQuest,equipRelic} from './settlements.mjs';
import {DUNGEONS,dungeonGeometry,dungeonObjective,dungeonCleared} from './dungeons.mjs';

const $=id=>document.getElementById(id);
const canvas=$('world'),audio=new AudioSystem(),input=new InputBuffer();
const STORE='windwake-save-v1';
let state=createGame(),renderer,started=false,manual=false,panel=null,accumulator=0,lastTime=0,hitStop=0,hudClock=0,autosaveClock=0,lastToast='',lastMode='playing',storageAvailable=true;
const keys=new Set(),camera={yaw:0,pitch:.35,distance:9,shake:0,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
const performanceData={frames:0,samples:[],renderMs:[],droppedTime:0};
let autoQuality=true,qualityCooldown=0;const qualityWindow=[];
const eventHistory=[];
const COLORS={ink:'hsl(204 25% 13%)',paper:'hsl(44 42% 92%)',muted:'hsl(42 20% 75%)',wind:'hsl(164 40% 67%)',amber:'hsl(39 84% 66%)',danger:'hsl(8 75% 68%)',line:'hsl(44 16% 36%)'};
let saved=null;
try{const raw=localStorage.getItem(STORE);if(raw){const parsed=JSON.parse(raw);loadSave(parsed);saved=parsed;}}catch{storageAvailable=false;}
if(saved){$('continue-button').hidden=false;$('start-button').classList.remove('primary');$('start-button').textContent='새로운 여정';}

function save(){
  if(!started)return false;
  try{const data=exportSave(state);localStorage.setItem(STORE,JSON.stringify(data));saved=data;storageAvailable=true;return true;}
  catch{storageAvailable=false;return false;}
}
function clearInput(){keys.clear();input.clear();state.previousInput={};joystickPointer=null;lookPointer=null;const knob=document.querySelector('#joystick div');if(knob)knob.style.transform='';}
function start(continuing=false){
  audio.unlock();state=continuing&&saved?loadSave(saved):createGame();manual=false;started=true;panel=null;accumulator=0;lastMode='playing';
  $('start-screen').hidden=true;$('panel').hidden=true;$('hud').hidden=false;clearInput();camera.yaw=0;camera.pitch=.35;camera.distance=9;
  state.toast=continuing?'지도 M에서 주민 의뢰와 던전을, I에서 유물을 확인하세요.':'WASD 이동 · Space 점프. 남쪽 길은 밀바람 마을로 이어집니다. M 지도 · T 기술 · B 내 마을.';state.toastTime=7;save();canvas.focus();draw(0);
}
$('start-button').addEventListener('click',()=>{if(saved)openPanel('new-game');else start();});
$('continue-button').addEventListener('click',()=>start(true));
$('sound-button').addEventListener('click',()=>{audio.unlock();audio.setMuted(!audio.muted);$('sound-button').textContent=audio.muted?'소리 꺼짐':'소리 켜짐';$('sound-button').setAttribute('aria-pressed',String(audio.muted));});
$('pause-button').addEventListener('click',()=>openPanel('pause'));
$('skills-button').addEventListener('click',()=>openPanel('skills'));
$('village-button').addEventListener('click',()=>openPanel('village'));
$('map-button').addEventListener('click',()=>openPanel('map'));
$('relics-button').addEventListener('click',()=>openPanel('relics'));
$('minimap').addEventListener('click',()=>openPanel('map'));
$('close-panel').addEventListener('click',closePanel);

function closePanel(){
  delete state.buildPreview;delete state.activeTown;
  if(state.mode==='dead'){respawn(state);save();}
  if(state.mode==='won'){state.mode='playing';save();}
  panel=null;$('panel').hidden=true;clearInput();accumulator=0;if(started)canvas.focus();
}
function formatTime(t){return `${Math.floor(t/60)}분 ${Math.floor(t%60)}초`;}
function openPanel(kind){
  if(!started&&kind!=='new-game')return;
  clearInput();if(kind!=='village')delete state.buildPreview;panel=kind;accumulator=0;save();$('panel').hidden=false;
  const title=$('panel-title'),content=$('panel-content');$('close-panel').textContent='돌아가기 ×';
  const changed=result=>{if(result?.ok){audio.play('reward');save();}else if(result?.reason){state.toast=result.reason;state.toastTime=4;}updateHUD();};
  if(kind==='skills'){
    title.textContent='세 갈래의 길';$('panel-kicker').textContent='SKILLS / GROWTH';skillsPanel(content,state,changed);
  }else if(kind==='village'){
    title.textContent='내가 가꾸는 바람뜰';$('panel-kicker').textContent='HOME / FARM / DEFEND';villagePanel(content,state,changed);
  }else if(kind==='relics'){
    title.textContent='길에서 만난 유물';$('panel-kicker').textContent='RELICS / TWO SLOTS';relicPanel(content,state,changed);
  }else if(kind==='town'){
    const town=TOWNS.find(t=>t.id===state.activeTown);
    title.textContent=town?.name||'변경의 마을';$('panel-kicker').textContent='RESIDENTS / REQUESTS / SUPPLIES';townPanel(content,state,town?.id,changed);
  }else if(kind==='map'){
    title.textContent='바람을 따라 남긴 기록';$('panel-kicker').textContent='ATLAS / JOURNAL';
    content.innerHTML=`<div class="map-layout"><div><canvas id="atlas" width="520" height="520" aria-label="북쪽이 위인 전체 세계 지도"></canvas><p class="save-status">◎ 웨이포인트 · ⌂ 내 마을 · ♜ 수호자 · ▲ 현재 위치<br>중앙의 작은 섬 밖으로 8개의 길이 이어집니다. 총 1.92 × 1.92 km.</p></div><div id="journal"></div></div>`;
    const journal=$('journal');
    journeyJournal(journal,state,{travel:id=>{if(fastTravel(state,id)){save();closePanel();}else{state.toastTime=5;updateHUD();}},track:id=>{trackQuest(state,id);save();updateHUD();},openRelics:()=>openPanel('relics')});
    content.querySelector('.save-status').textContent=state.expedition?.active?'실내 지도 · 방과 복도를 직접 걸어서 탐험하세요. ▣ 잠긴 문 · ◇ 장치 · △ 귀환문.':'⌂ 지역 마을 · ◎ 웨이포인트 · ▣ 던전 · ♜ 수호자 · ▲ 내 위치. 1.92 × 1.92 km, 원래 맵의 면적 64배.';
    frontierJournal(journal,state,id=>{if(fastTravel(state,id)){save();closePanel();}else {const reason=document.createElement('p');reason.className='action-feedback';reason.textContent=state.toast;journal.prepend(reason);}});

    for(const id of ['quarry','forest','ruins']){
      const l=LANDMARKS.find(l=>l.id===id),done=state.progress.sigils.includes(id),row=document.createElement('div');row.className=`journal-item ${done?'done':''}`;
      const h=document.createElement('h3');h.textContent=`${done?'◆':'◇'} ${l.name}`;const p=document.createElement('p');p.textContent=done?'봉인을 해방했습니다. 바람이 다시 흐릅니다.':l.description;row.append(h,p);journal.append(row);
    }
    const tip=document.createElement('p');tip.className='hint-box';tip.textContent=state.progress.sigils.length===3?'중앙의 청록빛 기류에 뛰어들어 높이 34m까지 오른 뒤 북쪽 하늘섬으로 활강하세요.':'어느 성소부터 찾아도 좋습니다. 첫 봉인에서 바람돛을 얻습니다.';journal.append(tip);
    const head=document.createElement('h3');head.textContent='모닥불로 빠른 이동';journal.append(head);
    for(const l of LANDMARKS.filter(l=>l.kind==='camp')){
      const b=document.createElement('button');b.textContent=l.name;b.disabled=!state.progress.discovered.includes(l.id);b.style.margin='.25rem';b.onclick=()=>{if(fastTravel(state,l.id)){save();closePanel();}else{b.textContent='전투 중에는 이동할 수 없습니다';}};journal.append(b);
    }
    const progress=document.createElement('p');progress.className='save-status';progress.textContent=`발견 ${state.progress.discovered.filter(id=>REGIONS.some(r=>r.id===id)).length}/${REGIONS.length} 지역 · 보물 ${state.progress.chests.length}/${LANDMARKS.filter(l=>l.kind==='chest').length} · ${formatTime(state.time)}`;journal.append(progress);
    drawMap($('atlas'),false);
  }else if(kind==='camp'){
    title.textContent='불씨 곁에서';$('panel-kicker').textContent='REST / PREPARE';
    content.innerHTML=`<p>장비를 내려놓고 잠시 숨을 고릅니다. 체력과 울림, 회복약이 채워졌습니다.<br>흩어진 결정을 모으면 더 먼 곳까지 여행할 수 있습니다.</p><h3>가진 결정 <span id="camp-crystals"></span></h3><div class="button-row"><button id="upgrade-health"></button><button id="upgrade-power"></button></div><p class="hint-box">울림은 방패를 깨뜨립니다. 패링은 적을 크게 경직시키고 울림을 되돌려줍니다.<br>점프 중 공격하면 낙하하며 착지 충격파를 만듭니다.</p><button class="primary" id="camp-leave">다시 길을 나서기 →</button>`;
    function campButtons(){
      $('camp-crystals').textContent=String(state.player.crystals);
      for(const kind of ['health','power']){const lv=state.progress.upgrades[kind],cost=(kind==='health'?5:7)+lv*3,b=$(`upgrade-${kind}`);b.textContent=lv===3?`${kind==='health'?'체력':'검'} 최대 강화`:`${kind==='health'?'체력 +25':'검 공격력 +5'} · ${cost} 결정 (${lv}/3)`;b.disabled=lv>=3||state.player.crystals<cost;b.onclick=()=>{if(upgrade(state,kind)){audio.play('reward');save();campButtons();updateHUD();}};}
    }campButtons();$('camp-leave').onclick=closePanel;
  }else if(kind==='dead'||kind==='won'){
    const won=kind==='won',final=state.adventure.finalDefeated;title.textContent=won?(final?'우리의 마을, 다시 열린 세계':'바람은 당신을 기억합니다'):'잠시 쉬어 가도 괜찮습니다';$('panel-kicker').textContent=won?'THE WIND RETURNS':'A NEW BREATH';$('close-panel').textContent=won?'세계로 돌아가기':'모닥불에서 일어나기';
    content.innerHTML=`<p>${won?(final?'먼 땅의 수호자들과 마지막 고요를 넘어, 당신은 돌아올 마을을 세웠습니다.<br>남은 지역의 발견과 새로운 수확, 마을의 다음 밤으로 모험을 이어가세요.':'고요의 수호자가 눈을 감자, 오래 멈춰 있던 바람이 섬과 숲 사이를 흐릅니다.<br>당신이 되찾은 길은 이제 누군가의 새로운 여정이 됩니다.'):'불씨는 아직 남아 있습니다. 획득한 봉인, 보물과 강화는 사라지지 않습니다.'}</p><div class="stats-grid"><div><strong>${formatTime(state.time)}</strong><span>여행 시간</span></div><div><strong>${state.metrics.kills}</strong><span>물리친 적</span></div><div><strong>${state.progress.chests.length} / ${LANDMARKS.filter(l=>l.kind==='chest').length}</strong><span>찾아낸 보물</span></div><div><strong>${state.metrics.parries}</strong><span>완벽한 패링</span></div></div><div class="button-row"><button id="return-game" class="primary">${won?'남은 세계 탐험하기 →':'모닥불에서 다시 시작 →'}</button></div>`;
    $('return-game').onclick=closePanel;
  }else if(kind==='new-game'){
    title.textContent='새로운 바람을 따라';$('panel-kicker').textContent='NEW JOURNEY';
    content.innerHTML='<p>새 여정을 시작하면 이 브라우저에 저장된 이전 여정을 덮어씁니다.</p><div class="button-row"><button class="primary" id="confirm-new">새 여정 시작</button><button id="cancel-new">이전 여정 유지</button></div>';
    $('confirm-new').onclick=()=>start(false);$('cancel-new').onclick=closePanel;
  }else{
    title.textContent='잠시 바람을 기다리며';$('panel-kicker').textContent='PAUSED';
    content.innerHTML=`<p>중앙의 세 성소, 여덟 외곽 지역과 내 마을. 어떤 여정부터 시작해도 좋습니다.<br>수호자를 물리치고 기술을 익히며 마을의 다음 밤을 준비하세요.</p><div class="control-grid"><div>이동 / 달리기 <kbd>WASD / Shift</kbd></div><div>점프 / 공중에서 바람돛 <kbd>Space</kbd></div><div>3연격 / 공중 내려찍기 <kbd>클릭 또는 J</kbd></div><div>회피 / 짧은 무적 <kbd>K</kbd></div><div>울림 / 돌 밀기 / 방패 깨기 <kbd>Q</kbd></div><div>타이밍 패링 <kbd>F</kbd></div><div>상호작용 / 회복약 <kbd>E / H</kbd></div><div>시점 / 줌 <kbd>우클릭 드래그 / 휠</kbd></div><div>키보드 시점 / 지도 <kbd>방향키 / M</kbd></div><div>장착 기술 <kbd>1 / 2</kbd></div><div>스킬트리 / 내 마을 <kbd>T / B</kbd></div></div><label class="setting"><input id="reduce-motion" type="checkbox" ${camera.reducedMotion?'checked':''}> 화면 흔들림 줄이기</label><div class="button-row"><button class="primary" id="resume-game">여정 계속하기 →</button><button id="open-atlas">지도와 기록</button><button id="restart-game">새 여정</button></div><p class="save-status">${storageAvailable?'진행 상황은 이 브라우저에 자동 저장됩니다.':'브라우저 저장소를 사용할 수 없어 이번 여정은 저장되지 않습니다.'} · ${formatTime(state.time)}</p>`;
    const qualityLabel=document.createElement('label');qualityLabel.className='setting';
    const qualityCheck=document.createElement('input');qualityCheck.type='checkbox';qualityCheck.checked=!autoQuality;qualityCheck.onchange=()=>{autoQuality=!qualityCheck.checked;qualityWindow.length=0;renderer.setResolutionScale(1);};qualityLabel.append(qualityCheck,document.createTextNode('화면 선명도 우선 · 자동 성능 조절 끄기'));content.querySelector('.setting').after(qualityLabel);
    $('reduce-motion').onchange=e=>camera.reducedMotion=e.target.checked;$('resume-game').onclick=closePanel;$('open-atlas').onclick=()=>openPanel('map');$('restart-game').onclick=()=>openPanel('new-game');
  }
  $('close-panel').focus();updateHUD();
}

const mappings={Space:'jump',KeyJ:'attack',KeyK:'dodge',KeyF:'parry',KeyQ:'skill',KeyE:'interact',KeyH:'heal',Digit1:'skill1',Digit2:'skill2',ShiftLeft:'sprint',ShiftRight:'sprint'};
document.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&started&&!panel)e.preventDefault();
  if(e.code==='Escape'){e.preventDefault();if(panel)closePanel();else if(started)openPanel('pause');return;}
  if(['KeyT','KeyB','KeyI'].includes(e.code)&&started&&!e.repeat){const kind={KeyT:'skills',KeyB:'village',KeyI:'relics'}[e.code];if(panel===kind)closePanel();else openPanel(kind);return;}
  if(e.code==='KeyM'&&started&&!e.repeat){if(panel==='map')closePanel();else openPanel('map');return;}
  if(panel||!started)return;
  keys.add(e.code);if(mappings[e.code]&&!e.repeat)input.press(mappings[e.code]);
});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(mappings[e.code])input.release(mappings[e.code]);});
window.addEventListener('blur',()=>{clearInput();if(started&&!panel&&!manual)openPanel('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(started&&!panel&&!manual)openPanel('pause');}});
window.addEventListener('pagehide',save);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let lookPointer=null,joystickPointer=null,lookX=0,lookY=0;
canvas.addEventListener('pointerdown',e=>{
  if(!started||panel)return;audio.unlock();canvas.focus();
  if(e.button===2||e.pointerType==='touch'){lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;canvas.setPointerCapture(e.pointerId);}
  else if(e.button===0)input.press('attack');
});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer)return;camera.yaw+=(e.clientX-lookX)*.006;camera.pitch=clamp(camera.pitch+(e.clientY-lookY)*.004,-.08,.9);lookX=e.clientX;lookY=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(e.pointerId===lookPointer)lookPointer=null;input.release('attack');});
canvas.addEventListener('pointercancel',()=>{lookPointer=null;input.release('attack');});
canvas.addEventListener('wheel',e=>{if(started&&!panel){e.preventDefault();camera.distance=clamp(camera.distance+e.deltaY*.012,4,17);}},{passive:false});
const stick=$('joystick'),knob=stick.firstElementChild;
function moveStick(e){const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.35),dz=(e.clientY-r.top-r.height/2)/(r.height*.35),length=Math.max(1,Math.hypot(dx,dz));input.axes.x=dx/length;input.axes.z=-dz/length;knob.style.transform=`translate(${dx/length*r.width*.28}px,${dz/length*r.height*.28}px)`;}
stick.addEventListener('pointerdown',e=>{if(panel)return;joystickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});
stick.addEventListener('pointermove',e=>{if(joystickPointer===e.pointerId)moveStick(e);});
function endStick(){joystickPointer=null;input.axes.x=0;input.axes.z=0;knob.style.transform='';}
stick.addEventListener('pointerup',endStick);stick.addEventListener('pointercancel',endStick);
for(const b of document.querySelectorAll('[data-action]')){
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(panel)return;audio.unlock();b.setPointerCapture(e.pointerId);input.press(b.dataset.action);});
  b.addEventListener('pointerup',()=>input.release(b.dataset.action));b.addEventListener('pointercancel',()=>input.release(b.dataset.action));
}
function readInput(dt){
  camera.yaw+=((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*dt*1.9;
  camera.pitch=clamp(camera.pitch+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*dt*.9,-.08,.9);
  const next=input.consume(camera.yaw);
  next.moveX=clamp(next.moveX+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),-1,1);
  next.moveZ=clamp(next.moveZ+(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),-1,1);
  return next;
}
function processEvents(){
  for(const e of state.events){
    audio.play(e);eventHistory.push({...e,frame:state.frame});if(eventHistory.length>150)eventHistory.shift();
    if(e.text&&['build','plant','water','harvest','gather','trade','repair','notice','travel'].includes(e.type)){state.toast=e.text;state.toastTime=4;}
    if(e.type==='hit'){hitStop=.035;camera.shake=camera.reducedMotion?0:.13;}
    if(e.type==='hurt')camera.shake=camera.reducedMotion?0:.24;
    if(['solve','reward','rest','win','harvest','build','raid-win','skill-learned','dungeon-enter','dungeon-leave','quest'].includes(e.type))save();
    if(e.type==='town-open'&&!manual)openPanel('town');
    if(['dungeon-enter','dungeon-leave'].includes(e.type)){camera.yaw=state.player.yaw||0;camera.pitch=.35;camera.shake=0;hitStop=0;}
    if(e.type==='village-open'&&!manual)openPanel('village');
    if(e.type==='rest'&&!manual&&!state.activeTown&&!state.expedition?.active)openPanel(distance(state.player,VILLAGE)<10?'village':'camp');
  }
  if(state.mode!==lastMode){lastMode=state.mode;if(!manual&&(state.mode==='dead'||state.mode==='won'))openPanel(state.mode);}
}
const labelPool=[];
for(let i=0;i<12;i++){const el=document.createElement('div');el.className='enemy-label';el.innerHTML='<span></span><div class="meter"><i></i></div><b></b>';el.hidden=true;$('enemy-labels').append(el);labelPool.push(el);}
const residentLabels=Array.from({length:6},()=>{const el=document.createElement('div');el.className='resident-label';el.hidden=true;$('enemy-labels').append(el);return el;});
function updateLabels(){
  if(!renderer)return;
  const visible=state.enemies.filter(e=>e.hp>0&&e.type!=='boss'&&distance(e,state.player)<24).slice(0,12);
  labelPool.forEach((el,i)=>{const e=visible[i];if(!e){el.hidden=true;return;}const p=renderer.project(e.x,e.y+2.35,e.z);el.hidden=!p?.visible;if(el.hidden)return;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.firstElementChild.textContent=e.name||ENEMY_NAMES[e.type]||'방랑자';el.querySelector('i').style.transform=`scaleX(${e.hp/e.maxHp})`;el.lastElementChild.textContent=e.state==='telegraph'?'! 공격 준비':e.state==='hit'?'빈틈':e.state==='recover'?'공격 기회':'';});
  const residents=state.expedition?.active?[]:TOWNS.flatMap(t=>t.npcs).filter(n=>distance(n,state.player)<28).slice(0,6);
  residentLabels.forEach((el,i)=>{const npc=residents[i];if(!npc){el.hidden=true;return;}const at=renderer.project(npc.x,npc.y+2.5,npc.z);el.hidden=!at.visible;if(el.hidden)return;el.style.left=`${at.x}px`;el.style.top=`${at.y}px`;el.textContent=`${{guide:'! 의뢰',merchant:'◇ 교역',keeper:'△ 휴식'}[npc.role]||'주민'} · ${npc.name}`;});
}
let mapBackground,localMapBackground,localMapCell='';
function mapBase(){
  if(mapBackground)return mapBackground;
  const size=384,off=document.createElement('canvas');off.width=size;off.height=size;const ctx=off.getContext('2d'),pixels=ctx.createImageData(size,size);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){const wx=(x/size*2-1)*WORLD.size,wz=(1-z/size*2)*WORLD.size,c=heightAt(wx,wz)<WORLD.waterLevel?[.20,.38,.41]:terrainColor(wx,wz);const i=(z*size+x)*4;pixels.data[i]=c[0]*185;pixels.data[i+1]=c[1]*185;pixels.data[i+2]=c[2]*185;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);mapBackground=off;return off;
}
function localMapBase(p){
  const cx=Math.round(p.x/10)*10,cz=Math.round(p.z/10)*10,key=`${cx}:${cz}`;
  if(localMapCell!==key){
    localMapCell=key;const off=document.createElement('canvas');off.width=96;off.height=96;const ctx=off.getContext('2d'),pixels=ctx.createImageData(96,96);
    for(let z=0;z<96;z++)for(let x=0;x<96;x++){const wx=cx+x-48,wz=cz+48-z,c=heightAt(wx,wz)<WORLD.waterLevel?[.20,.38,.41]:terrainColor(wx,wz),i=(z*96+x)*4;pixels.data[i]=c[0]*185;pixels.data[i+1]=c[1]*185;pixels.data[i+2]=c[2]*185;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);localMapBackground={image:off,cx,cz};
  }return localMapBackground;
}
function drawMap(target,mini=true){
  if(!target)return;const ctx=target.getContext('2d'),w=target.width,h=target.height,p=state.player;
  if(state.expedition?.active){drawDungeonMap(ctx,w,h,mini);return;}
  ctx.clearRect(0,0,w,h);ctx.save();if(mini){ctx.beginPath();ctx.arc(w/2,h/2,w/2,0,Math.PI*2);ctx.clip();}
  const scale=mini?2.2:w/(WORLD.size*2),cx=mini?p.x:0,cz=mini?p.z:0;
  const at=(x,z)=>({x:w/2+(x-cx)*scale,y:h/2-(z-cz)*scale});
  if(mini){const base=localMapBase(p),top=at(base.cx-48,base.cz+48);ctx.drawImage(base.image,top.x,top.y,96*scale,96*scale);}
  else{const top=at(-WORLD.size,WORLD.size);ctx.drawImage(mapBase(),top.x,top.y,WORLD.size*2*scale,WORLD.size*2*scale);}
  ctx.textAlign='center';
  for(const l of LANDMARKS){
    if(mini&&distance(l,p)>55)continue;
    if(['resource','trial'].includes(l.kind)&&!mini)continue;
    if(l.kind==='chest'&&!state.progress.chests.includes(l.id))continue;
    if(!mini&&Math.hypot(l.x,l.z)<130&&!['village','wind'].includes(l.kind))continue;
    const pos=at(l.x,l.z);ctx.fillStyle=l.kind==='boss'?COLORS.danger:l.kind==='waypoint'?(state.adventure.waypoints.includes(l.id)?COLORS.wind:COLORS.muted):l.kind==='shrine'?(state.progress.sigils.includes(l.id)?COLORS.wind:COLORS.amber):COLORS.paper;
    if(l.kind==='dungeon'&&dungeonCleared(state,l.id))ctx.fillStyle=COLORS.wind;
    ctx.font=`${mini?13:16}px system-ui`;const symbol={camp:'△',wind:'◎',chest:'·',waypoint:'◎',boss:'♜',resource:'✦',trial:'◇',village:'⌂',town:'⌂',dungeon:'▣'}[l.kind]||(state.progress.sigils.includes(l.id)?'◆':'◇');ctx.fillText(symbol,pos.x,pos.y+4);
    if(!mini&&['town','village'].includes(l.kind)){ctx.font='10px system-ui';ctx.fillText(l.name,pos.x,pos.y+17);}
  }
  if(mini)for(const npc of TOWNS.flatMap(t=>t.npcs)){if(distance(npc,p)>45)continue;const pos=at(npc.x,npc.z);ctx.fillStyle=COLORS.wind;ctx.fillText(npc.role==='guide'?'!':'·',pos.x,pos.y);}
  if(!mini){ctx.font='11px system-ui';ctx.fillStyle=COLORS.amber;const c=at(0,0);ctx.fillText('바람의 첫 섬',c.x,c.y+20);}
  const pos=at(p.x,p.z);ctx.translate(pos.x,pos.y);ctx.rotate(p.yaw);ctx.fillStyle=COLORS.paper;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle=COLORS.amber;ctx.font=`${mini?11:14}px system-ui`;ctx.textAlign='center';ctx.fillText('N',w/2,mini?15:22);
}
function drawDungeonMap(ctx,w,h,mini){
  const geometry=dungeonGeometry(state),dungeon=DUNGEONS.find(d=>d.id===geometry?.id),p=state.player;
  if(!geometry||!dungeon)return;
  const bounds=dungeon.bounds,scale=mini?2.1:Math.min((w-35)/(bounds.maxX-bounds.minX),(h-35)/(bounds.maxZ-bounds.minZ));
  const cx=mini?p.x:(bounds.maxX+bounds.minX)/2,cz=mini?p.z:(bounds.maxZ+bounds.minZ)/2;
  const at=(x,z)=>({x:w/2+(x-cx)*scale,y:h/2-(z-cz)*scale});
  ctx.clearRect(0,0,w,h);ctx.save();if(mini){ctx.beginPath();ctx.arc(w/2,h/2,w/2,0,Math.PI*2);ctx.clip();}
  ctx.fillStyle=COLORS.ink;ctx.fillRect(0,0,w,h);
  const rect=(b,color)=>{const pos=at(b.x-b.w/2,b.z+b.d/2);ctx.fillStyle=color;ctx.fillRect(pos.x,pos.y,b.w*scale,b.d*scale);};
  for(const floor of geometry.floors)rect(floor,COLORS.line);
  for(const wall of geometry.walls)if(wall.kind!=='ceiling')rect(wall,COLORS.muted);
  for(const door of geometry.doors)rect(door,door.open?COLORS.wind:COLORS.danger);
  ctx.textAlign='center';ctx.font=`${mini?10:12}px system-ui`;
  if(!mini)for(const room of geometry.rooms){const pos=at(room.x,room.z);ctx.fillStyle=COLORS.paper;ctx.fillText(room.name,pos.x,pos.y);}
  for(const landmark of geometry.landmarks){if(mini&&distance(landmark,p)>43)continue;const pos=at(landmark.x,landmark.z);ctx.fillStyle=landmark.kind==='exit'?COLORS.wind:COLORS.amber;ctx.fillText({exit:'△',chest:'◆',rune:'◇',lever:'◇',plate:'○',reset:'↺',clue:'?'}[landmark.kind]||'·',pos.x,pos.y+3);}
  const pos=at(p.x,p.z);ctx.translate(pos.x,pos.y);ctx.rotate(p.yaw);ctx.fillStyle=COLORS.paper;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,6);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle=COLORS.amber;ctx.textAlign='center';ctx.font='12px system-ui';ctx.fillText('N',w/2,15);
}
function updateHUD(){
  const p=state.player;
  $('health-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('health-fill').style.transform=`scaleX(${p.hp/p.maxHp})`;$('stamina-fill').style.transform=`scaleX(${p.stamina/p.maxStamina})`;$('energy-fill').style.transform=`scaleX(${p.energy/p.maxEnergy})`;
  $('crystals').textContent=p.crystals;$('flasks').textContent=p.flasks;$('sail-tag').hidden=!state.progress.glider;
  const dungeon=state.expedition?.active?DUNGEONS.find(d=>d.id===state.expedition.active.id):null;
  const town=dungeon?null:TOWNS.find(t=>distance(t,p)<t.radius+5);
  $('region-name').textContent=dungeon?.name||town?.name||(distance(p,VILLAGE)<VILLAGE.radius?'바람뜰 마을':regionAt(p.x,p.y,p.z).name);$('altitude').textContent=`높이 ${Math.round(p.y)} m · ${p.gliding?'활강 중':p.grounded?'지상':'공중'}`;
  $('heading').textContent=['N','NE','E','SE','S','SW','W','NW'][((Math.round(camera.yaw/(Math.PI/4))%8)+8)%8];
  for(const el of document.querySelectorAll('[data-sigil]')){const done=state.progress.sigils.includes(el.dataset.sigil);el.classList.toggle('earned',done);el.textContent=`${done?'◆':'◇'} ${{quarry:'돌',forest:'숲',ruins:'하늘'}[el.dataset.sigil]}`;}
  $('quest-text').textContent=state.village.raid.status==='active'?`마을 방어 · ${state.village.raid.wave}/2차 침공`:state.village.raid.status==='queued'?(distance(p,VILLAGE)<64?'곧 침공 · 방어탑과 울타리를 준비하세요':'마을에 침공이 다가옵니다 · 지도 M으로 귀환'):distance(p,VILLAGE)<45?villageObjective(state):Math.hypot(p.x,p.z)>160?`외곽 수호자 ${state.adventure.bosses.filter(id=>id!=='boss-frontier').length}/8 · 웨이포인트를 찾아 점화하세요`:state.progress.bossDefeated?'길 너머의 8개 지역과 마을이 기다립니다':state.progress.sigils.length===3?'상승기류를 타고 하늘섬으로':`세 성소 (${state.progress.sigils.length}/3) · 또는 지도 M에서 마을로`;
  if(dungeon)$('quest-text').textContent=dungeonObjective(state);
  else if(state.village.raid.status!=='active'&&state.village.raid.status!=='queued'){
    if(state.journey?.tracked)$('quest-text').textContent=journeyObjective(state);
    else if(town)$('quest-text').textContent=`${town.name} · ! 안내인에게 E로 의뢰 받기 · 상인과 여관도 들러보세요`;
  }
  $('world-clock').textContent=`${state.village.day}일 · ${state.village.clock>=450?'달밤':state.village.clock>=420?'해질녘':'햇살'} · Lv.${state.adventure.level} · 기술 ${state.adventure.points}P`;
  if(dungeon)$('world-clock').textContent+= ' · 마을 시간 정지';
  for(let i=0;i<2;i++){const id=state.adventure.equipped[i],cool=id?p.abilityCooldowns[id]||0:0;$(`active-${i+1}`).textContent=id?`${i+1} ${ACTIVE_SKILLS[id].name}${cool>0?` · ${cool.toFixed(1)}초`:''}`:`${i+1} 기술 장착 · T`;}

  const near=interaction(state);$('interaction').hidden=!near||!!panel;if(near){$('interact-title').textContent=near.kind==='rune'?`${near.name}의 돌`:near.name;$('interact-description').textContent=near.description;}
  if(state.toast!==lastToast){lastToast=state.toast;$('toast').textContent=state.toast;}$('toast').classList.toggle('visible',!!state.toast&&!panel);
  $('skill-feedback').textContent=p.skillCooldown>0?`울림 재충전 ${p.skillCooldown.toFixed(1)}초`:p.energy<35?'울림이 모이는 중…':p.gliding?'Space 돛 접기 · WASD 활강 방향':'Q 울림 준비';
  const boss=state.enemies.filter(e=>e.type==='boss'&&e.hp>0&&distance(p,e)<45&&(e.bossId||e.dungeonId||p.y>22)).sort((a,b)=>distance(p,a)-distance(p,b))[0],show=!!boss;$('boss-bar').hidden=!show;
  if(show){$('boss-bar').firstElementChild.textContent=boss.name||'고요의 수호자';$('boss-fill').style.transform=`scaleX(${boss.hp/boss.maxHp})`;$('boss-phase').textContent=boss.state==='telegraph'?(boss.pattern==='ring'?'원형 파동 — 점프!':boss.pattern==='bolt'?'파편 발사 — 옆으로 회피!':'내려찍기 — 거리 벌리기!'):boss.state==='recover'?'지금이 공격할 기회':boss.phase===2?'격노 · 두 번째 울림':'고요의 수호자';}
  drawMap($('minimap'));
}
function draw(dt){if(!renderer)return;renderer.render(state,camera,dt);updateLabels();updateHUD();}
function frame(now){
  const realDt=lastTime?Math.min((now-lastTime)/1000,.2):DT;lastTime=now;
  if(!document.hidden){
    if(started&&!panel&&!manual){
      if(realDt>.1)performanceData.droppedTime+=realDt-.1;
      if(hitStop>0)hitStop-=realDt;
      else{
        accumulator+=Math.min(realDt,.1);let steps=0;
        while(accumulator>=DT&&steps<6&&!panel){stepGame(state,readInput(DT));processEvents();accumulator-=DT;steps++;}
      }
      autosaveClock+=realDt;if(autosaveClock>15){save();autosaveClock=0;}
    }
    camera.shake=Math.max(0,camera.shake-realDt*.8);
    const startMs=performance.now();renderer?.render(state,camera,Math.min(realDt,.05));const elapsed=performance.now()-startMs;
    if(started&&!panel&&!manual){performanceData.frames++;performanceData.samples.push(realDt*1000);performanceData.renderMs.push(elapsed);if(performanceData.samples.length>1200){performanceData.samples.shift();performanceData.renderMs.shift();}}
    // Reduce only scene resolution when sustained GPU/compositor cost exceeds
    // the frame budget. DOM text, controls and simulation remain full fidelity.
    qualityCooldown=Math.max(0,qualityCooldown-realDt);
    if(started&&!panel&&!manual&&autoQuality&&realDt<.09&&qualityCooldown===0){
      qualityWindow.push(realDt);
      if(qualityWindow.length>=180){
        const average=qualityWindow.reduce((a,b)=>a+b,0)/qualityWindow.length;
        if(average>.0195&&renderer.resolutionScale>.72){renderer.setResolutionScale(renderer.resolutionScale>.9?.85:.72);qualityCooldown=5;}
        qualityWindow.length=0;
      }
    }
    updateLabels();hudClock+=realDt;if(hudClock>.08){updateHUD();hudClock=0;}
    audio.update(state,panel||!started?0:realDt);
  }
  requestAnimationFrame(frame);
}
function reset(seed=WORLD.seed){state=createGame(seed);started=true;manual=true;panel=null;lastMode='playing';accumulator=0;hitStop=0;eventHistory.length=0;clearInput();$('start-screen').hidden=true;$('panel').hidden=true;$('hud').hidden=false;camera.yaw=0;camera.pitch=.35;camera.distance=9;draw(0);return snapshot(state);}
window.WINDWAKE={
  version:'3.0.0',reset,
  step(frames=1,held={},options={}){manual=true;for(let i=0;i<clamp(Math.floor(frames),0,36000);i++){stepGame(state,held);processEvents();}if(options.render!==false)draw(0);return snapshot(state);},
  render(){draw(0);},
  state:()=>snapshot(state),snapshot:()=>snapshot(state),
  restore(data){state=restoreSnapshot(data);manual=true;lastMode=state.mode;draw(0);return snapshot(state);},
  setManual(value=true){manual=!!value;accumulator=0;clearInput();if(!manual){panel=null;$('panel').hidden=true;if(state.mode==='dead'||state.mode==='won')openPanel(state.mode);else canvas.focus();}return manual;},
  teleport(x,y,z){const p=state.player;Object.assign(p,{x,y:y??floorAt(state,x,z),z,vx:0,vy:0,vz:0,grounded:false,gliding:false});draw(0);return snapshot(state);},
  spawnEnemy(type,x,z,y){return structuredClone(spawnEnemy(state,type,x,z,y));},
  defeatEnemy(id){const e=state.enemies.find(e=>e.id===id);if(e){e.hp=1;const p=state.player;const old={x:p.x,y:p.y,z:p.z,yaw:p.yaw};p.x=e.x;p.z=e.z-2;p.y=e.y;p.yaw=0;stepGame(state,{attack:true});for(let i=0;i<15;i++)stepGame(state,{});Object.assign(p,old);}draw(0);},
  grant(kind,value){if(kind==='sigil')awardSigil(state,value);else if(kind==='xp')awardXP(state,clamp(Number(value)||0,0,100000));else if(kind==='crystals')state.player.crystals+=clamp(Number(value)||0,0,999);else if(kind==='flasks')state.player.flasks=clamp(Number(value)||0,0,6);draw(0);},
  learn(id){const result=learnSkill(state,id);draw(0);return result;},equip(id,slot){const result=equipSkill(state,id,slot);draw(0);return result;},
  village(action,payload={}){const result=villageAction(state,action,payload);draw(0);return result;},travel(id){const result=fastTravel(state,id);draw(0);return result;},ability(slot){const result=useAbility(state,slot);draw(0);return result;},
  town(action,payload={}){const result=townAction(state,action,payload);draw(0);return result;},
  equipRelic(id,slot){const result=equipRelic(state,id,slot);draw(0);return result;},track(id){const result=trackQuest(state,id);draw(0);return result;},
  enterDungeon(id){const result=enterExpedition(state,id);processEvents();draw(0);return result;},exitDungeon(){const result=exitExpedition(state);processEvents();draw(0);return result;},
  dungeon(action,payload={}){const result=expeditionAction(state,action,payload);processEvents();draw(0);return result;},
  respawn(){respawn(state);lastMode='playing';draw(0);},
  save:()=>exportSave(state),load(data){state=loadSave(data);lastMode='playing';draw(0);return snapshot(state);},
  metrics(){const a=[...performanceData.samples].sort((a,b)=>a-b),r=performanceData.renderMs;return {frames:performanceData.frames,samples:a.length,fps:a.length?1000/(a.reduce((x,y)=>x+y,0)/a.length):0,frameP95:a[Math.floor(a.length*.95)]||0,frameP99:a[Math.floor(a.length*.99)]||0,renderAverage:r.length?r.reduce((x,y)=>x+y,0)/r.length:0,droppedTime:performanceData.droppedTime,renderer:renderer?.stats,world:worldStats(),actors:state.enemies.length,audioVoices:audio.voices.size};},
  camera(){return {...camera};},setCamera(values){for(const k of ['yaw','pitch','distance'])if(Number.isFinite(values[k]))camera[k]=values[k];draw(0);},
  resetMetrics(){performanceData.frames=0;performanceData.samples.length=0;performanceData.renderMs.length=0;performanceData.droppedTime=0;},
  events:()=>structuredClone(eventHistory),input:()=>({held:[...input.held],pending:[...input.pending],keys:[...keys],axes:{...input.axes}}),
  ui:()=>({started,manual,panel,storageAvailable,audio:audio.context?.state||'locked',muted:audio.muted}),
};

try{renderer=new Renderer(canvas);renderer.resize();draw(0);requestAnimationFrame(frame);}
catch(error){$('fatal').hidden=false;$('fatal-text').textContent=`브라우저의 WebGL을 사용할 수 없습니다. Chrome의 하드웨어 가속을 켜고 다시 시도하세요. (${error.message})`;console.error(error);}
window.addEventListener('resize',()=>renderer?.resize());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(started&&!panel)openPanel('pause');$('fatal').hidden=false;$('fatal-text').textContent='그래픽 연결이 중단되었습니다. 진행은 저장되었습니다. 다시 시도를 눌러 이어가세요.';save();});
