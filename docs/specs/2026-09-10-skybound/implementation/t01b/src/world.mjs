// Skybound original environment. Analytic surfaces and seeded placement; no borrowed assets.
export const TOKENS={chalk:[.83,.18,43],chalkShade:[.55,.14,42],meadow:[.43,.33,77],grass:[.49,.39,79],darkLeaf:[.25,.28,88],path:[.76,.25,43],slate:[.27,.13,202],brass:[.59,.52,39],ochre:[.58,.68,35],sea:[.65,.44,186],sky:[.67,.55,210],horizon:[.86,.29,203],cloud:[.97,.13,50]};
const terrace=(z,c)=>{const t=Math.max(0,Math.min(1,(c-z+11)/22));return t*t*(3-2*t);};
export const topHeight=(x,z)=>9+3.2*terrace(z,22)+3.6*terrace(z,0)+4.2*terrace(z,-23)+Math.sin(z*.16)*.22+Math.cos(x*.22)*.2;
export const pathX=z=>Math.sin((z+8)*.095)*7;
export function createWorld(T){
 const root=new T.Group();root.name='Skybound / the limestone windward';
 let seed=17391;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const col=name=>{const [l,s,h]=TOKENS[name];return new T.Color().setHSL(h/360,s,l,T.SRGBColorSpace);};
 const material=(name,options={})=>{const m=new T.MeshStandardMaterial({color:col(name),roughness:.92,...options});m.name=name;return m;};
 const stone=material('chalk',{vertexColors:true,flatShading:true}), meadow=material('meadow',{vertexColors:true}),pathmat=material('path',{vertexColors:true}), chalk=material('chalk'), brass=material('brass',{metalness:.65,roughness:.42}), slate=material('slate'),cloth=material('ochre',{side:T.DoubleSide});
 const mesh=(g,m,name,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 stone.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rockPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nrockPosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 rockPosition;').replace('#include <color_fragment>',`#include <color_fragment>
float grain=fract(sin(dot(floor(rockPosition*7.),vec3(12.9898,78.233,43.11)))*43758.5453);
float seam=smoothstep(.91,.99,sin(rockPosition.y*4.1+sin(rockPosition.x*.6)+sin(rockPosition.z*.4)));
diffuseColor.rgb *= .83+grain*.25-seam*.12;`);};
 const noise=(a,b)=>Math.sin(a*1.73+b*.57)*.45+Math.sin(a*3.19-b*1.37)*.27+Math.sin(a*7.13+b*2.71)*.14;
 function island(cx,cz,rx,rz,level,depth,main=false){
  const n=160,layers=22,positions=[],colors=[],idx=[];
  for(let j=0;j<=layers;j++)for(let i=0;i<=n;i++){
   const a=i/n*Math.PI*2, jag=1+Math.sin(a*3+.8)*.13+Math.sin(a*7+2)*.085+noise(a*9,1)*.065;
   const f=j/layers, shelf=1-f*.52+(Math.sin(a*11+.4)*.09+Math.sin(a*23)*.045)*Math.sin(f*2.7)+(j<3?.035:j<8?-.06:j<13?-.15:-.22)+Math.sin(j*2.1+a*7)*.018;
   const radial=j===0?1:shelf;
   const x=Math.cos(a)*rx*jag*radial,z=Math.sin(a)*rz*jag*radial;
   const y=(main?topHeight(x,z):level)-depth*f+(j===0?0:noise(a*5,j*.35)*1.4+Math.sin(a*9)*f*2);
   positions.push(cx+x,y,cz+z);
   const crevice=Math.pow(Math.max(0,Math.sin(a*39)+Math.sin(a*17)*.4),3);
   const shade=Math.max(.38,.92-crevice*.14+(j%4===0?-.17:0)+noise(a*10,j*.7)*.09);
   colors.push(shade,shade*.99,shade*.95);
   if(i<n&&j<layers){const v=j*(n+1)+i;idx.push(v,v+1,v+n+1,v+1,v+n+2,v+n+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();mesh(g,stone,'eroded continuous limestone');
  const p=[],c=[],ix=[],rings=20;
  for(let j=0;j<=rings;j++)for(let i=0;i<=n;i++){
   const a=i/n*Math.PI*2,r=j/rings,jag=1+Math.sin(a*3+.8)*.13+Math.sin(a*7+2)*.085+noise(a*9,1)*.065,x=Math.cos(a)*rx*r*jag,z=Math.sin(a)*rz*r*jag;
   p.push(cx+x,main?topHeight(x,z):level+Math.sin(r*6)*.13+(1-r)*Math.max(0,Math.sin(a*3+cx))*4,cz+z);
   const shade=.85+noise(x*.4,z*.4)*.3;c.push(shade,shade,shade*.86);
   if(j<rings&&i<n){const v=j*(n+1)+i;ix.push(v,v+1,v+n+1,v+1,v+n+2,v+n+1);}
  }
  const tg=new T.BufferGeometry();tg.setAttribute('position',new T.Float32BufferAttribute(p,3));tg.setAttribute('color',new T.Float32BufferAttribute(c,3));tg.setIndex(ix);tg.computeVertexNormals();mesh(tg,meadow,'continuous meadow');
 }
 island(0,0,22,48,14,39,true);
 for(const [x,z,rx,rz,y,d]of [[-72,-68,22,30,5,29],[78,-154,29,21,23,43],[-120,-205,33,24,33,46],[120,-255,24,17,39,37],[-48,-126,10,8,21,19],[31,-188,16,10,41,30],[111,-90,12,15,5,25],[-61,15,9,14,0,21]])island(x,z,rx,rz,y,d);
 // Foreground shoulder rises into the frame; layered angular outcrops interrupt the long contour.
 for(let i=0;i<26;i++){const z=39-i*2.7,x=-17+Math.sin(z*.18)*2,y=topHeight(x,z)-.3;const b=mesh(new T.DodecahedronGeometry(1,1),chalk,'exposed shoulder outcrop',x,y,z);b.scale.set(2+rand()*2,1+rand()*2,2+rand()*2);b.rotation.set(rand()*.5,rand()*6,rand()*.4);}
 // A continuous pale footpath makes the destination legible without arrows.
 const pp=[],pc=[],pi=[];
 for(let i=0;i<=180;i++){const z=41-i/180*73,x=pathX(z);for(const s of [-1,1]){const px=x+s*(1.15+Math.sin(z*.45)*.12);pp.push(px,topHeight(px,z)+.075,z);const v=.93+noise(px,z)*.05;pc.push(v,v,v);}if(i<180){let k=i*2;pi.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(pp,3));pg.setAttribute('color',new T.Float32BufferAttribute(pc,3));pg.setIndex(pi);pg.computeVertexNormals();mesh(pg,pathmat,'walkable-looking winding path (collision pending)');
 // Stratified rubble, ground-hugging shrubs and fine meadow blades use instancing.
 const dummy=new T.Object3D();
 function instances(name,g,m,count,place){const inst=new T.InstancedMesh(g,m,count);inst.name=name;inst.castShadow=true;inst.receiveShadow=true;for(let i=0;i<count;i++){place(dummy,i);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);inst.setColorAt(i,new T.Color().setScalar(.72+rand()*.4));}inst.instanceMatrix.needsUpdate=true;root.add(inst);return inst;}
 function ground(){for(let attempt=0;attempt<1000;attempt++){const x=(rand()-.5)*42,z=(rand()-.5)*90;const cluster=Math.sin(x*.33+Math.sin(z*.17)*2)+Math.cos(z*.27);if(cluster>.5&&(x/21)**2+(z/46)**2<.88&&Math.abs(x-pathX(z))>2.1&&!(z< -23&&Math.abs(x)<10))return [x,topHeight(x,z),z];}throw new Error('Placement rejection exhausted');}
 instances('weathered limestone fragments',new T.DodecahedronGeometry(1,1),chalk,115,(o)=>{const[x,y,z]=ground();o.position.set(x,y-.09,z);o.rotation.set(rand(),rand()*6,rand());const s=.25+rand()*.65;o.scale.set(s*1.8,s*.55,s);});
 const blade=new T.BufferGeometry();blade.setAttribute('position',new T.Float32BufferAttribute([-.06,0,0,.06,0,0,.035,.5,.04,0,0,-.06,0,0,.06,.05,.42,.025],3));blade.computeVertexNormals();
 instances('wind combed meadow tufts',blade,material('grass',{side:T.DoubleSide}),3600,(o)=>{const[x,y,z]=ground();o.position.set(x,y+.03,z);o.rotation.set(0,rand()*6.28,0);const s=.45+rand()*1.5;o.scale.set(s,s,s);});
 instances('low salt tolerant shrubs',new T.IcosahedronGeometry(1,1),material('darkLeaf'),95,(o)=>{const[x,y,z]=ground();o.position.set(x,y+.17,z);o.rotation.set(rand(),rand()*6,0);const s=.25+rand()*.6;o.scale.set(s,s*.65,s);});
 instances('small meadow blooms',new T.IcosahedronGeometry(.07,0),chalk,400,(o)=>{const[x,y,z]=ground();o.position.set(x,y+.32,z);o.rotation.set(0,0,0);o.scale.setScalar(.6+rand());});
 // Slender wind-shaped trees, kept away from the path and circular silhouette.
 const trunk=material('slate');
 for(let i=0;i<7;i++){const[x,y,z]=ground();const h=1.5+rand()*2;mesh(new T.CylinderGeometry(.06,.15,h,7),trunk,'tree trunk',x,y+h/2,z);for(let j=0;j<3;j++){const b=mesh(new T.IcosahedronGeometry(1,2),material('darkLeaf'),'windswept crown',x+j*.3,y+h-.4+j*.35,z);b.scale.set(1.1-j*.18,.5,.72);}}
 // The landmark: massive broken ring, radially jointed stone and suspended brass compass.
 const shrineZ=-31, base=topHeight(0,shrineZ)+.18;
 for(let i=0;i<4;i++)mesh(new T.CylinderGeometry(9-i*.35,9.15-i*.35,.3,64),chalk,'shrine circular terrace',0,base+i*.3,shrineZ);
 const ringY=base+8.8;
 for(let i=0;i<25;i++){const a=.16+i/25*(Math.PI*2-.43),b=.16+(i+.94)/25*(Math.PI*2-.43),shape=new T.Shape();for(let j=0;j<=8;j++){const t=a+(b-a)*j/8;const x=Math.sin(t)*7.6,y=Math.cos(t)*7.6;j?shape.lineTo(x,y):shape.moveTo(x,y);}for(let j=8;j>=0;j--){const t=a+(b-a)*j/8;shape.lineTo(Math.sin(t)*6.3,Math.cos(t)*6.3);}shape.closePath();mesh(new T.ExtrudeGeometry(shape,{depth:1.25,bevelEnabled:true,bevelThickness:.06,bevelSize:.08,bevelSegments:1,steps:1}),i%7===3?slate:chalk,'jointed wind meridian',0,ringY,shrineZ-.65);}
 const inner=mesh(new T.TorusGeometry(6.25,.065,6,100,Math.PI*1.94),brass,'brass inner track',0,ringY,shrineZ+.67);inner.rotation.z=.08;
 mesh(new T.CylinderGeometry(.035,.035,8.2,8),brass,'plumb suspension',0,ringY+2.5,shrineZ+.1);
 for(const a of [0,Math.PI/2]){const orb=mesh(new T.TorusGeometry(1.03,.045,8,48),brass,'wind compass gimbal',0,ringY-1.6,shrineZ+.1);orb.rotation.y=a;}
 mesh(new T.IcosahedronGeometry(.4,1),brass,'compass heart',0,ringY-1.6,shrineZ+.1);
 for(const side of [-1,1]){const x=side*10;for(let j=0;j<5;j++)mesh(new T.CylinderGeometry(.65-j*.055,.72-j*.055,1.6,12),chalk,'ruined beacon courses',x,base+.8+j*1.65,shrineZ+2);mesh(new T.CylinderGeometry(.045,.045,5,8),brass,'banner mast',x,base+9.5,shrineZ+2);
 const g=new T.PlaneGeometry(4,1.2,24,6);const p=g.attributes.position;for(let i=0;i<p.count;i++){const u=(p.getX(i)+2)/4;p.setXYZ(i,p.getX(i)+2,p.getY(i)-u*.5,Math.sin(u*8+p.getY(i))*u*.4);}g.computeVertexNormals();mesh(g,cloth,'ochre wind pennant',x,base+9.4,shrineZ+2);}
 for(let i=0;i<10;i++){const z=-19-i*.42;mesh(new T.BoxGeometry(3.2,.12+i*.1,.44),chalk,'approach stair',0,topHeight(0,z)+i*.04,z);}
 // Distant ruined silhouettes anchor the elevated islands.
 for(let i=0;i<11;i++){const x=78+(rand()-.5)*33,z=-154+(rand()-.5)*15,h=3+rand()*12;mesh(new T.CylinderGeometry(.6,.9,h,8),chalk,'distant ruin',x,23+h/2,z);}
 root.updateMatrixWorld(true);
 let triangles=0,meshes=0,instancesCount=0;root.traverse(o=>{if(o.isMesh){meshes++;const count=o.isInstancedMesh?o.count:1;instancesCount+=count;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*count;}});
 return{root,stats:{seed:17391,meshes,instances:instancesCount,triangles,terrainIslands:9,pathSamples:181,externalAssets:0},col};
}
