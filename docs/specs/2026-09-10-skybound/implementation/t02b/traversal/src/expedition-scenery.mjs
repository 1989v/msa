// Original coastal survey architecture. Low ground inlays never alter traversal.
export function createExpeditionScenery(T, col, terrain) {
  const root = new T.Group(); root.name = 'western survey grounds';
  const solidBounds = [], meshes = [], flags = [];
  const material = (name, options = {}) => new T.MeshStandardMaterial({color: col(name), roughness: .9, ...options});
  const chalk = material('chalk'), slate = material('slate'), brass = material('brass', {metalness: .45});
  const cloth = material('ochre', {side: T.DoubleSide});
  const inlay = material('path', {polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1});
  function groundStrip(points, width) {
    const positions = [], indices = [];
    points.forEach(([x,z], i) => {
      const before = points[Math.max(0,i-1)], after = points[Math.min(points.length-1,i+1)];
      const dx = after[0]-before[0], dz = after[1]-before[1], length = Math.hypot(dx,dz) || 1;
      for (const side of [-1,1]) {
        const px = x-dz/length*width/2*side, pz = z+dx/length*width/2*side;
        const y = terrain.heightAt(px,pz);
        if (!Number.isFinite(y)) throw new Error('Survey inlay outside island');
        positions.push(px,y+.035,pz);
      }
      if(i){const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}
    });
    const geometry = new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const mark = new T.Mesh(geometry,inlay);mark.name='weathered survey inlay';mark.receiveShadow=true;root.add(mark);
  }
  // A broad approach gives the harbor a horizontal silhouette and readable work area.
  for(let line=0;line<3;line++){
    const z=-71+line*1.25;
    groundStrip(Array.from({length:25},(_,i)=>[-77+i*.5,z]),.16);
  }
  // Broken concentric scale around the archive; leave cardinal gaps for walking.
  for(let quadrant=0;quadrant<4;quadrant++){
    groundStrip(Array.from({length:18},(_,i)=>{const a=quadrant*Math.PI/2+.18+i/17*(Math.PI/2-.36);return[-48+Math.sin(a)*5.6,-126+Math.cos(a)*5.6];}),.2);
  }
  function mast(x,z,height,index) {
    const y=terrain.heightAt(x,z);if(!Number.isFinite(y))throw new Error('Survey mast outside island');
    const base=new T.Mesh(new T.CylinderGeometry(.28,.43,.7,8),chalk);base.position.set(x,y+.35,z);
    const pole=new T.Mesh(new T.CylinderGeometry(.065,.08,height,8),slate);pole.position.set(x,y+height/2,z);
    for(const mesh of [base,pole]){mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);meshes.push(mesh);}
    solidBounds.push({min:{x:x-.43,y,z:z-.43},max:{x:x+.43,y:y+height,z:z+.43}});
    const geometry=new T.PlaneGeometry(1.7,.7,12,3),attribute=geometry.attributes.position;
    const rest=new Float32Array(attribute.array);
    const flag=new T.Mesh(geometry,cloth);flag.position.set(x+.85,y+height-.45,z);flag.name='harbor wind pennant';root.add(flag);flags.push({geometry,attribute,rest,phase:index*.9});
    const cap=new T.Mesh(new T.SphereGeometry(.12,8,6),brass);cap.position.set(x,y+height,z);root.add(cap);
  }
  mast(-81,-65,4.8,0);mast(-79,-78,3.9,1);mast(-53.7,-126,3.2,2);mast(-42.2,-126,3.2,3);
  // One instanced batch per botanical shape, deterministic and outside puzzle approaches.
  const tuftGeometry=new T.BufferGeometry();tuftGeometry.setAttribute('position',new T.Float32BufferAttribute([-.1,0,0,.1,0,0,.1,.65,.08,0,0,-.1,0,0,.1,.06,.5,.13],3));tuftGeometry.computeVertexNormals();
  const tufts=new T.InstancedMesh(tuftGeometry,material('grass',{side:T.DoubleSide}),180);
  const blooms=new T.InstancedMesh(new T.IcosahedronGeometry(.07,0),chalk,60),dummy=new T.Object3D();
  for(let i=0;i<180;i++){
    const archive=i>=120,index=archive?i-120:i,angle=index*2.399963229728653;
    const radius=archive?6.2+(index%7)*.12:11+(index%13)*.32;
    const x=(archive?-48:-72)+Math.cos(angle)*radius,z=(archive?-126:-68)+Math.sin(angle)*radius*(archive?.8:1.3),y=terrain.heightAt(x,z);
    if(!Number.isFinite(y))throw new Error('Survey plants outside island');
    dummy.position.set(x,y+.02,z);dummy.rotation.set(0,angle,0);dummy.scale.setScalar(.7+(i%5)*.11);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);
    if(i%3===0){dummy.position.y+=.35;dummy.updateMatrix();blooms.setMatrixAt(i/3,dummy.matrix);}
  }
  tufts.name='western salt grass';blooms.name='western chalk blooms';root.add(tufts,blooms);
  root.updateMatrixWorld(true);
  let lastTime;
  return {root,solidBounds,meshes,update(time){
    if (time === lastTime) return; lastTime = time;
    flags.forEach(({geometry,attribute,rest,phase})=>{
      for(let i=0;i<attribute.count;i++){
        const u=(rest[i*3]+.85)/1.7;
        attribute.setXYZ(i,rest[i*3],rest[i*3+1]-u*.17,Math.sin(u*5-time*2+phase)*u*.13);
      }
      attribute.needsUpdate=true;geometry.computeVertexNormals();
    });
  }};
}
