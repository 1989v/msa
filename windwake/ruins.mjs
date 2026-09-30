// Crossroads architecture is authored independently of the classic room pipeline.
// All decks occupy disjoint XZ interiors; sloped bridges share floorSurface.
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
function ruin(theme,positions,connections){
  const id=`dungeon-${theme}`,ns=n=>`${id}:${n}`,tide=theme==='tide';
  const rooms=positions.map(([kind,x,z,y,w,d,name])=>({id:ns(kind),kind,x,z,y,w,d,name}));
  const get=k=>rooms.find(r=>r.kind===k),floors=[],walls=[],props=[],doors=[],landmarks=[],spawns=[];
  const box=(key,x,z,w,d,y,h,kind)=>({id:ns(key),x,z,w,d,y,h,kind});
  for(const r of rooms){
    floors.push(box(`${r.kind}-deck`,r.x,r.z,r.w,r.d,r.y-.6,.6,'floor'));
    for(const [axis,sign] of [['x',-1],['x',1],['z',-1],['z',1]]){
      const horizontal=axis==='x',half=(horizontal?r.d:r.w)/2;
      const connected=connections.some(([a,b])=>{const o=a===r.kind?get(b):b===r.kind?get(a):null;return o&&(horizontal?o.z===r.z&&Math.sign(o.x-r.x)===sign:o.x===r.x&&Math.sign(o.z-r.z)===sign);});
      for(const [lo,hi] of connected?[[-half,-4],[4,half]]:[[-half,half]])walls.push(box(`${r.kind}-${axis}-${sign}-${lo}`,r.x+(horizontal?sign*r.w/2:(lo+hi)/2),r.z+(horizontal?(lo+hi)/2:sign*r.d/2),horizontal?.5:hi-lo,horizontal?hi-lo:.5,r.y,tide?2.6:.95,tide?'sluice-wall':'terrace-rail'));
    }
    props.push(box(`${r.kind}-pillar`,r.x-r.w/2+2,r.z-r.d/2+2,1.1,1.1,r.y,tide?5:7,tide?'sluice-pillar':'canopy-post'));
  }
  const pid=ns('seal');
  connections.forEach(([a,b,gate],i)=>{
    const r=get(a),s=get(b),axis=r.x===s.x?'z':'x',sign=Math.sign(s[axis]-r[axis]),start=r[axis]+sign*(axis==='x'?r.w:r.d)/2,end=s[axis]-sign*(axis==='x'?s.w:s.d)/2;
    const length=Math.abs(end-start),mid=(start+end)/2,low=start<end?r.y:s.y,high=start<end?s.y:r.y;
    const f=box(`bridge-${i}`,axis==='x'?mid:r.x,axis==='z'?mid:r.z,axis==='x'?length:8,axis==='z'?length:8,Math.min(low,high)-.6,.6,low===high?'floor':'ramp');
    if(low!==high)Object.assign(f,{axis,low,high});floors.push(f);
    // Short rail segments follow the actual ramp instead of hiding its lower end
    // behind a full-height rectangle. Their solids and rendering share these boxes.
    const segments=tide?1:Math.ceil(length/3),railLength=length/segments;
    for(const side of [-1,1])for(let k=0;k<segments;k++){
      const a=low+(high-low)*k/segments,b=low+(high-low)*(k+1)/segments,offset=-length/2+railLength*(k+.5);
      walls.push(box(`bridge-rail-${i}-${side}-${k}`,f.x+(axis==='x'?offset:side*4.25),f.z+(axis==='z'?offset:side*4.25),axis==='x'?railLength:.5,axis==='z'?railLength:.5,Math.min(a,b),Math.abs(b-a)+(tide?2.6:.95),tide?'sluice-wall':'terrace-rail'));
    }
    if(gate)doors.push({...box('seal-gate',f.x,f.z,axis==='x'?.7:8,axis==='z'?.7:8,(low+high)/2,8,'door'),name:'유적의 봉인',description:'세 장치의 순서를 완성하세요.',requires:[pid],from:r.id,to:s.id});
  });
  const mark=(kind,key,r,dx=0,dz=0,extra={})=>landmarks.push({id:ns(key),kind,x:r.x+dx,y:r.y,z:r.z+dz,name:key,description:'',...extra});
  const entry=get('entry'),lower=get('lower'),upper=get('upper'),boss=get('boss'),treasure=get('treasure');
  const puzzles=[{id:pid,type:tide?'timed-relay':'sequence',roomId:lower.id,order:[0,1,2],...(tide?{limitFrames:1800}:{}),required:true}];
  for(const [index,r] of [lower,upper,get('crown')||upper].entries())mark('rune',`node-${index}`,r,tide&&index===2?5:0,index===1?-2:2,{puzzleId:pid,index,name:(tide?['밀물 시작','물길 중계','등대 마침']:['뿌리 문양','가지 문양','하늘 문양'])[index],description:tide?'E · 시작 → 중계 → 마침, 30초 안에 연결':'E · 뿌리 → 가지 → 하늘 순서'});
  mark('clue','seal-clue',entry,-4,3,{name:tide?'수문지기의 기록':'수관의 기억',description:tide?'아래 수문의 시작, 높은 수로의 중계, 그 동쪽 마침 장치를 30초 안에 만지세요. 실패하면 시작에서 무료 재시도. 곁가지 보급함은 선택입니다.':'뿌리(낮은 뜰) → 가지(서쪽 선반) → 하늘(높은 뜰). 오르막을 걸어 연결하세요. 동쪽 발코니 보급함은 선택입니다.'});
  spawns.push({id:ns('lower-guard'),type:tide?'sentinel':'wolf',x:lower.x+3,y:lower.y,z:lower.z+3,roomId:lower.id,hp:65,required:true},
    {id:ns('guardian'),type:'boss',family:tide?'tide':'thorn',x:boss.x,y:boss.y,z:boss.z+2,roomId:boss.id,hp:280,required:true},
    {id:ns('optional-guard'),type:tide?'burrower':'wisp',x:treasure.x+3,y:treasure.y,z:treasure.z,roomId:treasure.id,hp:60,required:false});
  mark('chest','optional-cache',treasure,-4,3,{name:'곁가지 보급함',description:'발코니 파수꾼을 물리치고 E',requires:[ns('optional-guard')],reward:{food:4,wood:8,crystals:7}});
  mark('chest','archive-cache',treasure,-4,-3,{name:'봉인된 여행 기록',description:'유적의 봉인을 모두 풀면 열리는 기록 보관함',afterClear:true,requires:[],reward:{stone:10,crystals:12}});
  mark('exit','entry-exit',entry,0,-5,{name:'지상으로',description:'E · 입구로 돌아가기'});
  mark('exit','return',boss,0,6,{name:'귀환의 빛',description:'E · 마을 곁 유적 입구로 돌아가기',afterClear:true});
  return {id,expansion:'crossroads',theme,name:tide?'밀물빛 수문 유적':'가을 수관의 전당',description:tide?'햇빛 아래 수문과 높은 등대를 잇는 물길':'뿌리에서 하늘까지 오르는 열린 가을 테라스',relicId:`relic-${theme}`,entry:{x:entry.x,y:entry.y,z:entry.z-3},rooms,floors,walls,props,doors,landmarks,spawns,puzzles,blocks:[],links:connections.map(([a,b])=>[get(a).id,get(b).id]),bounds:{minX:Math.min(...rooms.map(r=>r.x-r.w/2))-1,maxX:Math.max(...rooms.map(r=>r.x+r.w/2))+1,minZ:Math.min(...rooms.map(r=>r.z-r.d/2))-1,maxZ:Math.max(...rooms.map(r=>r.z+r.d/2))+1}};
}
export const RUINS=freeze([
  ruin('tide',[['entry',0,0,0,24,18,'햇빛 회랑'],['lower',0,32,0,28,18,'밀물 수문'],['upper',0,68,8,30,18,'높은 수로'],['boss',38,68,8,22,24,'등대의 심장'],['treasure',-40,32,3,20,18,'소금빛 창고']],[['entry','lower'],['lower','upper'],['upper','boss',true],['lower','treasure']]),
  ruin('canopy',[['entry',0,0,0,20,20,'뿌리 입구'],['lower',0,38,0,26,20,'낮은 뜰'],['upper',-42,38,8,22,20,'가지 선반'],['crown',-42,80,18,26,22,'하늘 뜰'],['boss',0,80,18,22,26,'가을 왕관'],['treasure',40,38,6,20,20,'동쪽 발코니']],[['entry','lower'],['lower','upper'],['upper','crown'],['crown','boss',true],['lower','treasure']]),
]);
