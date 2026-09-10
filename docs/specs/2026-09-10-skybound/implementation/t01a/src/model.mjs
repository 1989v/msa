// Original model, manually authored coordinates. No source assets or random runtime dependency.
export function createShrine(T) {
  const root=new T.Group();root.name='Wind shrine — broken meridian';
  const color=(l,c,h)=>new T.Color().setHSL(h/360,c/100,l/100,T.SRGBColorSpace);
  const mat=(name,l,c,h,metalness=0,roughness=.85)=>{const m=new T.MeshStandardMaterial({color:color(l,c,h),metalness,roughness,vertexColors:true});m.name=name;return m;};
  const chalk=mat('world-chalk · warm limestone',77,19,43);
  const edge=mat('world-chalk · exposed strata',87,18,44);
  const slate=mat('world-slate · inset stone',25,13,206);
  const brass=mat('world-brass · worn bronze',49,42,38,.73,.36);
  const amber=mat('world-ochre · amber glass',63,79,35,.28,.25);amber.emissive=color(26,75,32);amber.emissiveIntensity=.7;
  const moss=mat('weathered crevice · lichen',38,18,67);
  let seq=0;
  function mesh(g,m,name,x=0,y=0,z=0) {
    const p=g.attributes.position,a=[];
    for(let i=0;i<p.count;i++){
      const wave=Math.sin(p.getX(i)*29.71+p.getY(i)*37.13+p.getZ(i)*13.1+seq*.7);
      const shade=.91+.075*wave;a.push(shade,shade,shade);
    }
    g.setAttribute('color',new T.Float32BufferAttribute(a,3));
    const o=new T.Mesh(g,m);o.name=name||`stone-${seq}`;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);seq++;return o;
  }
  function slab(points,depth,m,name,z=-depth/2,bevel=.045){
    const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
    return mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:10}),m,name,0,0,z);
  }
  function arc(r1,r2,start,end,cx,cy,depth,m,name,z){
    const p=[];const n=Math.ceil(Math.abs(end-start)*15);
    for(let i=0;i<=n;i++){const a=start+(end-start)*i/n;p.push([cx+r2*Math.cos(a),cy+r2*Math.sin(a)]);}
    for(let i=n;i>=0;i--){const a=start+(end-start)*i/n;p.push([cx+r1*Math.cos(a),cy+r1*Math.sin(a)]);}
    return slab(p,depth,m,name,z,.012);
  }
  // Broad stepped platform grounds the narrow overhead meridian.
  for(let i=0;i<3;i++){
    const g=new T.CylinderGeometry(2.75-i*.18,2.87-i*.18,.16,10,1);
    mesh(g,i===1?chalk:edge,`ten-sided foundation ${i}`,0,.08+i*.16,0).rotation.y=Math.PI/10;
  }
  // Original asymmetrical split arch. Two tapering columns rise towards the ring.
  for(const side of [-1,1]){
    for(let i=0;i<8;i++){
      const low=.49+i*.63, high=low+.59;
      const inner=1.26-.092*i, outer=2.13-.125*i;
      const shift=i===7?(side===1?.11:-.025):0;
      const points=[[side*(inner+.03),low],[side*(outer+.08),low+.02],[side*(outer-.06+shift),high-.04],[side*(inner-.025+shift),high]];
      if(side<0)points.reverse();
      slab(points,.78-i*.024,i===2||i===5?slate:chalk,`pier ${side} stratum ${i}`,-.33,.055);
      // Thinner strata lie on the front without random floating blocks.
      if(i!==2&&i!==5){
        const stripe=[[side*(inner+.07),low+.17],[side*(outer-.025),low+.21],[side*(outer-.04),low+.245],[side*(inner+.065),low+.20]];
        if(side<0)stripe.reverse();slab(stripe,.035,edge,`sedimentary lip ${side} ${i}`,.473-i*.024,.007);
      }
      if(i===2||i===5){
        const seam=[[side*(inner+.03),low+.03],[side*(outer+.035),low+.13],[side*(outer+.02),low+.162],[side*(inner+.02),low+.062]];
        if(side<0)seam.reverse();slab(seam,.022,brass,`bronze seam ${side} ${i}`,.478-i*.024,.006);
      }
    }
  }
  const cy=4.88;
  // Open crown, dark recessed inner track and discontinuous warm metal rim.
  const gap=.19;
  const start=Math.PI/2+gap,end=Math.PI*2.5-gap;
  for(let i=0;i<13;i++){
    const a=start+(end-start)*i/13+.012,b=start+(end-start)*(i+1)/13-.012;
    arc(.92,1.18,a,b,0,cy,.55,i%4===1?edge:chalk,`carved crown voussoir ${i}`,-.26);
  }
  arc(.77,.925,start+.025,end-.025,0,cy,.10,slate,'recessed slate meridian track',.315);
  arc(.735,.765,start+.035,end-.035,0,cy,.045,brass,'inner bronze meridian',.40);
  for(let i=0;i<19;i++){
    const a=start+.15+(end-start-.30)*i/18;
    const tick=mesh(new T.BoxGeometry(.025,.075,.019),i%3===0?amber:brass,`engraved index ${i}`,Math.cos(a)*.842,cy+Math.sin(a)*.842,.429);tick.rotation.z=a-Math.PI/2;
  }
  // A real connected hanging instrument: axle, suspension, bronze teardrop.
  const axle=mesh(new T.CylinderGeometry(.095,.095,.69,12),brass,'transverse suspension axle',0,cy-.72,.08);axle.rotation.x=Math.PI/2;
  mesh(new T.CylinderGeometry(.02,.02,.90,8),brass,'suspended wind plumb',0,cy-1.2,.39);
  const frame=mesh(new T.TorusGeometry(.155,.027,6,20),brass,'plumb bronze housing',0,cy-1.72,.39);frame.scale.y=1.35;
  const gem=mesh(new T.IcosahedronGeometry(.122,1),amber,'amber wind lens',0,cy-1.72,.39);gem.scale.set(.83,1.31,.55);
  // Stylized carved concentric curves on lower pier faces, clipped to each pillar.
  for(const side of [-1,1])for(let n=0;n<3;n++){
    const cx=side*2.30,yy=1.20;
    const a=side>0?Math.PI*.48:-Math.PI*.10,b=side>0?Math.PI*1.10:Math.PI*.52;
    arc(.66+n*.12,.683+n*.12,a,b,cx,yy,.025,edge,`wind relief ${side} ${n}`,.488);
  }
  // Sparse attached chips and lichens give scale without a particle-cloud silhouette.
  for(let i=0;i<16;i++){
    const side=i%2?1:-1,y=.6+(i%4)*.13,x=side*(1.40+(i%5)*.105);
    const rock=mesh(new T.DodecahedronGeometry(.08+(i%3)*.03,0),i%4===0?moss:chalk,`foot weathering ${i}`,x,y,.49);rock.scale.set(1,.65,.52);rock.rotation.set(i*.31,i*.48,i*.2);
  }
  return root;
}
