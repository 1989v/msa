import { DUNGEON_ENTRANCES } from './world.mjs';

// Authored scene data and durable facts only. The simulation supplies physics,
// actors and rewards; both collision and rendering consume this same geometry.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const inside=(p,b,r=0)=>Math.abs(p.x-b.x)<=b.w/2+r&&Math.abs(p.z-b.z)<=b.d/2+r;
const near=(p,b,r=3)=>distance(p,b)<=r&&Math.abs(p.y-b.y)<=2.4;
const fail=reason=>({ok:false,reason});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const box=(id,x,z,w,d,h=8,y=0,kind='wall')=>({id,x,y,z,w,d,h,kind});

function layout({biome,name,description,family,positions,links,sequence,relays,plates=1,jumpAxis='z'}){
  const id=`dungeon-${biome}`,ns=key=>`${id}:${key}`;
  const names={entry:'입구 회랑',guard:'파수꾼의 방',runes:sequence?'기억의 문양실':'등불 배전실',weights:'무게의 방',ascent:'높은 돌다리',boss:'봉인의 심장',treasure:'숨겨진 보관실'};
  const rooms=Object.entries(positions).map(([kind,[x,z]])=>({id:ns(kind),kind,name:names[kind],x,y:0,z,w:20,d:20}));
  const room=kind=>rooms.find(r=>r.kind===kind),floors=[],walls=[],doors=[],props=[],landmarks=[],spawns=[],puzzles=[],blocks=[];
  const addMark=(kind,local,at,extra={})=>landmarks.push({id:ns(local),kind,name:extra.name||names[kind]||kind,description:'',...at,...extra});
  for(const r of rooms){
    floors.push(box(`${r.id}:floor`,r.x,r.z,r.w,r.d,.5,-.5,'floor'));
    for(const side of ['north','south','east','west']){
      const vertical=side==='east'||side==='west',sign=side==='north'||side==='east'?1:-1;
      const connected=links.some(([a,b])=>{
        const other=a===r.kind?room(b):b===r.kind?room(a):null;
        return other&&(vertical?other.z===r.z&&Math.sign(other.x-r.x)===sign:other.x===r.x&&Math.sign(other.z-r.z)===sign);
      });
      for(const [offset,length] of connected?[[-6.5,7],[6.5,7]]:[[0,20]]){
        walls.push(box(`${r.id}:${side}:${offset}`,r.x+(vertical?sign*10:offset),r.z+(vertical?offset:sign*10),vertical?1:length,vertical?length:1));
      }
    }
  }
  const guard=room('guard');
  for(const [i,type] of (biome==='sunfields'?['slime','wolf']:biome==='canyon'?['burrower','bomber']:biome==='mistwood'?['wolf','shaman']:['frostling','sentinel']).entries()){
    spawns.push({id:ns(`guard-${i}`),type,x:guard.x+(i?3:-3),y:0,z:guard.z+2,roomId:guard.id,hp:type==='sentinel'?80:45,required:true});
  }
  const boss=room('boss');
  spawns.push({id:ns('boss-guardian'),type:'boss',family,x:boss.x,y:0,z:boss.z+1,roomId:boss.id,hp:360,required:true});
  const optional=room('treasure');
  spawns.push({id:ns('treasure-guard'),type:biome==='alpine'?'frostling':'slime',x:optional.x+3,y:0,z:optional.z,roomId:optional.id,hp:40,required:false});
  addMark('chest','optional-chest',{x:optional.x-4,y:0,z:optional.z+4},{name:'여행자의 보관함',description:'보관실의 적을 물리치고 열기',requires:[ns('treasure-guard')],reward:{wood:5,stone:5,food:3,crystals:5}});
  for(const r of [guard,boss,optional])for(const sign of [-1,1])props.push(box(`${r.id}:cover-${sign}`,r.x+sign*6,r.z-3,2,2,2,0,'cover'));

  const rune=room('runes'),puzzleId=ns('lights');
  if(sequence){
    puzzles.push({id:puzzleId,type:'sequence',roomId:rune.id,order:sequence,required:true});
    const labels=['해','잎','별'];
    addMark('clue','light-clue',{x:rune.x-6,y:0,z:rune.z-6},{name:'기억의 비문',description:`문양을 ${sequence.map(i=>labels[i]).join(' → ')} 순서로 만지세요. 틀려도 처음부터 다시 시도할 수 있습니다.`});
    for(let i=0;i<3;i++)addMark('rune',`rune-${i}`,{x:rune.x+(i-1)*6,y:0,z:rune.z+3},{puzzleId,index:i,name:`${labels[i]} 문양`,description:'E · 비문의 순서로 활성화'});
  }else{
    puzzles.push({id:puzzleId,type:'relays',roomId:rune.id,target:relays,required:true});
    addMark('clue','light-clue',{x:rune.x-6,y:0,z:rune.z-6},{name:'등불 배선도',description:`왼쪽부터 ${relays.map(on=>on?'켜짐':'꺼짐').join(' / ')}으로 맞추세요. E로 각 스위치를 켜거나 끌 수 있습니다.`});
    for(let i=0;i<relays.length;i++)addMark('lever',`lever-${i}`,{x:rune.x+(i-(relays.length-1)/2)*6,y:0,z:rune.z+3},{puzzleId,index:i,name:`${i+1}번 등불 스위치`,description:'E · 켜기 / 끄기'});
  }
  if(plates){
    const r=room('weights'),pid=ns('weight-seal'),targets=[];
    for(let i=0;i<plates;i++){
      const z=r.z+(plates===2?(i?4:-4):0),bid=ns(`stone-${i}`),target={x:r.x+1.2,y:0,z};
      blocks.push({...box(bid,r.x-3,z,1.6,1.6,1.6,0,'block'),vx:0,vy:0,vz:0,grounded:true,puzzleId:pid});
      targets.push({...target,blockId:bid});
      addMark('plate',`plate-${i}`,target,{puzzleId:pid,name:'돌의 받침',description:'돌을 금빛 받침 중앙에 놓으세요.'});
    }
    puzzles.push({id:pid,type:'plate',roomId:r.id,targets,required:true});
    addMark('reset','reset-stones',{x:r.x-7,y:0,z:r.z-7},{puzzleId:pid,name:'돌 되돌리기',description:'무료로 돌을 제자리로 돌립니다. 돌 서쪽에서 Q로 동쪽 받침을 향해 미세요.'});
    addMark('clue','weight-clue',{x:r.x+6,y:0,z:r.z-6},{name:'바람과 무게',description:plates===2?'두 돌을 각각 금빛 받침에 놓으세요. 각 돌의 서쪽 3m에서 Q.':'돌 서쪽 3m에서 Q. 바람이 돌을 동쪽 금빛 받침으로 밀어냅니다.'});
  }
  const ascent=room('ascent');
  for(const [offset,top] of [[-3,1.4],[1,2.8]])floors.push(box(ns(`jump-${top}`),ascent.x+(jumpAxis==='x'?offset:0),ascent.z+(jumpAxis==='z'?offset:0),jumpAxis==='x'?4:20,jumpAxis==='z'?4:20,top,0,'platform'));
  addMark('clue','jump-clue',{x:ascent.x-6,y:0,z:ascent.z-7},{name:'끊어진 계단',description:'Space로 낮은 돌단, 높은 돌단을 차례로 오르세요. 기본 도약만으로 건널 수 있습니다.'});
  for(const [index,[from,to,requirement]] of links.entries()){
    const a=room(from),b=room(to),vertical=a.x===b.x,length=distance(a,b)-20;
    const x=(a.x+b.x)/2,z=(a.z+b.z)/2;
    floors.push(box(ns(`corridor-${index}`),x,z,vertical?6:length,vertical?length:6,.5,-.5,'floor'));
    for(const sign of [-1,1])walls.push(box(ns(`corridor-${index}-wall-${sign}`),x+(vertical?sign*3.5:0),z+(vertical?0:sign*3.5),vertical?1:length,vertical?length:1));
    const requires=requirement==='guard'?spawns.filter(e=>e.roomId===guard.id).map(e=>e.id):requirement==='lights'?[puzzleId]:requirement==='weights'?[ns('weight-seal')]:[];
    if(requires.length)doors.push({...box(ns(`door-${index}`),x,z,vertical?6:1,vertical?1:6,8,0,'door'),name:'봉인의 문',description:requirement==='guard'?'파수꾼의 방에 남은 적을 물리치세요.':requirement==='lights'?'문양실의 장치를 해결하세요.':'돌을 금빛 받침에 놓으세요.',requires,from:a.id,to:b.id});
  }
  addMark('exit','entry-exit',{x:0,y:0,z:-6},{name:'지상으로 돌아가기',description:'E · 입구로 나가기'});
  addMark('exit','boss-exit',{x:boss.x,y:0,z:boss.z+7},{name:'귀환의 빛',description:'E · 던전 입구로 돌아가기',afterClear:true});
  for(const floor of floors.filter(f=>f.kind==='floor'))walls.push({...floor,id:`${floor.id}:ceiling`,y:8,h:.35,kind:'ceiling'});
  return {id,name,description,relicId:`relic-${biome}`,entry:{x:0,y:0,z:-4},bounds:{minX:Math.min(...rooms.map(r=>r.x))-11,maxX:Math.max(...rooms.map(r=>r.x))+11,minZ:-11,maxZ:Math.max(...rooms.map(r=>r.z))+11},rooms,floors,walls,doors,props,landmarks,spawns,puzzles,blocks,links:links.map(([a,b])=>[room(a).id,room(b).id]),jumpAxis};
}

