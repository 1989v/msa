import { TILES } from './atlas.mjs';

export function createCharacter(THREE,{lod=0,texture=null}={}) {
  const root=new THREE.Group();
  root.name=lod?'Naru_LOD1':'Naru_LOD0';
  const bones=[],byName={},rest={};
  function bone(name,parent,p){const b=new THREE.Bone();
  b.name=name;
  const pp=parent?rest[parent]:[0,0,0];
  b.position.set(...p.map((v,i)=>v-pp[i]));
  (parent?byName[parent]:root).add(b);
  rest[name]=p;
  byName[name]=b;
  bones.push(b);
  return bones.length-1;
  }
  bone('hips',null,[0,.87,0]);
  bone('spine','hips',[0,1.03,0]);
  bone('chest','spine',[0,1.25,0]);
  bone('neck','chest',[0,1.43,0]);
  bone('head','neck',[0,1.49,0]);
  for(const [side,s] of [['L',1],['R',-1]]){bone('upperArm_'+side,'chest',[s*.19,1.35,0]);
  bone('forearm_'+side,'upperArm_'+side,[s*.31,1.10,.025]);
  bone('hand_'+side,'forearm_'+side,[s*.40,.89,.045]);
  bone('thigh_'+side,'hips',[s*.09,.88,0]);
  bone('shin_'+side,'thigh_'+side,[s*.105,.51,0]);
  bone('foot_'+side,'shin_'+side,[s*.11,.13,.015]);
  }
  bone('capeUpper','chest',[0,1.33,-.10]);
  bone('capeLower','capeUpper',[0,1.06,-.16]);
  const id=n=>bones.indexOf(byName[n]),rig=(a,b,t)=>b?[[id(a),1-t],[id(b),t]]:[[id(a),1]];
  const p=[],uv=[],si=[],sw=[],idx=[],parts=[];
  const resolution=(n)=>Math.max(3,Math.round(n*(lod?.4:.74)));
  function vert(v,u,w,tile,weights){const i=p.length/3;
  p.push(...v);
  uv.push(((tile%4)*256+8+u*240)/1024,(Math.floor(tile/4)*256+8+w*240)/1024);
  si.push(...[...weights.map(a=>a[0]),0,0,0,0].slice(0,4));
  sw.push(...[...weights.map(a=>a[1]),0,0,0,0].slice(0,4));
  return i;
  }
  function surface(name,nu,nv,fn,tile,weights,reverse=false){const start=p.length/3,tri=idx.length/3;
  nu=resolution(nu);
  nv=resolution(nv);
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,v=j/nv;
  vert(fn(u,v),u,v,TILES[tile],typeof weights==='function'?weights(u,v):weights);
  }for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){let a=start+j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;
  idx.push(...(reverse?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
  }parts.push({name,start,count:p.length/3-start,triangles:idx.length/3-tri});
  }
  function loft(name,rings,tile,weights,n=24){surface(name,n,(rings.length-1)*3,(u,v)=>{let k=Math.min(rings.length-2,Math.floor(v*(rings.length-1))),t=v*(rings.length-1)-k;const a=rings[k],b=rings[k+1],q=a.map((x,i)=>x+(b[i]-x)*t),ang=u*Math.PI*2;return[q[0]+Math.sin(ang)*q[3],q[1],q[2]+Math.cos(ang)*q[4]];},tile,weights);
  }
  function oval(name,center,radius,tile,weights,n=24,m=14){surface(name,n,m,(u,v)=>{let a=u*Math.PI*2,h=-Math.PI/2+v*Math.PI;return[center[0]+radius[0]*Math.cos(h)*Math.sin(a),center[1]+radius[1]*Math.sin(h),center[2]+radius[2]*Math.cos(h)*Math.cos(a)];},tile,weights);
  }
  function tube(name,a,b,ra,rb,tile,weights,n=16){const axis=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(),x=new THREE.Vector3(0,0,1).cross(axis).normalize(),z=new THREE.Vector3().crossVectors(x,axis);
  surface(name,n,6,(u,v)=>{let ang=u*Math.PI*2,r=ra+(rb-ra)*v;return a.map((q,i)=>q+(b[i]-q)*v+x.getComponent(i)*Math.sin(ang)*r+z.getComponent(i)*Math.cos(ang)*r);},tile,weights);
  }
  // Tailored torso: tucked waist, chest and shoulder slope; skirts overlap the trouser waist.
  loft('tunic',[[0,.87,0,.145,.10],[0,.98,0,.118,.085],[0,1.08,0,.12,.078],[0,1.22,.003,.155,.095],[0,1.32,0,.18,.085],[0,1.39,0,.075,.057]],'cloth',(u,v)=>rig('spine','chest',Math.min(1,v*1.4)),32);
  loft('split-tunic-skirt',[[0,.76,0,.185,.115],[0,.84,0,.17,.12],[0,.98,0,.122,.09]],'cloth',rig('hips'),28);
  loft('belt',[[0,.975,0,.125,.094],[0,.995,0,.126,.095],[0,1.018,0,.124,.093]],'leather',rig('spine'),24);
  tube('neck',[0,1.36,0],[0,1.52,0],.051,.047,'skin',rig('neck'),20);
  // Adult proportions: ~7.5 heads, shaped jaw and cheek planes, forward facial volume.
  loft('face',[[0,1.465,.028,.028,.033],[0,1.485,.022,.048,.048],[0,1.515,.013,.068,.063],[0,1.554,.008,.075,.071],[0,1.592,.002,.070,.068],[0,1.637,-.003,.052,.052],[0,1.657,-.009,.007,.010]],'skin',rig('head'),32);
  for(const s of [-1,1]){oval('ear',[s*.071,1.55,.0],[.014,.025,.012],'skin',rig('head'),12,8);
  oval('eye-white',[s*.027,1.565,.070],[.016,.0065,.0038],'eye',rig('head'),16,8);
  oval('iris',[s*.026,1.565,.074],[.0048,.0054,.002],'iris',rig('head'),12,8);
  tube('brow',[s*.011,1.583,.069],[s*.044,1.586,.063],.0035,.002,'hair',rig('head'),8);
  }
  oval('nose-bridge',[0,1.549,.071],[.010,.022,.009],'skin',rig('head'),14,10);
  oval('nose-tip',[0,1.535,.081],[.010,.006,.009],'skin',rig('head'),14,8);
  oval('mouth',[0,1.516,.073],[.017,.0035,.002],'lip',rig('head'),16,6);
  // Scalp with uneven side part; independent tapered swept locks give the bob a broken edge.
  surface('hair-cap',32,18,(u,v)=>{const a=u*Math.PI*2;const front=Math.cos(a);const bottom=front>.3?1.602:1.514;const h=v*Math.PI/2;return[Math.sin(a)*.083*Math.cos(h),bottom+(1.681-bottom)*Math.sin(h),-.009+Math.cos(a)*.081*Math.cos(h)];},'hair',rig('head'));
  for(let k=0;k<11;k++){let a=k/11*Math.PI*2,cx=Math.sin(a)*.062,cz=-.012+Math.cos(a)*.059;
  const front=Math.cos(a)>.45;
  loft('hair-lock-'+k,[[cx+Math.sin(a)*.02,front?1.57:1.485,cz+.015,.002,.002],[cx+Math.sin(a)*.019,1.56,cz+.018,.020,.015],[cx,1.62,cz,.027,.021],[cx*.3,1.671,cz*.2,.006,.007]],'hair',rig('head'),12);
  }
  // A-pose limbs use smoothly blended elbow/knee rings. Boot soles are actual geometry.
  for(const [side,s] of [['L',1],['R',-1]]){
    const arm='upperArm_'+side,fore='forearm_'+side,hand='hand_'+side,thigh='thigh_'+side,shin='shin_'+side,foot='foot_'+side;
    loft('sleeve-'+side,[
      [s*.13,1.385,0,.028,.044],
      [s*.184,1.342,0,.080,.077],
      [s*.235,1.26,0,.070,.066],
      [s*.27,1.19,.015,.052,.052],
      [s*.29,1.155,.02,.049,.050],
    ],'cloth',(u,v)=>rig('chest',arm,Math.min(1,v*3)),24);
    tube('elbow-'+side,[s*.29,1.17,.02],[s*.335,1.06,.03],.037,.032,'skin',(u,v)=>rig(arm,fore,v),20);
    tube('forearm-wrap-'+side,[s*.32,1.09,.03],[s*.399,.90,.045],.039,.023,'wrap',rig(fore),24);
    oval('palm-'+side,[s*.412,.857,.049],[.028,.047,.022],'skin',rig(hand),18,12);
    for(let f=0;f<4;f++)tube('finger-'+side+'-'+f,[s*(.397+f*.011),.837,.061],[s*(.4+f*.011),.790+Math.abs(f-1.5)*.005,.065],.006,.0045,'skin',rig(hand),8);
    tube('thumb-'+side,[s*.39,.863,.065],[s*.38,.827,.075],.009,.005,'skin',rig(hand),10);
    loft('trouser-'+side,[
      [s*.085,.92,0,.088,.091],
      [s*.103,.81,-.004,.094,.086],
      [s*.119,.68,-.006,.093,.084],
      [s*.12,.57,.014,.085,.074],
      [s*.111,.495,.018,.073,.064],
      [s*.109,.46,.01,.050,.047],
      [s*.109,.42,.005,.044,.040],
    ],'cloth',(u,v)=>rig(thigh,shin,Math.max(0,(v-.45)*1.7)),26);
    loft('shin-wrap-'+side,[[s*.11,.18,.012,.034,.038],[s*.11,.27,.005,.037,.041],[s*.109,.38,.004,.041,.042],[s*.109,.43,.004,.043,.043]],'wrap',rig(shin),24);
    loft('boot-upper-'+side,[[s*.11,.055,.052,.049,.099],[s*.11,.095,.042,.049,.084],[s*.11,.145,.008,.036,.042],[s*.11,.205,.006,.039,.043]],'leather',rig(foot),24);
    loft('boot-sole-'+side,[[s*.11,0,.05,.05,.10],[s*.11,.026,.05,.052,.102],[s*.11,.04,.05,.051,.10]],'sole',rig(foot),24);
    for(let j=0;j<3;j++)tube('boot-lace-'+side+j,[s*.11-.026,.104+j*.022,.093-j*.021],[s*.11+.026,.109+j*.022,.091-j*.021],.003,.003,'seam',rig(foot),8);
  }
  // Neck-width attachment opens over the shoulders, then gathers to a slanted tail.
  // Two continuous surfaces plus edge bands give the mantle real cloth thickness.
  const cape = (u,v,lining) => {
    const angle = -2.3 + u*4.6;
    const shoulder = Math.min(1,v/.25);
    const lower = Math.max(0,(v-.25)/.75);
    const spread = .068 + .180*Math.sin(shoulder*Math.PI/2) - .042*lower;
    const fold = Math.sin(u*Math.PI*10 + v*1.6)*(.002 + .014*v);
    const depth = .067 + .068*shoulder + .035*lower;
    const length = .44 + .14*u + .025*Math.sin(u*5);
    return [
      Math.sin(angle)*(spread+fold),
      1.432-v*length + .018*Math.sin(u*11)*v*v,
      -.009-Math.cos(angle)*(depth+fold)+(lining?.006:0),
    ];
  };
  const capeWeights = (u,v) => rig('capeUpper','capeLower',v*v);
  surface('cape-outer',42,23,(u,v)=>cape(u,v,false),'capeTrim',capeWeights,true);
  surface('cape-lining',42,23,(u,v)=>cape(u,v,true),'cape',capeWeights);
  surface('cape-hem',42,2,(u,v)=>{
    const outer=cape(u,1,false),inner=cape(u,1,true);
    return outer.map((x,i)=>x+(inner[i]-x)*v);
  },'cape',()=>rig('capeLower'),true);
  for(const edge of [0,1]){
    surface('cape-edge-'+edge,2,23,(u,v)=>{
      const outer=cape(edge,v,false),inner=cape(edge,v,true);
      return outer.map((x,i)=>x+(inner[i]-x)*u);
    },'cape',capeWeights,edge===1);
  }
  // Closed irregular collar roll; low at the throat, higher behind the neck.
  surface('folded-collar',32,10,(u,v)=>{
    const angle=u*Math.PI*2,roll=v*Math.PI*2;
    const radius=.067+.018*Math.cos(roll);
    return [
      Math.sin(angle)*radius,
      1.424+.019*Math.sin(roll)-.025*Math.cos(angle)+.009*Math.sin(angle),
      Math.cos(angle)*radius,
    ];
  },'cape',rig('chest'));
  // Layered scarf fans from the throat over the shoulder seam instead of a straight bar.
  surface('front-scarf-fold',32,12,(u,v)=>{
    const angle=u*Math.PI*2;
    const folds=.007*Math.sin(v*Math.PI*5+Math.sin(angle));
    return [
      Math.sin(angle)*(.071+.142*v+folds),
      1.415-.097*v-.024*Math.cos(angle)*Math.sin(v*Math.PI)+.012*Math.sin(angle),
      Math.cos(angle)*(.071+.035*v+folds),
    ];
  },'cape',rig('chest'));
  oval('cape-brooch',[-.125,1.346,.092],[.026,.026,.01],'brass',rig('chest'),20,12);
  // Crossbody strap follows torso in front and returns over the rear shoulder.
  const strap=(back)=>surface(back?'strap-back':'strap-front',3,26,(u,v)=>{const x=.13-v*.34;return[x+(u-.5)*.022,1.37-v*.53,(back?-1:1)*(.091+.02*Math.sin(v*Math.PI))];},'leather',(u,v)=>rig('hips','chest',Math.max(0,1-v)),back);
  strap(false);
  strap(true);
  loft('map-satchel',[[-.205,.685,.008,.050,.066],[-.205,.716,.008,.065,.081],[-.205,.84,.008,.065,.079],[-.205,.885,.008,.051,.068]],'leather',rig('hips'),24);
  oval('satchel-flap',[-.205,.827,.082],[.063,.059,.009],'leather',rig('hips'),20,12);
  for(const x of [-.239,-.175]){tube('satchel-closure',[x,.845,.093],[x,.754,.094],.006,.006,'leather',rig('hips'),8);
  oval('satchel-buckle',[x,.785,.102],[.013,.018,.004],'brass',rig('hips'),12,8);
  }
  tube('rolled-map',[-.234,.834,-.03],[-.255,1.002,-.039],.024,.025,'map',rig('hips'),20);
  oval('belt-buckle',[.021,.994,.102],[.027,.022,.005],'brass',rig('spine'),16,8);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  // Neutral white multiplies the named atlas palette without tinting it.
  const ATLAS_MULTIPLIER = 0xffffff;
  const material=new THREE.MeshStandardMaterial({name:'Naru_1K_atlas',map:texture,color:ATLAS_MULTIPLIER,roughness:.86,metalness:0,side:THREE.DoubleSide});
  const mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.name='Naru_skin';
  root.add(mesh);
  root.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  const qt=(name,axis,angle)=>{const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis),angle);
  return new THREE.QuaternionKeyframeTrack(name+'.quaternion',[0,1.5,3],[0,0,0,1,...q.toArray(),0,0,0,1]);
  };
  const clips=[new THREE.AnimationClip('idle',3,[qt('chest',[1,0,0],.015),qt('head',[0,1,0],.026),qt('capeLower',[1,0,0],.04)]),new THREE.AnimationClip('rig-inspection',3,[qt('forearm_L',[0,0,1],-.55),qt('shin_R',[1,0,0],.6),qt('capeLower',[1,0,0],.22)])];
  const stats={lod,triangles:idx.length/3,vertices:p.length/3,bones:bones.length,atlasSize:1024,height:geometry.boundingBox.max.y-geometry.boundingBox.min.y,parts};
  return {root,mesh,skeleton,clips,stats};
}
