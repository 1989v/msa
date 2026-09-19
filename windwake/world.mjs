// Deterministic world data. Coordinates are metres; +Y is up, +Z is north.
export const WORLD = Object.freeze({ size:960, chunkSize:60, spawn:{x:0,z:-72}, waterLevel:-3, seed:18092026 });
export const VILLAGE = Object.freeze({x:-34,z:-86,radius:28,cellSize:4});
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hill=(x,z,cx,cz,r,h)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
export const PALETTE=Object.freeze({grass:[.32,.49,.34],forest:[.25,.40,.30],sand:[.67,.63,.46],stone:[.59,.60,.51],path:[.57,.56,.40],water:[.24,.53,.56],dune:[.79,.69,.46],autumn:[.58,.48,.31],alpine:[.63,.73,.72],lavender:[.47,.49,.62],coast:[.45,.65,.55],soil:[.40,.31,.22]});
export const BIOMES=[
  {id:'sunfields',name:'햇살구릉',x:0,z:-510,radius:300,terrain:'grass',props:['tree','flower','grass'],enemies:['slime','wolf','stalker'],family:'bulwark',bossName:'황금들판의 파수꾼',reward:'황금 이삭의 문장',rise:10,description:'풍차가 돌아가는 황금빛 언덕. 오래된 길을 따라 첫 변방의 수호자를 만나세요.'},
  {id:'dunes',name:'유리모래 사막',x:430,z:-430,radius:310,terrain:'dune',props:['rock','arch','grass'],enemies:['burrower','bomber','boar'],family:'tempest',bossName:'유리폭풍의 사자',reward:'유리모래의 왕관',rise:6,description:'창백한 모래 능선과 바위 그늘 사이, 부서진 문들이 바람의 방향을 가리킵니다.'},
  {id:'coast',name:'청옥 해안',x:650,z:0,radius:310,terrain:'coast',props:['reed','rock','tree'],enemies:['wisp','frostling','slime'],family:'tide',bossName:'조수의 노래꾼',reward:'청옥 조개의 인장',rise:5,description:'빛나는 물가와 높은 둑길. 바다로 내려가는 길에도 돌아올 자리가 있습니다.'},
  {id:'autumn',name:'붉은잎 고원',x:470,z:470,radius:310,terrain:'autumn',props:['autumn-tree','flower','rock'],enemies:['wolf','shaman','sentinel'],family:'thorn',bossName:'붉은뿌리의 군주',reward:'붉은잎의 가지',rise:17,description:'구리빛 나뭇잎 너머, 단을 이룬 언덕에 버려진 정원이 남아 있습니다.'},
  {id:'alpine',name:'서리별 산맥',x:0,z:680,radius:330,terrain:'alpine',props:['pine','rock','column'],enemies:['frostling','sentinel','charger'],family:'bulwark',bossName:'서리별 거인',reward:'서리별의 조각',rise:40,description:'완만한 고갯길이 푸른 봉우리로 이어집니다. 정상의 등불을 찾아보세요.'},
  {id:'mistwood',name:'안개수림',x:-470,z:470,radius:310,terrain:'forest',props:['pine','tree','flower'],enemies:['shaman','burrower','wisp'],family:'thorn',bossName:'안개나무의 심장',reward:'안개숲의 씨앗',rise:19,description:'큰 나무 아래 쉬어 가는 골짜기. 나무 사이의 금빛 이정표를 따라가세요.'},
  {id:'canyon',name:'메아리 협곡',x:-660,z:0,radius:310,terrain:'sand',props:['rock','arch','column'],enemies:['bomber','ranger','boar'],family:'tempest',bossName:'협곡의 천둥새',reward:'메아리의 깃털',rise:25,description:'깊은 골과 풍화된 아치. 능선의 넓은 길은 협곡을 돌아 안전하게 이어집니다.'},
  {id:'lavender',name:'별꽃 초원',x:-440,z:-460,radius:310,terrain:'lavender',props:['flower','tree','grass'],enemies:['slime','wolf','frostling'],family:'tide',bossName:'별꽃의 밤지기',reward:'별꽃의 등불',rise:8,description:'보랏빛 풀과 아늑한 움푹한 들판. 밤에도 별꽃이 길을 밝힙니다.'},
];
function legacyHeight(x,z){
  let h=.65*Math.sin(x*.041)*Math.cos(z*.047)+.38*Math.sin((x+z)*.073);
  h+=hill(x,z,-46,-4,24,3.2)+hill(x,z,-39,48,28,3.3)+hill(x,z,49,32,22,5.4);
  h+=hill(x,z,83,65,28,12)+hill(x,z,-87,76,29,10)+hill(x,z,0,97,27,9);
  h-=hill(x,z,52,-41,21,9)+hill(x,z,27,-34,13,4)+hill(x,z,-68,25,12,4);
  return h;
}
function rawOuterHeight(x,z){
  let h=3+Math.sin(x*.012)*Math.cos(z*.009)*4+Math.sin((x+z)*.025)*1.7;
  for(const b of BIOMES)h+=hill(x,z,b.x,b.z,190,b.rise);
  h-=hill(x,z,830,0,115,19)+hill(x,z,-730,90,78,32)+hill(x,z,-515,530,42,12);
  return h;
}
function baseHeight(x,z){return mix(legacyHeight(x,z),rawOuterHeight(x,z),smooth((Math.max(Math.abs(x),Math.abs(z))-120)/70));}
export function biomeAt(x,z){let best=BIOMES[0],dist=Infinity;for(const b of BIOMES){const d=(x-b.x)**2+(z-b.z)**2;if(d<dist){dist=d;best=b;}}return best;}
function biomeColor(x,z){
  // Soft, slightly wandering ecotones avoid a radial colour chart on the atlas.
  const sx=x+Math.sin(z*.012)*20,sz=z+Math.sin(x*.010)*20;
  let first=BIOMES[0],second=BIOMES[1],d1=Infinity,d2=Infinity;
  for(const b of BIOMES){const d=(sx-b.x)**2+(sz-b.z)**2;if(d<d1){second=first;d2=d1;first=b;d1=d;}else if(d<d2){second=b;d2=d;}}
  const blend=.5*(1-smooth((Math.sqrt(d2)-Math.sqrt(d1))/90)),a=PALETTE[first.terrain],b=PALETTE[second.terrain];
  return a.map((v,i)=>mix(v,b[i],blend));
}
const point=(x,z)=>({x,z});
const ring=Array.from({length:16},(_,i)=>point(Math.sin(i/16*TAU)*160,-Math.cos(i/16*TAU)*160));
const outward=b=>{const d=Math.hypot(b.x,b.z);return{x:b.x/d,z:b.z/d};};
const waypointPositions=BIOMES.map(b=>{const u=outward(b);return{id:`waypoint-${b.id}`,biomeId:b.id,name:`${b.name} · 바람의 등대`,x:b.x-u.x*45,z:b.z-u.z*45};});
const bossPositions=BIOMES.map((b,i)=>{const u=outward(b);return{id:`boss-${b.id}`,biomeId:b.id,name:b.bossName,x:b.x+u.x*60,z:b.z+u.z*60,type:'boss',family:b.family,level:1+Math.floor(i/2),reward:b.reward,final:false};});
bossPositions.push({id:'boss-frontier',biomeId:'alpine',name:'먼 바람의 왕',x:0,z:870,type:'boss',family:'tempest',level:6,reward:'새로운 지평의 주인',final:true});
const outerLocations=BIOMES.flatMap((b,i)=>{const u=outward(b),side={x:-u.z,z:u.x};return[
  {id:`resource-${b.id}`,kind:'resource',biomeId:b.id,name:`${b.name}의 ${i%2?'돌무더기':'고목'}`,x:b.x-u.x*18+side.x*12,z:b.z-u.z*18+side.z*12,material:i%2?'stone':'wood',amount:8,cooldown:90,description:'E 채집 · 시간이 흐르면 다시 자랍니다.'},
  {id:`cache-${b.id}`,kind:'chest',biomeId:b.id,name:`${b.name}의 여행 기록`,x:b.x+side.x*18,z:b.z+side.z*18,description:'먼 길을 온 여행자를 위한 재료와 경험치.'},
  {id:`trial-${b.id}`,kind:'trial',biomeId:b.id,name:`${b.name} · 바람 읽기`,x:b.x+u.x*22-side.x*35,z:b.z+u.z*22-side.z*35,challenge:['survive','discover','climb'][i%3],reward:35+i*5,description:'주변의 위협을 정리하고 전망대에서 E로 이 땅의 바람을 기록하세요.'},
];});
export const TRAILS=[];
for(let i=0;i<16;i++)TRAILS.push({id:`ring-${i}`,points:[ring[i],ring[(i+1)%16]]});
TRAILS.push({id:'south-approach',points:[point(0,-72),point(0,-120),ring[0]]});
export const TRAIL_ROUTES=BIOMES.map((b,i)=>{
  const a=(Math.atan2(b.x,-b.z)+TAU)%TAU,index=Math.round(a/TAU*16)%16;
  const direction=index<=8?1:-1,steps=index<=8?index:16-index;
  const points=[point(0,-72),point(0,-120),ring[0]];
  for(let j=1;j<=steps;j++)points.push(ring[(j*direction+16)%16]);
  points.push(point(waypointPositions[i].x,waypointPositions[i].z));
  const bossPoints=[points.at(-1),point(b.x,b.z),point(bossPositions[i].x,bossPositions[i].z)];
  TRAILS.push({id:`radial-${b.id}`,points:[ring[index],...bossPoints]});
  for(const loc of outerLocations.filter(l=>l.biomeId===b.id))TRAILS.push({id:`approach-${loc.id}`,points:[point(b.x,b.z),point(loc.x,loc.z)]});
  return{id:`route-${b.id}`,waypointId:waypointPositions[i].id,bossId:bossPositions[i].id,points,bossPoints};
});
TRAILS.push({id:'frontier-climb',points:[point(bossPositions[4].x,bossPositions[4].z),point(0,870)]});
const segments=TRAILS.flatMap(t=>t.points.slice(1).map((b,i)=>({a:t.points[i],b,ay:baseHeight(t.points[i].x,t.points[i].z),by:baseHeight(b.x,b.z)})));
// This finite authored spatial index is geometry-free; atlas sampling never touches the chunk cache.
const trailCells=new Map(),trailCellSize=60;
for(const s of segments)for(let x=Math.floor((Math.min(s.a.x,s.b.x)-18)/trailCellSize);x<=Math.floor((Math.max(s.a.x,s.b.x)+18)/trailCellSize);x++)for(let z=Math.floor((Math.min(s.a.z,s.b.z)-18)/trailCellSize);z<=Math.floor((Math.max(s.a.z,s.b.z)+18)/trailCellSize);z++){
  const key=`${x},${z}`;if(!trailCells.has(key))trailCells.set(key,[]);trailCells.get(key).push(s);
}
function trailSample(x,z){
  let distance=Infinity,y=0;
  for(const s of trailCells.get(`${Math.floor(x/trailCellSize)},${Math.floor(z/trailCellSize)}`)||[]){
    const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=clamp(((x-s.a.x)*dx+(z-s.a.z)*dz)/(dx*dx+dz*dz||1),0,1),d=Math.hypot(x-s.a.x-dx*t,z-s.a.z-dz*t);
    if(d<distance){distance=d;y=mix(s.ay,s.by,t);}
  }
  return{distance,y};
}
export function heightAt(x,z){
  let h=baseHeight(x,z);const edge=Math.max(Math.abs(x),Math.abs(z));
  if(edge>120){const path=trailSample(x,z);if(path.distance<15)h=mix(h,path.y,(1-smooth((path.distance-4)/11))*smooth((edge-120)/25));}
  const homeDistance=Math.hypot(x-VILLAGE.x,z-VILLAGE.z);
  if(homeDistance<35)h=mix(legacyHeight(VILLAGE.x,VILLAGE.z),h,smooth((homeDistance-29)/6));
  return h;
}
export function terrainColor(x,z){
  const h=heightAt(x,z),m=Math.sin(x*1.31+z*.79)*.018,edge=Math.max(Math.abs(x),Math.abs(z));
  let c=h<-2?PALETTE.sand:x<-23&&z>20?PALETTE.forest:(x<-29&&z<16&&z>-25)||h>7?PALETTE.stone:PALETTE.grass;
  if(edge>120){const outer=biomeColor(x,z),blend=smooth((edge-120)/80);c=c.map((v,i)=>mix(v,outer[i],blend));}
  if(h<-2)c=PALETTE.sand;
  if((Math.abs(x)<2.1&&z<3&&z>-125)||edge<120&&Math.abs(z+21-Math.sin(x*.055)*5)<1.7||edge>120&&trailSample(x,z).distance<2.3)c=PALETTE.path;
  if(distance({x,z},VILLAGE)<29)c=PALETTE.grass;
  return c.map(v=>v+m);
}
const ground=(x,z)=>heightAt(x,z);
export const WAYPOINTS=[{id:'home',kind:'waypoint',name:'바람이 머무는 마을',x:VILLAGE.x,z:VILLAGE.z,description:'E 마을 · 집으로 돌아오는 등불'},...waypointPositions.map(w=>({...w,kind:'waypoint',description:'E 등대 활성화 · 활성화한 등대는 지도에서 이동할 수 있습니다.'}))].map(w=>({...w,y:ground(w.x,w.z)}));
export const BOSS_SITES=bossPositions.map(b=>({...b,kind:'boss',y:ground(b.x,b.z),description:b.final?'네 변방의 승리와 마을3단계가 먼 바람의 왕을 깨웁니다.':`${b.name} · 첫 승리: ${b.reward}`}));
export const RESOURCE_NODES=[
  {id:'resource-home-wood',kind:'resource',name:'마을의 고목',x:-58,z:-82,material:'wood',amount:8,cooldown:60,description:'E 나무8 채집 · 60초 뒤 다시 채집'},
  {id:'resource-home-stone',kind:'resource',name:'마을의 돌무더기',x:-13,z:-96,material:'stone',amount:6,cooldown:60,description:'E 돌6 채집 · 60초 뒤 다시 채집'},
  {id:'resource-home-food',kind:'resource',name:'산딸기 덤불',x:-44,z:-62,material:'food',amount:3,cooldown:60,description:'E 식량3 채집 · 60초 뒤 다시 채집'},
  ...outerLocations.filter(l=>l.kind==='resource'),
].map(l=>({...l,y:ground(l.x,l.z)}));
export const REGIONS = [
  ...BIOMES,
  {id:'meadow',name:'바람결 초원',x:0,z:-53,radius:38,description:'멈춘 바람을 따라, 잊힌 세 봉인을 찾아라.'},
  {id:'quarry',name:'울림의 채석장',x:-47,z:-5,radius:27,description:'무거운 돌도 바람의 울림에는 움직인다.'},
  {id:'forest',name:'속삭임 숲',x:-40,z:48,radius:28,description:'씨앗에서 하늘까지. 돌에 새겨진 이야기를 읽어라.'},
  {id:'lake',name:'유리빛 수몰지',x:52,z:-40,radius:28,description:'물 위에 남은 길. 건너편의 불빛은 아직 꺼지지 않았다.'},
  {id:'ruins',name:'부서진 천문대',x:46,z:28,radius:27,description:'끊어진 계단 너머, 가장 높은 곳에 봉인이 잠든다.'},
  {id:'grotto',name:'숨결 동굴',x:-68,z:25,radius:15,description:'그늘진 바위 아래, 길을 벗어난 자의 보물.'},
  {id:'summit',name:'고요한 하늘섬',x:0,z:27,radius:19,minY:22,description:'이곳에서 모든 바람이 멈췄다.'},
];
export const LANDMARKS = [
  ...WAYPOINTS, ...BOSS_SITES, ...RESOURCE_NODES, ...outerLocations.filter(l=>l.kind!=='resource').map(l=>({...l,y:ground(l.x,l.z)})),
  {id:'camp',kind:'camp',name:'여행자의 모닥불',x:0,z:-69,y:ground(0,-69),description:'E 휴식 · 5 결정으로 체력 / 7 결정으로 검 강화'},
  {id:'quarry',kind:'shrine',name:'돌의 봉인',x:-49,z:-4,y:ground(-49,-4),description:'Q 울림으로 돌을 금빛 원 안에 밀어 넣으세요. 제단에서 E: 돌 되돌리기.'},
  {id:'forest',kind:'shrine',name:'숲의 봉인',x:-40,z:48,y:ground(-40,48),description:'“씨앗은 뿌리내리고, 줄기는 해를 향하며, 마침내 날개가 하늘로.” 세 돌의 이야기를 이어보세요. E로 울림을 새깁니다.'},
  {id:'ruins',kind:'shrine',name:'하늘의 봉인',x:48,z:33,y:14.1,description:'끊어진 돌계단을 점프로 올라 정상의 봉인에 E.'},
  {id:'wind',kind:'wind',name:'잠든 상승기류',x:0,z:5,y:ground(0,5),description:'세 봉인이 모이면 바람이 깨어납니다. 정상에서 북쪽 하늘섬으로 활강하세요.'},
  {id:'camp-forest',kind:'camp',name:'숲길 쉼터',x:-25,z:24,y:ground(-25,24),description:'발견한 모닥불은 지도에서 빠른 이동할 수 있습니다.'},
  {id:'camp-east',kind:'camp',name:'천문대 야영지',x:29,z:6,y:ground(29,6),description:'모닥불에서 E로 휴식하고 결정을 사용해 강화하세요.'},
  {id:'chest-meadow',kind:'chest',name:'언덕의 여행 가방',x:-13,z:-53,y:ground(-13,-53),description:'길가의 작은 선물'},
  {id:'chest-grotto',kind:'chest',name:'숨결 동굴의 보물',x:-69,z:29,y:ground(-69,29),description:'바위 그늘의 비밀'},
  {id:'chest-lake',kind:'chest',name:'가라앉은 왕관',x:60,z:-46,y:-1,description:'돌을 건너 호수 가운데로'},
  {id:'chest-north',kind:'chest',name:'바람지기의 유산',x:-3,z:76,y:ground(-3,76),description:'지도 밖으로 한 걸음'},
  {id:'chest-ruins',kind:'chest',name:'망루의 유물',x:64,z:32,y:ground(64,32),description:'천문대 뒤편 작은 탑'},
];
export const RUNES = [
  {id:'sprout',name:'새싹',symbol:'Ⅰ',x:-46,z:48},
  {id:'sun',name:'태양',symbol:'Ⅱ',x:-40,z:55},
  {id:'bird',name:'새',symbol:'Ⅲ',x:-34,z:48},
].map(r=>({...r,y:ground(r.x,r.z)}));
export const PLATE = {x:-48,z:1,y:ground(-48,1),radius:2.2};
export const BLOCK_SPAWN = {id:'resonant-stone',x:-48,z:-7,y:ground(-48,-7),w:2,h:2,d:2,vx:0,vz:0};
export const PLATFORMS = [
  // Every rise is below the unupgraded jump apex. Broad tops allow recovery.
  {id:'step-0',x:34,z:11,y:ground(34,11)-.1,w:5,h:1.4,d:5,kind:'ruin'},
  {id:'step-half',x:36,z:13,y:3.3,w:3.3,h:1.8,d:3.3,kind:'ruin'},
  {id:'step-1',x:38,z:15,y:5.1,w:4.3,h:1.8,d:4.3,kind:'ruin'},
  {id:'step-2',x:42,z:19,y:6.8,w:4.3,h:1.8,d:4.3,kind:'ruin'},
  {id:'step-3',x:46,z:23,y:8.5,w:4.3,h:1.8,d:4.3,kind:'ruin'},
  {id:'step-4',x:48,z:27,y:10.2,w:4.5,h:1.8,d:4.5,kind:'ruin'},
  {id:'observatory',x:48,z:33,y:12.3,w:11,h:1.8,d:8,kind:'ruin'},
  {id:'sky-island',x:0,z:29,y:25.5,w:29,h:2.5,d:27,kind:'sky'},
  {id:'lake-approach-0',x:19,z:-41,y:-4,w:4.2,h:2.9,d:4.2,kind:'stone'},
  {id:'lake-approach-1',x:24.5,z:-41,y:-6,w:4.2,h:4.9,d:4.2,kind:'stone'},
  {id:'lake-approach-2',x:30,z:-41,y:-7,w:4.2,h:5.9,d:4.2,kind:'stone'},
  {id:'lake-1',x:36,z:-41,y:-5,w:4.2,h:4,d:4.2,kind:'stone'},
  {id:'lake-2',x:42,z:-43,y:-7,w:4.2,h:5.7,d:4.2,kind:'stone'},
  {id:'lake-3',x:48,z:-43,y:-8,w:4.2,h:6.8,d:4.2,kind:'stone'},
  {id:'lake-4',x:54,z:-45,y:-7,w:4.2,h:5.8,d:4.2,kind:'stone'},
  {id:'lake-end',x:60,z:-46,y:-6,w:5.5,h:5,d:5.5,kind:'stone'},
];
export const OBSTACLES = [
  {id:'grotto-left',x:-74,z:27,y:ground(-74,27),w:3,h:6,d:13,kind:'rock'},
  {id:'grotto-right',x:-63,z:27,y:ground(-63,27),w:3,h:6,d:13,kind:'rock'},
  {id:'grotto-roof',x:-68.5,z:29,y:4.8,w:14,h:3,d:11,kind:'rock'},
  {id:'wall-west',x:-56,z:0,y:ground(-56,0),w:2,h:3.6,d:15,kind:'ruin'},
  {id:'wall-east',x:-40,z:-2,y:ground(-40,-2),w:2,h:3,d:11,kind:'ruin'},
  {id:'pillar-a',x:43,z:35,y:14.1,w:1.2,h:4,d:1.2,kind:'ruin'},
  {id:'pillar-b',x:53,z:35,y:14.1,w:1.2,h:3.5,d:1.2,kind:'ruin'},
];
export const ENEMY_SPAWNS = [
  {id:'m1',type:'stalker',x:3,z:-48},{id:'m2',type:'stalker',x:-7,z:-34},
  {id:'q1',type:'charger',x:-37,z:-15},{id:'q2',type:'ranger',x:-53,z:-18},
  {id:'f1',type:'stalker',x:-28,z:39},{id:'f2',type:'ranger',x:-51,z:34},
  {id:'r1',type:'charger',x:27,z:-3},{id:'r2',type:'ranger',x:51,z:3},
  {id:'l1',type:'stalker',x:23,z:-48},{id:'n1',type:'charger',x:0,z:65},
  {id:'boss',type:'boss',x:0,z:31,y:28},
];
// Preserve the central seed stream and IDs for the original adventure.
let rng=94719;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
export const PROPS=[];
for(let i=0;i<320;i++){
  const x=(rand()-.5)*225,z=(rand()-.5)*225,y=ground(x,z);
  if(y<-2||LANDMARKS.some(l=>!['waypoint','resource','boss','trial'].includes(l.kind)&&!l.biomeId&&Math.hypot(l.x-x,l.z-z)<7)||PLATFORMS.some(p=>Math.abs(x-p.x)<p.w/2+3&&Math.abs(z-p.z)<p.d/2+3)||Math.abs(x)<4&&z<10)continue;
  const forest=x<-20&&z>20;
  const prop={id:`central-prop-${i}`,type:forest?'tree':rand()<.33?'tree':rand()<.6?'rock':'grass',x,y,z,scale:forest?1.1+rand()*1.4:.6+rand()*1.1,yaw:rand()*TAU};
  if(Math.hypot(x-VILLAGE.x,z-VILLAGE.z)>VILLAGE.radius+5)PROPS.push(prop);
}
for(const p of PROPS.filter(p=>p.type==='tree'))OBSTACLES.push({id:`trunk-${p.x.toFixed(2)}`,x:p.x,y:p.y,z:p.z,w:.7*p.scale,h:3*p.scale,d:.7*p.scale,kind:'trunk'});
export const SOLIDS=[...PLATFORMS,...OBSTACLES];
const MAX_CACHE=96,cache=new Map();let generatedChunks=0,evictedChunks=0,lastQueryCells=0,lastQueryCandidates=0;
const authoredCells=new Map(),ownerCells=new Map();
function cell(x,z){return`${Math.floor(x/WORLD.chunkSize)},${Math.floor(z/WORLD.chunkSize)}`;}
for(const box of SOLIDS){
  const owner=cell(box.x,box.z);if(!ownerCells.has(owner))ownerCells.set(owner,[]);ownerCells.get(owner).push(box);
  for(let cx=Math.floor((box.x-box.w/2)/60);cx<=Math.floor((box.x+box.w/2)/60);cx++)for(let cz=Math.floor((box.z-box.d/2)/60);cz<=Math.floor((box.z+box.d/2)/60);cz++){
    const key=`${cx},${cz}`;if(!authoredCells.has(key))authoredCells.set(key,[]);authoredCells.get(key).push(box);
  }
}
function randomFor(cx,cz){let n=(WORLD.seed^Math.imul(cx,374761393)^Math.imul(cz,668265263))>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function reserved(x,z,padding=0){
  if(Math.hypot(x-VILLAGE.x,z-VILLAGE.z)<VILLAGE.radius+6+padding)return true;
  if(trailSample(x,z).distance<4.5+padding)return true;
  return LANDMARKS.some(l=>Math.hypot(x-l.x,z-l.z)<(l.kind==='boss'?26:7)+padding);
}
function newChunk(cx,cz){
  const id=`${cx},${cz}`,props=PROPS.filter(p=>cell(p.x,p.z)===id),solids=[...(ownerCells.get(id)||[])],spawns=ENEMY_SPAWNS.filter(p=>cell(p.x,p.z)===id);
  const random=randomFor(cx,cz);
  for(let i=0;i<23;i++){
    const x=(cx+random())*60,z=(cz+random())*60,scale=.65+random()*1.1,yaw=random()*TAU;
    if(Math.max(Math.abs(x),Math.abs(z))<124||reserved(x,z,1.5))continue;
    const y=ground(x,z);if(y<WORLD.waterLevel+.4)continue;
    const biome=biomeAt(x,z),type=biome.props[Math.floor(random()*biome.props.length)],id=`prop-${cx}-${cz}-${i}`;
    props.push({id,type,x,y,z,scale,yaw,biomeId:biome.id});
    if(type.includes('tree')||type==='pine')solids.push({id:`solid-${id}`,x,y,z,w:.7*scale,h:3*scale,d:.7*scale,kind:'trunk'});
    else if(type==='rock')solids.push({id:`solid-${id}`,x,y,z,w:1.7*scale,h:.9*scale,d:1.7*scale,kind:'rock'});
  }
  // Two persistent encounter slots per outer chunk keep local AI bounded at source.
  for(let i=0;i<2;i++){
    const x=(cx+.18+random()*.64)*60,z=(cz+.18+random()*.64)*60;
    if(Math.max(Math.abs(x),Math.abs(z))<130||reserved(x,z,4)||ground(x,z)<WORLD.waterLevel+1)continue;
    const biome=biomeAt(x,z);
    spawns.push({id:`wild-${cx}-${cz}-${i}`,type:biome.enemies[Math.floor(random()*biome.enemies.length)],x,z,y:ground(x,z),biomeId:biome.id});
  }
  spawns.push(...BOSS_SITES.filter(b=>cell(b.x,b.z)===id));
  return{id,cx,cz,props,solids,spawns};
}
export function getChunk(cx,cz){
  if(!Number.isInteger(cx)||!Number.isInteger(cz)||cx< -16||cx>15||cz< -16||cz>15)return{id:`${cx},${cz}`,cx,cz,props:[],solids:[],spawns:[]};
  const id=`${cx},${cz}`;
  if(cache.has(id)){const chunk=cache.get(id);cache.delete(id);cache.set(id,chunk);return chunk;}
  const chunk=newChunk(cx,cz);cache.set(id,chunk);generatedChunks++;
  while(cache.size>MAX_CACHE){cache.delete(cache.keys().next().value);evictedChunks++;}
  return chunk;
}
export function querySolids(x,z,radius=6){
  lastQueryCells=0;lastQueryCandidates=0;
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0)return[];
  radius=Math.min(radius,180);const found=new Map();
  // Procedural extents are ≤1.5m; the neighbor band includes owners across an edge.
  const minX=Math.max(-16,Math.floor((x-radius-2)/60)),maxX=Math.min(15,Math.floor((x+radius+2)/60)),minZ=Math.max(-16,Math.floor((z-radius-2)/60)),maxZ=Math.min(15,Math.floor((z+radius+2)/60));
  for(let cx=minX;cx<=maxX;cx++)for(let cz=minZ;cz<=maxZ;cz++){
    lastQueryCells++;const key=`${cx},${cz}`,chunk=getChunk(cx,cz);
    for(const b of [...chunk.solids,...(authoredCells.get(key)||[])]){lastQueryCandidates++;if(Math.abs(x-b.x)<=radius+b.w/2&&Math.abs(z-b.z)<=radius+b.d/2)found.set(b.id,b);}
  }
  return[...found.values()];
}
export function spawnsNear(x,z,radius=110){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0)return[];
  radius=Math.min(radius,180);const found=[];
  for(let cx=Math.max(-16,Math.floor((x-radius)/60));cx<=Math.min(15,Math.floor((x+radius)/60));cx++)for(let cz=Math.max(-16,Math.floor((z-radius)/60));cz<=Math.min(15,Math.floor((z+radius)/60));cz++){
    for(const spawn of getChunk(cx,cz).spawns)if(Math.hypot(spawn.x-x,spawn.z-z)<=radius)found.push(spawn);
  }
  return found.sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z)||a.id.localeCompare(b.id));
}
export function worldStats(){return{cachedChunks:cache.size,maxCachedChunks:MAX_CACHE,generatedChunks,evictedChunks,lastQueryCells,lastQueryCandidates};}
export function supportAt(x,z,feet=Infinity,radius=.32){let h=heightAt(x,z);for(const b of querySolids(x,z,radius))if(Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius&&b.y+b.h<=feet+.48)h=Math.max(h,b.y+b.h);return h;}
export function regionAt(x,y,z){return[...REGIONS].reverse().find(r=>Math.hypot(x-r.x,z-r.z)<r.radius&&(r.minY===undefined||y>=r.minY))||{id:'wilds',name:'변방의 길',description:'금빛 등대를 따라 새로운 땅으로 나아가세요.'};}