export const DUNGEONS=freeze([
  layout({biome:'sunfields',name:'씨앗빛 지하수로',description:'문양의 기억과 바람의 무게를 잇는 오래된 수로.',family:'bulwark',sequence:[0,1,2],plates:1,positions:{entry:[0,0],guard:[0,32],runes:[32,32],weights:[64,32],ascent:[64,64],boss:[64,96],treasure:[32,64]},links:[['entry','guard'],['guard','runes','guard'],['runes','weights','lights'],['weights','ascent','weights'],['ascent','boss'],['runes','treasure']]}),
  layout({biome:'canyon',name:'메아리 채굴장',description:'지그재그 갱도를 돌아 두 등불의 전력을 복구하세요.',family:'tempest',relays:[true,true],plates:0,jumpAxis:'x',positions:{entry:[0,0],ascent:[32,0],guard:[64,0],runes:[64,32],boss:[32,32],treasure:[96,0]},links:[['entry','ascent'],['ascent','guard'],['guard','runes','guard'],['runes','boss','lights'],['guard','treasure']]}),
  layout({biome:'mistwood',name:'뿌리의 기억전당',description:'갈라진 뿌리 회랑에서 역순의 기억과 두 돌의 균형을 찾으세요.',family:'thorn',sequence:[2,0,1],plates:2,jumpAxis:'x',positions:{entry:[0,0],runes:[0,32],guard:[32,32],weights:[64,32],ascent:[96,32],boss:[128,32],treasure:[0,64]},links:[['entry','runes'],['runes','guard','lights'],['guard','weights','guard'],['weights','ascent','weights'],['ascent','boss'],['runes','treasure']]}),
  layout({biome:'alpine',name:'서리별 관측소',description:'엇갈린 등불과 얼어붙은 돌단 너머 별의 봉인을 지키는 곳.',family:'tide',relays:[true,false,true],plates:1,positions:{entry:[0,0],weights:[32,0],guard:[64,0],ascent:[64,32],runes:[64,64],boss:[32,64],treasure:[96,0]},links:[['entry','weights'],['weights','guard','weights'],['guard','ascent','guard'],['ascent','runes'],['runes','boss','lights'],['guard','treasure']]}),
]);

