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
  // Four overlapping coat tails leave the front and side vents open below the belt.
  const tails = [
    {start:-1.47,end:-.035,length:.237},
    {start:.07,end:1.48,length:.279},
    {start:1.60,end:3.16,length:.24},
    {start:3.12,end:4.66,length:.225},
  ];
  tails.forEach((tail,index)=>{
    const panel=(u,v)=>{
      const angle=tail.start+(tail.end-tail.start)*u;
      const fold=Math.sin(u*Math.PI*3+.45)*.009*Math.sin(v*Math.PI*.8);
      const waist=.124,flare=.054*v+fold;
      const hemSlope=.034*(u-.5)+.014*Math.sin(u*Math.PI);
      return [
        Math.sin(angle)*(waist+flare),
        .99-v*(tail.length+hemSlope),
        Math.cos(angle)*(.096+.026*v+fold)+(index<2?.006:0),
      ];
    };
    surface('tunic-tail-'+index,12,10,panel,'cloth',rig('hips'));
    surface('tunic-tail-hem-'+index,12,2,(u,v)=>{
      const q=panel(u,.973+v*.027);
      const angle=tail.start+(tail.end-tail.start)*u;
      q[0]+=.001*Math.sin(angle);
      q[2]+=.001*Math.cos(angle);
      return q;
    },'seam',rig('hips'));
  });
  loft('belt',[[0,.975,0,.125,.094],[0,.995,0,.126,.095],[0,1.018,0,.124,.093]],'leather',rig('spine'),24);
  tube('neck',[0,1.36,0],[0,1.52,0],.051,.047,'skin',rig('neck'),20);
  // The facial surface carries the anatomy; eyes and lips follow its actual depth.
  // Head sections are smoothly interpolated instead of exposing planar ring bands.
  const faceSections = [
    [1.465,.023,.030,.032], [1.485,.044,.025,.047],
    [1.515,.062,.015,.060], [1.543,.073,.005,.070],
    [1.568,.071,.001,.073], [1.596,.069,-.001,.071],
    [1.628,.057,-.003,.060], [1.653,.035,-.007,.037],
    [1.662,.002,-.009,.003],
  ];
  const gaussian=(value,center,width)=>Math.exp(-(((value-center)/width)**2));
  function faceSection(y){
    let k=0;
    while(k<faceSections.length-2&&y>faceSections[k+1][0])k++;
    const a=faceSections[k],b=faceSections[k+1];
    const t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0])));
    return a.map((value,i)=>{
      if(i===0)return y;
      const prev=faceSections[Math.max(0,k-1)][i];
      const next=faceSections[Math.min(faceSections.length-1,k+2)][i];
      return .5*((2*value)+(-prev+b[i])*t+(2*prev-5*value+4*b[i]-next)*t*t+(-prev+3*value-3*b[i]+next)*t*t*t);
    });
  }
  function facialDepth(x,y){
    const cheeks=.005*gaussian(Math.abs(x),.043,.022)*gaussian(y,1.544,.018);
    const sockets=-.008*gaussian(Math.abs(x),.028,.017)*gaussian(y,1.566,.013);
    const brow=.003*gaussian(Math.abs(x),.026,.025)*gaussian(y,1.585,.009);
    const bridge=.022*gaussian(x,0,.008)*gaussian(y,1.549,.026);
    const tip=.013*gaussian(x,0,.011)*gaussian(y,1.537,.008);
    const muzzle=.003*gaussian(x,0,.025)*gaussian(y,1.518,.012);
    const chin=.004*gaussian(x,0,.022)*gaussian(y,1.486,.010);
    return cheeks+sockets+brow+bridge+tip+muzzle+chin;
  }
  function faceFront(x,y){
    const [,width,z,depth]=faceSection(y);
    return z+depth*Math.sqrt(Math.max(0,1-(x/width)**2))+facialDepth(x,y);
  }
  surface('face',44,28,(u,v)=>{
    const y=1.465+v*.197,angle=u*Math.PI*2;
    const [,width,z,depth]=faceSection(y),x=width*Math.sin(angle);
    return [x,y,z+depth*Math.cos(angle)+facialDepth(x,y)*Math.max(0,Math.cos(angle))**5];
  },'skin',rig('head'));
  for(const side of [-1,1]){
    oval('ear',[side*.071,1.548,-.001],[.013,.023,.011],'skin',rig('head'),12,8);
    const eyePoint=(u,v)=>{
      const x=side*(.012+u*.032);
      const center=1.566+u*.001;
      const arch=Math.sin(u*Math.PI);
      const y=center+(v-.5)*.012*arch;
      return [x,y,faceFront(x,y)+.001+.006*arch*Math.sin(v*Math.PI)];
    };
    surface('eye-white-'+side,16,6,eyePoint,'eye',rig('head'));
    const eyeZ=faceFront(side*.028,1.5665)+.008;
    oval('iris',[side*.028,1.5665,eyeZ],[.0045,.0048,.0012],'iris',rig('head'),12,8);
    for(const upper of [false,true]){
      surface('eyelid-'+side+'-'+upper,16,3,(u,v)=>{
        const q=eyePoint(u,upper?1:0);
        q[1]+=(upper?1:-1)*v*.003*Math.sin(u*Math.PI);
        q[2]+=.0012*Math.sin(v*Math.PI);
        return q;
      },'skin',rig('head'));
    }
    surface('brow-'+side,16,3,(u,v)=>{
      const x=side*(.010+.038*u);
      const y=1.587+.004*Math.sin(u*Math.PI)-.003*u+(v-.5)*.004*(1-.6*u);
      return [x,y,faceFront(x,y)+.0015];
    },'hair',rig('head'));
  }
  for(const upper of [false,true]){
    surface('lip-'+upper,18,4,(u,v)=>{
      const x=(u-.5)*.033,arch=Math.sin(u*Math.PI);
      const cupid=upper?.0015*Math.cos((u-.5)*Math.PI*4)*arch:0;
      const y=1.516+(upper?1:-1)*v*.003*arch+cupid;
      return [x,y,faceFront(x,y)+.001+.0025*Math.sin(v*Math.PI)*arch];
    },'lip',rig('head'));
  }
  // Side-parted bob: a continuous scalp and broad, swept locks with distinct curved ends.
  // Each lock is a flattened curved sheet with thickness, not a vertical tapered cone.
  surface('hair-cap',28,16,(u,v)=>{
    const angle=u*Math.PI*2,front=Math.max(0,Math.cos(angle));
    const bottom=1.517+.088*front+.012*Math.sin(angle);
    const latitude=v*Math.PI/2;
    const wave=.003*Math.sin(angle*7+v*3)*(1-v);
    return [
      Math.sin(angle)*(.094+wave)*Math.cos(latitude)**.72+.006*v,
      bottom+(1.681-bottom)*Math.sin(latitude),
      -.010+Math.cos(angle)*(.095+wave)*Math.cos(latitude)**.72,
    ];
  },'hair',rig('head'));
  function hairLock(name,points,width){
    surface(name,10,14,(u,v)=>{
      const t=v,inv=1-t;
      const center=points[0].map((_,i)=>inv**3*points[0][i]+3*inv*inv*t*points[1][i]+3*inv*t*t*points[2][i]+t**3*points[3][i]);
      const tangent=points[0].map((_,i)=>3*inv*inv*(points[1][i]-points[0][i])+6*inv*t*(points[2][i]-points[1][i])+3*t*t*(points[3][i]-points[2][i]));
      const normal=new THREE.Vector3(center[0],.08,center[2]+.012).normalize();
      const across=new THREE.Vector3(...tangent).cross(normal).normalize();
      const round=u*Math.PI*2;
      const taper=Math.sin(Math.PI*(.10+.90*t))**.7;
      const breadth=width*taper*(1-.25*t);
      return center.map((x,i)=>x+across.getComponent(i)*Math.cos(round)*breadth+normal.getComponent(i)*Math.sin(round)*.006*taper);
    },'hair',rig('head'));
  }
  const locks=[
    // Long side of the part sweeps across the forehead then curls past the temple.
    [[[.029,1.659,.041],[-.011,1.691,.067],[-.073,1.628,.089],[-.067,1.586,.061]],.024],
    [[[.023,1.670,.024],[-.033,1.696,.047],[-.089,1.611,.074],[-.072,1.548,.036]],.027],
    [[[.018,1.674,.005],[-.066,1.680,.018],[-.098,1.565,.032],[-.078,1.516,.005]],.028],
    // Short side bends outward above the exposed eyebrow and follows the ear.
    [[[.033,1.655,.049],[.070,1.664,.059],[.083,1.602,.060],[.068,1.573,.038]],.019],
    [[[.036,1.665,.023],[.096,1.653,.026],[.093,1.561,.017],[.080,1.528,-.009]],.025],
    [[[.025,1.669,-.016],[.083,1.658,-.043],[.109,1.552,-.047],[.070,1.514,-.054]],.027],
    // Uneven rear waves, with the lowest tips tucked inward at the nape.
    [[[-.015,1.674,-.025],[-.080,1.658,-.060],[-.106,1.555,-.040],[-.066,1.510,-.048]],.027],
    [[[-.007,1.672,-.031],[-.054,1.659,-.097],[-.067,1.554,-.096],[-.028,1.514,-.074]],.028],
    [[[.013,1.671,-.030],[.040,1.651,-.106],[.051,1.551,-.097],[.011,1.505,-.078]],.028],
  ];
  locks.forEach(([points,width],index)=>hairLock('hair-lock-'+index,points,width));
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
    const angle = -1.85 + u*3.7;
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
  surface('cape-outer',36,20,(u,v)=>cape(u,v,false),'capeTrim',capeWeights,true);
  surface('cape-lining',36,20,(u,v)=>cape(u,v,true),'cape',capeWeights);
  surface('cape-hem',36,2,(u,v)=>{
    const outer=cape(u,1,false),inner=cape(u,1,true);
    return outer.map((x,i)=>x+(inner[i]-x)*v);
  },'cape',()=>rig('capeLower'),true);
  for(const edge of [0,1]){
    surface('cape-edge-'+edge,2,23,(u,v)=>{
      const outer=cape(edge,v,false),inner=cape(edge,v,true);
      return outer.map((x,i)=>x+(inner[i]-x)*u);
    },'cape',capeWeights,edge===1);
  }
  // Soft wrap closes around the neck; its throat edge dips diagonally into the brooch.
  surface('folded-collar',28,8,(u,v)=>{
    const angle=u*Math.PI*2,roll=v*Math.PI*2;
    const radius=.061+.009*Math.cos(roll);
    return [
      Math.sin(angle)*radius,
      1.428+.012*Math.sin(roll)-.021*Math.cos(angle)+.012*Math.sin(angle),
      Math.cos(angle)*radius+.006,
    ];
  },'cape',rig('chest'));
  // Open, asymmetric cloth patches replace the old closed shoulder-width loft.
  // Each station is a top/free-edge pair: the gathered left anchor fans into a
  // diagonal fold and ends at a low right tip, leaving most of the chest visible.
  const scarfStations=[
    [[-.135,1.389,.071],[-.139,1.350,.094]],
    [[-.068,1.413,.076],[-.065,1.348,.109]],
    [[.022,1.412,.077],[.036,1.320,.113]],
    [[.123,1.383,.083],[.145,1.292,.107]],
    [[.201,1.355,.082],[.238,1.268,.082]],
  ];
  function clothSection(stations,u,v){
    const k=Math.min(stations.length-2,Math.floor(u*(stations.length-1)));
    const t=u*(stations.length-1)-k;
    const edges=[0,1].map(edge=>[0,1,2].map(axis=>{
      const a=stations[k][edge][axis],b=stations[k+1][edge][axis];
      const prev=stations[Math.max(0,k-1)][edge][axis];
      const next=stations[Math.min(stations.length-1,k+2)][edge][axis];
      return .5*(2*a+(-prev+b)*t+(2*prev-5*a+4*b-next)*t*t+(-prev+3*a-3*b+next)*t*t*t);
    }));
    return edges[0].map((x,i)=>x+(edges[1][i]-x)*v);
  }
  const scarfPoint=(u,v)=>{
    const q=clothSection(scarfStations,u,v);
    // Two broad cloth rolls converge at the fastening, with a recessed valley.
    // Curvature changes the section itself, rather than adding texture-like noise.
    const gather=Math.sin(Math.PI*(.12+.8*u));
    q[2]+=gather*(.013*Math.sin(v*Math.PI)-.008*Math.sin(v*Math.PI*2));
    q[1]-=.012*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
    return q;
  };
  surface('front-scarf-fold',28,10,scarfPoint,'cape',rig('chest'));
  const shoulderStations=[
    [[-.135,1.389,.071],[-.139,1.350,.094]],
    [[-.179,1.368,.084],[-.201,1.315,.088]],
    [[-.213,1.337,.077],[-.243,1.284,.062]],
  ];
  const shoulderPoint=(u,v)=>{
    const q=clothSection(shoulderStations,u,v);
    q[2]+=.009*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
    return q;
  };
  surface('scarf-shoulder-gather',14,8,shoulderPoint,'cape',rig('chest'));
  // The free hems turn back by 3 mm, not a padded rim.
  for(const [name,point,n] of [['scarf-hem',scarfPoint,32],['scarf-gather-hem',shoulderPoint,14]]){
    surface(name,n,2,(u,v)=>{
      const q=point(u,1);
      q[2]-=.003*v;
      q[1]+=.002*Math.sin(v*Math.PI);
      return q;
    },'cape',rig('chest'));
  }
  oval('cape-brooch',[-.125,1.366,.100],[.023,.023,.008],'brass',rig('chest'),16,8);
  // One continuous satchel strap: front chest -> beneath scarf -> shoulder -> beneath cape.
  // The upper route is deliberately inside the outer cloth, never intermittently on top.
  const strapRoute=[
    [-.205,.838,.088],[-.133,.975,.108],[-.047,1.112,.114],
    [.045,1.25,.108],[.100,1.325,.082],[.145,1.375,.040],
    [.151,1.383,-.010],[.141,1.363,-.063],[.085,1.267,-.102],
    [-.014,1.119,-.103],[-.108,.975,-.094],[-.205,.838,-.058],
  ];
  const strapPoint=(u,v)=>{
    const k=Math.min(strapRoute.length-2,Math.floor(v*(strapRoute.length-1)));
    const t=v*(strapRoute.length-1)-k;
    const a=strapRoute[k],b=strapRoute[k+1];
    return a.map((x,i)=>x+(b[i]-x)*t+(i===0?(u-.5)*.022:0));
  };
  surface('satchel-strap',3,44,strapPoint,'leather',(u,v)=>{
    const y=strapPoint(.5,v)[1];
    return rig('hips','chest',Math.max(0,Math.min(1,(y-.88)/.38)));
  });
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
