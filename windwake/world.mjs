// Original world. Coordinates are metres; +Y is up, +Z is north.
export const WORLD = Object.freeze({ size: 120, spawn: { x: 0, z: -72 }, waterLevel: -3, seed: 18092026 });
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hill = (x, z, cx, cz, r, h) => h * Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r));
export function heightAt(x, z) {
  let h = .65*Math.sin(x*.041)*Math.cos(z*.047) + .38*Math.sin((x+z)*.073);
  h += hill(x,z,-46,-4,24,3.2) + hill(x,z,-39,48,28,3.3) + hill(x,z,49,32,22,5.4);
  h += hill(x,z,83,65,28,12) + hill(x,z,-87,76,29,10) + hill(x,z,0,97,27,9);
  h -= hill(x,z,52,-41,21,9) + hill(x,z,27,-34,13,4) + hill(x,z,-68,25,12,4);
  return h;
}
export const PALETTE = Object.freeze({ grass:[.32,.49,.34], forest:[.25,.40,.30], sand:[.67,.63,.46], stone:[.59,.60,.51], path:[.57,.56,.40], water:[.24,.53,.56] });
export function terrainColor(x,z) {
  const h=heightAt(x,z), m=Math.sin(x*1.31+z*.79)*.018;
  let c= h < -2 ? PALETTE.sand : x < -23 && z > 20 ? PALETTE.forest : (x < -29 && z < 16 && z > -25) || h>7 ? PALETTE.stone : PALETTE.grass;
  // A worn route pulls the eye towards the first junction and distant ruins.
  if ((Math.abs(x)<2.1 && z < 3) || Math.abs(z+21-Math.sin(x*.055)*5)<1.7) c=PALETTE.path;
  return c.map(v=>v+m);
}
const ground = (x,z) => heightAt(x,z);
export const REGIONS = [
  {id:'meadow',name:'바람결 초원',x:0,z:-53,radius:38,description:'멈춘 바람을 따라, 잊힌 세 봉인을 찾아라.'},
  {id:'quarry',name:'울림의 채석장',x:-47,z:-5,radius:27,description:'무거운 돌도 바람의 울림에는 움직인다.'},
  {id:'forest',name:'속삭임 숲',x:-40,z:48,radius:28,description:'씨앗에서 하늘까지. 돌에 새겨진 이야기를 읽어라.'},
  {id:'lake',name:'유리빛 수몰지',x:52,z:-40,radius:28,description:'물 위에 남은 길. 건너편의 불빛은 아직 꺼지지 않았다.'},
  {id:'ruins',name:'부서진 천문대',x:46,z:28,radius:27,description:'끊어진 계단 너머, 가장 높은 곳에 봉인이 잠든다.'},
  {id:'grotto',name:'숨결 동굴',x:-68,z:25,radius:15,description:'그늘진 바위 아래, 길을 벗어난 자의 보물.'},
  {id:'summit',name:'고요한 하늘섬',x:0,z:27,radius:19,minY:22,description:'이곳에서 모든 바람이 멈췄다.'},
];
export const LANDMARKS = [
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
// Stable procedural decoration is generated once, independent of play RNG.
let rng=94719; const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
export const PROPS=[];
for(let i=0;i<320;i++) {
  const x=(rand()-.5)*225,z=(rand()-.5)*225,y=ground(x,z);
  if(y<-2 || LANDMARKS.some(l=>Math.hypot(l.x-x,l.z-z)<7) || PLATFORMS.some(p=>Math.abs(x-p.x)<p.w/2+3&&Math.abs(z-p.z)<p.d/2+3) || Math.abs(x)<4&&z<10) continue;
  const forest=x < -20 && z > 20;
  PROPS.push({type:forest?'tree':rand()<.33?'tree':rand()<.6?'rock':'grass',x,y,z,scale:forest?1.1+rand()*1.4:.6+rand()*1.1,yaw:rand()*Math.PI*2});
}
for(const p of PROPS.filter(p=>p.type==='tree')) OBSTACLES.push({id:`trunk-${p.x.toFixed(2)}`,x:p.x,y:p.y,z:p.z,w:.7*p.scale,h:3*p.scale,d:.7*p.scale,kind:'trunk'});
export const SOLIDS = [...PLATFORMS,...OBSTACLES];
export function supportAt(x,z,feet=Infinity,radius=.32) {
  let h=heightAt(x,z);
  for(const b of SOLIDS) if(Math.abs(x-b.x)<b.w/2+radius && Math.abs(z-b.z)<b.d/2+radius && b.y+b.h<=feet+.48) h=Math.max(h,b.y+b.h);
  return h;
}
export function regionAt(x,y,z) {
  return [...REGIONS].reverse().find(r=>Math.hypot(x-r.x,z-r.z)<r.radius && (r.minY===undefined || y>=r.minY)) || {id:'wilds',name:'이름 없는 들판',description:'길은 당신이 걷는 곳에 남는다.'};
}