const catalog=id=>DUNGEONS.find(d=>d.id===id);
const current=s=>catalog(s?.expedition?.active?.id);
const newProgress=()=>({killed:[],solved:[],opened:[],claimed:false});
const progress=(s,d)=>s.expedition.progress[d.id]??=newProgress();
const has=(p,id)=>p.killed.includes(id)||p.solved.includes(id);
const completed=(d,p)=>d.spawns.filter(e=>e.required).every(e=>p.killed.includes(e.id))&&d.puzzles.filter(q=>q.required).every(q=>p.solved.includes(q.id));
const activeFor=d=>({id:d.id,roomId:d.rooms[0].id,sequenceSteps:{},relayStates:{},plateCharges:{},blocks:d.blocks.map(b=>({...b}))});
export const initExpedition=()=>({active:null,progress:{}});

export function validateExpedition(raw){
  const result=initExpedition();if(!raw||typeof raw!=='object')return result;
  const allow=(input,list)=>Array.isArray(input)?[...new Set(input.filter(id=>typeof id==='string'&&list.includes(id)))].slice(0,list.length):[];
  for(const d of DUNGEONS){
    const saved=raw.progress?.[d.id];if(!saved||typeof saved!=='object')continue;
    const p={killed:allow(saved.killed,d.spawns.map(e=>e.id)),solved:allow(saved.solved,d.puzzles.map(q=>q.id)),opened:allow(saved.opened,d.landmarks.filter(l=>l.kind==='chest').map(l=>l.id)),claimed:false};
    p.opened=p.opened.filter(id=>d.landmarks.find(l=>l.id===id).requires.every(required=>has(p,required)));
    p.claimed=saved.claimed===true&&completed(d,p);result.progress[d.id]=p;
  }
  const d=catalog(raw.active?.id);if(d){result.active=activeFor(d);result.progress[d.id]??=newProgress();}
  return result;
}
export const dungeonCleared=(s,id)=>!!catalog(id)&&s?.expedition?.progress?.[id]?.claimed===true;
export function dungeonGeometry(s){
  const d=current(s);if(!d)return null;const p=s.expedition.progress[d.id]||newProgress(),active=s.expedition.active;
  const landmarks=d.landmarks.filter(l=>!l.afterClear||p.claimed).map(l=>{
    const q=d.puzzles.find(q=>q.id===l.puzzleId),solved=!!q&&p.solved.includes(q.id);
    const lit=solved||(q?.type==='sequence'&&q.order.indexOf(l.index)<(active.sequenceSteps?.[q.id]||0)&&q.order.includes(l.index))||
      (q?.type==='relays'&&!!active.relayStates?.[q.id]?.[l.index])||(q?.type==='plate'&&active.plateCharges?.[q.id]>0);
    return {...l,solved,active:!!lit,opened:p.opened.includes(l.id)};
  });
  return {id:d.id,name:d.name,rooms:d.rooms,floors:d.floors,walls:d.walls,props:d.props,landmarks,doors:d.doors.map(door=>({...door,open:door.requires.every(id=>has(p,id))}))};
}
export function dungeonFloor(s,x,z){const d=current(s);return d?d.floors.filter(f=>inside({x,z},f)).reduce((floor,f)=>Math.max(floor,f.y+f.h),-12):-12;}
export const dungeonBounds=s=>current(s)?.bounds||{minX:-150,maxX:150,minZ:-150,maxZ:150};
export function dungeonSolids(s,x,z,r=6){
  const g=dungeonGeometry(s);if(!g)return [];
  return [...g.walls,...g.props,...g.floors.filter(f=>f.kind==='platform'),...g.doors.filter(d=>!d.open)].filter(b=>inside({x,z},b,r));
}

