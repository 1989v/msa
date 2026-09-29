// Natural local-scene geometry. Shared surfaces are consumed by physics and GL.
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const box=(id,x,z,w,d,y,h=.6,kind='floor')=>({id,x,z,w,d,y,h,kind});
export function floorSurface(f,x,z){
  if(f.kind!=='ramp')return f.y+f.h;
  const t=Math.max(0,Math.min(1,f.axis==='x'?(x-f.x+f.w/2)/f.w:(z-f.z+f.d/2)/f.d));
  return f.low+(f.high-f.low)*t;
}
function cavern(biome,name,positions,wind){
  const id=`cave-${biome}`,ns=n=>`${id}:${n}`,rooms=positions.map(([kind,x,z,y,w=24,d=24])=>({id:ns(kind),kind,x,z,y,w,d,name:({entry:'햇빛이 드는 입구',basin:wind?'바람이 고인 저지대':'이슬 웅덩이',gallery:wind?'천장의 광맥':'높은 뿌리 선반',boss:'깊은 바람의 둥지',treasure:'옆굴의 여행 기록'})[kind]}));
  const room=k=>rooms.find(r=>r.kind===k),links=[['entry','basin'],['basin','gallery'],['gallery','boss'],['basin','treasure']],floors=[],walls=[],props=[],doors=[],landmarks=[],spawns=[],puzzles=[],blocks=[];
  const add=(kind,key,x,y,z,extra={})=>landmarks.push({id:ns(key),kind,x,y,z,name:key,description:'',...extra});
  function wall(key,ax,az,bx,bz,y,h=8){walls.push(box(ns(key),(ax+bx)/2,(az+bz)/2,Math.abs(bx-ax)||.8,Math.abs(bz-az)||.8,y,h,'rockwall'));}
  for(const r of rooms){
    floors.push(box(`${r.id}:floor-a`,r.x,r.z,r.w-8,r.d,r.y-.6));
    for(const side of [-1,1])floors.push(box(`${r.id}:floor-wing-${side}`,r.x+side*(r.w/2-2),r.z,4,r.d-8,r.y-.6));
    walls.push(box(`${r.id}:ceiling-a`,r.x,r.z,r.w-8,r.d,r.y+8,.7,'ceiling'),box(`${r.id}:ceiling-b`,r.x,r.z,r.w,r.d-8,r.y+8,.7,'ceiling'));
    const hw=r.w/2,hd=r.d/2;
    for(const [axis,sign] of [['x',-1],['x',1],['z',-1],['z',1]]){
      const along=axis==='x'?hd-4:hw-4;
      const connected=links.some(([a,b])=>{const other=a===r.kind?room(b):b===r.kind?room(a):null;return other&&(axis==='x'?other.z===r.z&&Math.sign(other.x-r.x)===sign:other.x===r.x&&Math.sign(other.z-r.z)===sign);});
      for(const [a,b] of connected?[[-along,-4.5],[4.5,along]]:[[-along,along]])if(b>a){
        if(axis==='x')wall(`${r.kind}-${axis}-${sign}-${a}`,r.x+sign*hw,r.z+a,r.x+sign*hw,r.z+b,r.y);
        else wall(`${r.kind}-${axis}-${sign}-${a}`,r.x+a,r.z+sign*hd,r.x+b,r.z+sign*hd,r.y);
      }
    }
    for(const sx of [-1,1])for(const sz of [-1,1]){
      wall(`${r.kind}-corner-x-${sx}-${sz}`,r.x+sx*(hw-4),r.z+sz*(hd-4),r.x+sx*hw,r.z+sz*(hd-4),r.y);
      wall(`${r.kind}-corner-z-${sx}-${sz}`,r.x+sx*(hw-4),r.z+sz*(hd-4),r.x+sx*(hw-4),r.z+sz*hd,r.y);
    }
    // Low crystals are nonblocking; large columns are shared collision boxes.
    props.push({id:`${r.id}:crystal`,kind:'crystal',x:r.x-hw+5,y:r.y,z:r.z+hd-5});
    props.push(box(`${r.id}:column`,r.x+hw-5,r.z-hd+5,1.4,1.4,r.y,8,'column'));
    props.push({id:`${r.id}:lamp`,kind:'cave-lamp',x:r.x-3,y:r.y+.05,z:r.z-3});
  }
  for(const [index,[a,b]] of links.entries()){
    const r=room(a),t=room(b),axis=r.x===t.x?'z':'x',sign=Math.sign(t[axis]-r[axis]),rHalf=(axis==='x'?r.w:r.d)/2,tHalf=(axis==='x'?t.w:t.d)/2;
    const start=r[axis]+sign*rHalf,end=t[axis]-sign*tHalf,length=Math.abs(end-start),middle=(start+end)/2,x=axis==='x'?middle:r.x,z=axis==='z'?middle:r.z;
    const low=start<end?r.y:t.y,high=start<end?t.y:r.y;
    const floor=box(ns(`passage-${index}`),x,z,axis==='x'?length:9,axis==='z'?length:9,Math.min(low,high)-.6,Math.abs(high-low)+.6,low===high?'floor':'ramp');
    if(floor.kind==='ramp')Object.assign(floor,{axis,low,high});floors.push(floor);
    const bottom=Math.min(low,high),top=Math.max(low,high)+8;
    for(const side of [-1,1])walls.push(box(ns(`passage-wall-${index}-${side}`),x+(axis==='z'?side*4.9:0),z+(axis==='x'?side*4.9:0),axis==='x'?length:.8,axis==='z'?length:.8,bottom,top-bottom,'rockwall'));
    walls.push(box(ns(`passage-ceiling-${index}`),x,z,floor.w,floor.d,top,.6,'ceiling'));
    props.push({id:ns(`passage-lamp-${index}`),kind:'cave-lamp',x:x+(axis==='z'?-3.6:0),y:floorSurface(floor,x,z)+.05,z:z+(axis==='x'?-3.6:0)});
  }
  const entry=room('entry'),basin=room('basin'),gallery=room('gallery'),boss=room('boss'),treasure=room('treasure'),pid=ns('seal');
  add('exit','entry-exit',entry.x,entry.y,entry.z-6,{name:'지상으로 돌아가기',description:'E · 들어왔던 동굴 입구로 돌아갑니다.'});
  add('clue','entrance-clue',entry.x-5,entry.y,entry.z+3,{name:wind?'낮은 바람의 지도':'뿌리 선반의 지도',description:wind?'아래 웅덩이의 돌을 바람으로 밀어 받침에 놓으세요. 왼쪽 옆굴에는 보급품, 오른쪽 오르막에는 깊은 둥지가 있습니다.':'낮은 이슬 웅덩이와 높은 뿌리 선반의 등불을 모두 켜세요. 오른쪽 옆굴의 상자도 찾아보세요.'});
  if(wind){
    const bid=ns('wind-stone'),target={x:basin.x+1.2,y:basin.y,z:basin.z,blockId:bid};
    blocks.push({...box(bid,basin.x-3,basin.z,1.6,1.6,basin.y,1.6,'block'),vx:0,vy:0,vz:0,grounded:true,puzzleId:pid});
    puzzles.push({id:pid,type:'plate',roomId:basin.id,targets:[target],required:true});
    add('plate','wind-plate',target.x,target.y,target.z,{puzzleId:pid,name:'바람돌 받침',description:'돌 서쪽 3m에서 Q로 밀어 받침에 놓으세요.'});
    add('reset','reset-stones',basin.x-7,basin.y,basin.z-7,{puzzleId:pid,name:'바람돌 되돌리기',description:'E · 돌을 처음 위치로 돌립니다.'});
    add('clue','weight-clue',basin.x+6,basin.y,basin.z-6,{name:'바람을 가두는 돌',description:'돌의 서쪽 3m에서 Q. 돌을 금빛 받침 중앙에 놓으면 높은 광맥으로 가는 문이 열립니다.'});
  }else{
    puzzles.push({id:pid,type:'relays',roomId:basin.id,target:[true,true],required:true});
    add('lever','lower-relay',basin.x+4,basin.y,basin.z+3,{puzzleId:pid,index:0,name:'아래 웅덩이 등불',description:'E · 아래와 위의 등불을 모두 켜세요.'});
    add('lever','upper-relay',gallery.x-4,gallery.y,gallery.z+3,{puzzleId:pid,index:1,name:'높은 뿌리 등불',description:'E · 둥지의 뿌리문으로 전력을 보냅니다.'});
    add('clue','light-clue',basin.x-6,basin.y,basin.z-6,{name:'두 높이의 빛',description:'낮은 웅덩이 등불과 오르막 끝 높은 선반 등불을 모두 켜세요. 등불 사이로 이어지는 오르막은 왼쪽입니다.'});
  }
  const gateFloor=floors.find(f=>f.id===ns(wind?'passage-1':'passage-2')),gx=gateFloor.x,gz=gateFloor.z,gy=floorSurface(gateFloor,gx,gz),wide=gateFloor.d>gateFloor.w;
  doors.push({...box(ns('root-gate'),gx,gz,wide?9:.8,wide?.8:9,gy,8,'door'),name:wind?'바람의 돌문':'두 등불의 뿌리문',description:wind?'저지대 바람돌을 받침에 놓으세요.':'아래와 위의 등불을 모두 켜세요.',requires:[pid],from:wind?basin.id:gallery.id,to:wind?gallery.id:boss.id});
  spawns.push({id:ns('basin-guard'),type:wind?'wolf':'wisp',x:basin.x+4,y:basin.y,z:basin.z-2,roomId:basin.id,hp:70,required:true});
  spawns.push({id:ns('deep-guardian'),type:'boss',family:wind?'tempest':'thorn',name:wind?'층바람의 둥지지기':'이슬뿌리의 둥지지기',x:boss.x,y:boss.y,z:boss.z+1,roomId:boss.id,hp:260,required:true});
  spawns.push({id:ns('side-guard'),type:wind?'burrower':'slime',x:treasure.x+3,y:treasure.y,z:treasure.z,roomId:treasure.id,hp:65,required:false});
  add('chest','side-cache',treasure.x-4,treasure.y,treasure.z+4,{name:'옆굴 탐험가의 보급함',description:'옆굴의 파수꾼을 물리치고 열기',requires:[ns('side-guard')],reward:{wood:6,stone:8,food:4,crystals:7}});
  add('exit','deep-exit',boss.x,boss.y,boss.z+7,{name:'되돌아가는 바람',description:'E · 동굴 입구로 귀환',afterClear:true});
  return {id,name,natural:true,description:wind?'빛이 드는 입구에서 낮은 웅덩이와 높은 광맥을 잇는 바람 동굴.':'이슬 웅덩이에서 높은 뿌리 선반을 거쳐 깊은 둥지로 이어지는 동굴.',relicId:null,unlockText:wind?'공방의 수리 꾸러미 제작법':'주방의 생장 물약 제작법',entry:{x:entry.x,y:entry.y,z:entry.z-4},rooms,floors,walls,doors,props,landmarks,spawns,puzzles,blocks,links:links.map(([a,b])=>[room(a).id,room(b).id]),bounds:{minX:Math.min(...rooms.map(r=>r.x-r.w/2))-1,maxX:Math.max(...rooms.map(r=>r.x+r.w/2))+1,minZ:-13,maxZ:Math.max(...rooms.map(r=>r.z+r.d/2))+1}};
}
export const CAVES=freeze([
  cavern('canyon','바람층 동굴',[['entry',0,0,14,20,20],['basin',0,48,2],['gallery',42,48,12,20,20],['boss',42,84,12],['treasure',-36,48,2,20,20]],true),
  cavern('mistwood','이슬뿌리 동굴',[['entry',0,0,3,20,20],['basin',0,40,3],['gallery',-38,40,15,20,20],['boss',-38,78,15],['treasure',36,40,3,20,20]],false),
]);