export function enterDungeon(s,id,hooks={}){
  const d=catalog(id),entrance=DUNGEON_ENTRANCES.find(e=>e.id===id);
  if(s.mode!=='playing'||s.expedition?.active)return fail('지상에서 던전 입구로 다가가세요.');
  if(!d||!entrance||![s.player.x,s.player.y,s.player.z].every(Number.isFinite)||distance(s.player,entrance)>4.5||Math.abs(s.player.y-entrance.y)>3)return fail('던전 입구 가까이에서 E를 누르세요.');
  if(s.village?.raid?.status==='active')return fail('진행 중인 마을 습격을 먼저 막아야 합니다.');
  if(s.enemies?.some(e=>e.hp>0&&distance(e,s.player)<15&&Math.abs(e.y-s.player.y)<4))return fail('주변의 적을 처리한 뒤 입장하세요.');
  if(typeof hooks.transition!=='function')return fail('장면 전환을 준비하지 못했습니다.');
  s.expedition??=initExpedition();s.expedition.active=activeFor(d);progress(s,d);
  hooks.transition('enter',{...d.entry});hooks.toast?.(`${d.name} · 비문과 방의 장치를 살펴보세요.`);return {ok:true,id};
}
export function leaveDungeon(s,hooks={}){
  const d=current(s);if(!d||s.mode!=='playing')return fail('현재 던전에 있지 않습니다.');
  const exit=d.landmarks.find(l=>l.kind==='exit'&&(!l.afterClear||dungeonCleared(s,d.id))&&near(s.player,l));
  if(!exit)return fail('입구 또는 봉인 해제 뒤 나타나는 귀환의 빛에서 나갈 수 있습니다.');
  if(typeof hooks.transition!=='function')return fail('장면 전환을 준비하지 못했습니다.');
  for(const e of s.enemies||[])if(e.hp<=0)recordDungeonKill(s,e,hooks);
  const entrance=DUNGEON_ENTRANCES.find(e=>e.id===d.id);s.expedition.active=null;
  hooks.transition('leave',{x:entrance.x,y:entrance.y,z:entrance.z-5});return {ok:true,id:d.id};
}
function availableLandmarks(s,d){
  const p=progress(s,d);return [...d.landmarks.filter(l=>!l.afterClear||p.claimed),...d.doors.filter(door=>!door.requires.every(id=>has(p,id))).map(door=>({...door,kind:'door'}))];
}
export function dungeonInteraction(s){
  const d=current(s);if(!d)return null;const p=progress(s,d);
  const targets=availableLandmarks(s,d).filter(l=>near(s.player,l)).sort((a,b)=>distance(s.player,a)-distance(s.player,b));
  const l=targets[0];if(!l)return null;
  let description=l.description;
  if(l.puzzleId&&p.solved.includes(l.puzzleId))description='장치가 풀렸습니다. 열린 문으로 이동하세요.';
  if(l.kind==='chest'&&p.opened.includes(l.id))description='이미 가져간 보관함입니다.';
  if(l.kind==='lever'&&!p.solved.includes(l.puzzleId))description=`현재 ${s.expedition.active.relayStates[l.puzzleId]?.[l.index]?'켜짐':'꺼짐'} · E로 전환`;
  return {...l,description,action:'interact',payload:{id:l.id}};
}
function solve(s,d,q,hooks){
  const p=progress(s,d);if(p.solved.includes(q.id))return;
  p.solved.push(q.id);hooks.toast?.('봉인이 풀렸습니다. 연결된 문이 열립니다.');
  hooks.effect?.('reward',s.player,{power:3,life:1});
}
export function dungeonAction(s,action,payload={},hooks={}){
  if(action==='exit')return leaveDungeon(s,hooks);
  const d=current(s);if(!d||s.mode!=='playing'||action!=='interact')return fail('지금 사용할 수 없는 행동입니다.');
  const l=availableLandmarks(s,d).find(l=>l.id===payload.id);
  if(!l||!near(s.player,l))return fail('장치 가까이에서 E를 누르세요.');
  const p=progress(s,d),active=s.expedition.active,q=d.puzzles.find(q=>q.id===l.puzzleId);
  if(l.kind==='exit')return leaveDungeon(s,hooks);
  if(l.kind==='clue'||l.kind==='door'||l.kind==='plate'){hooks.toast?.(l.description);return {ok:true,message:l.description};}
  if(l.kind==='chest'){
    if(p.opened.includes(l.id))return fail('이미 보상을 받았습니다.');
    if(!l.requires.every(id=>has(p,id)))return fail('보관실의 적을 먼저 물리치세요.');
    p.opened.push(l.id);hooks.rewardMaterials?.({...l.reward});hooks.toast?.('보관함에서 여행 물자를 얻었습니다.');return {ok:true,reward:true};
  }
  if(!q)return fail('알 수 없는 장치입니다.');
  if(l.kind==='reset'){
    for(const original of d.blocks.filter(b=>b.puzzleId===q.id)){
      const block=active.blocks.find(b=>b.id===original.id);if(block)Object.assign(block,original);
    }
    active.plateCharges[q.id]=0;hooks.toast?.(l.description);return {ok:true,reset:true};
  }
  if(p.solved.includes(q.id))return {ok:true,solved:true};
  if(q.type==='sequence'){
    const step=active.sequenceSteps[q.id]||0;
    active.sequenceSteps[q.id]=q.order[step]===l.index?step+1:0;
    if(active.sequenceSteps[q.id]===q.order.length)solve(s,d,q,hooks);
    else hooks.toast?.(active.sequenceSteps[q.id]?`${active.sequenceSteps[q.id]} / ${q.order.length} 문양이 빛납니다.`:'순서가 어긋났습니다. 비문을 읽고 첫 문양부터 다시 시작하세요.');
  }else if(q.type==='relays'){
    const states=active.relayStates[q.id]??=q.target.map(()=>false);states[l.index]=!states[l.index];
    if(states.every((value,i)=>value===q.target[i]))solve(s,d,q,hooks);
    else hooks.toast?.(`등불 ${states.map(on=>on?'켜짐':'꺼짐').join(' / ')}`);
  }
  return {ok:true,solved:p.solved.includes(q.id)};
}

export function recordDungeonKill(s,e,hooks={}){
  const d=current(s);if(!d||e?.dungeonId!==d.id||!Number.isFinite(e.hp)||e.hp>0)return false;
  const authored=d.spawns.find(spawn=>spawn.id===e.id&&spawn.type===e.type);if(!authored)return false;
  const p=progress(s,d);if(p.killed.includes(e.id))return false;
  p.killed.push(e.id);hooks.rewardXP?.(e.type==='boss'?80:10);return true;
}
function reachableRooms(d,p){
  const reached=new Set([d.rooms[0].id]);let changed=true;
  while(changed){changed=false;for(const [a,b] of d.links){
    const door=d.doors.find(door=>door.from===a&&door.to===b||door.from===b&&door.to===a);
    if(door&&!door.requires.every(id=>has(p,id)))continue;
    if(reached.has(a)&&!reached.has(b)){reached.add(b);changed=true;}
    if(reached.has(b)&&!reached.has(a)){reached.add(a);changed=true;}
  }}return reached;
}
function updateBlocks(s,d,dt,hooks){
  const active=s.expedition.active,p=progress(s,d);
  for(const b of active.blocks){
    if(![b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite)||b.y<-6){Object.assign(b,d.blocks.find(original=>original.id===b.id));continue;}
    hooks.move?.(b,b.vx*dt,b.vz*dt,.8);hooks.ground?.(b,dt);b.vx*=Math.exp(-2.8*dt);b.vz*=Math.exp(-2.8*dt);
  }
  for(const q of d.puzzles.filter(q=>q.type==='plate'&&!p.solved.includes(q.id))){
    const resting=q.targets.every(target=>{
      const b=active.blocks.find(b=>b.id===target.blockId);return b&&distance(b,target)<.85&&Math.abs(b.y-target.y)<.2&&Math.hypot(b.vx,b.vz)<.7;
    });
    active.plateCharges[q.id]=resting?(active.plateCharges[q.id]||0)+dt:0;
    if(active.plateCharges[q.id]>=.6)solve(s,d,q,hooks);
  }
}
export function tickDungeon(s,dt,hooks={}){
  const d=current(s);if(!d||s.mode!=='playing'||!Number.isFinite(dt)||dt<=0||dt>1)return;
  const p=progress(s,d);for(const e of s.enemies||[])if(e.hp<=0)recordDungeonKill(s,e,hooks);
  updateBlocks(s,d,dt,hooks);
  const room=d.rooms.find(r=>inside(s.player,r));if(room)s.expedition.active.roomId=room.id;
  const reached=reachableRooms(d,p);
  for(const spawn of d.spawns){
    if(p.killed.includes(spawn.id)||s.enemies?.some(e=>e.id===spawn.id)||!reached.has(spawn.roomId))continue;
    const room=d.rooms.find(r=>r.id===spawn.roomId);if(!inside(s.player,room,4))continue;
    hooks.spawn?.(spawn.type,spawn.x,spawn.z,{...spawn,maxHp:spawn.hp,homeX:spawn.x,homeY:spawn.y,homeZ:spawn.z,dungeonId:d.id});
  }
  if(!p.claimed&&completed(d,p)){
    p.claimed=true;hooks.rewardXP?.(120);hooks.rewardMaterials?.({wood:10,stone:8,food:4,crystals:8});hooks.grantRelic?.(d.relicId);
    hooks.toast?.(`${d.name} 봉인 해제! 유물을 얻었습니다. 귀환의 빛으로 돌아가세요.`);hooks.effect?.('reward',s.player,{life:1.4,power:8});
  }
}
export function dungeonObjective(s){
  const d=current(s);if(!d)return null;const p=progress(s,d);
  if(p.claimed)return `${d.name} 완료 · 보관실을 탐험하거나 귀환의 빛에서 E`;
  const room=d.rooms.find(r=>r.id===s.expedition.active.roomId);
  const living=d.spawns.filter(e=>e.roomId===room?.id&&!p.killed.includes(e.id));
  if(living.length)return `${room.name} · 남은 수호자 ${living.length}마리`;
  const q=d.puzzles.find(q=>q.roomId===room?.id&&!p.solved.includes(q.id));
  if(q)return `${room.name} · ${q.type==='plate'?'돌의 서쪽에서 Q로 받침에 밀기 · 입구 장치에서 무료 초기화':'비문의 지시에 따라 장치에서 E'}`;
  return `${d.name} · ${room?.name||'연결 회랑'} · 열린 문을 따라 다음 방으로 이동`;
}
