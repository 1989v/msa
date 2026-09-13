import { createTarget } from '../../../t05a/src/target.mjs';

export function createTargetView(THREE,col,terrain,blockingMeshes=()=>[]) {
  const floor=terrain.heightAt(3.8,32);if(!Number.isFinite(floor)) throw new Error('Training target needs meadow');
  const root=new THREE.Group();root.name='stone training target';root.position.set(3.8,floor,32);
  const material=new THREE.MeshStandardMaterial({color:col('chalkShade'),roughness:1});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,1.3,6),material);body.position.y=.65;body.castShadow=true;body.receiveShadow=true;root.add(body);
  const mark=new THREE.Mesh(new THREE.TorusGeometry(.22,.035,6,16),new THREE.MeshStandardMaterial({color:col('brass'),roughness:.6}));
  mark.position.set(0,.1,.445);body.add(mark);
  const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),direction=new THREE.Vector3();
  function lineOfSight(from,to){
    origin.set(from.x,from.y,from.z);direction.set(to.x,to.y,to.z).sub(origin);
    const distance=direction.length();ray.set(origin,direction.normalize());ray.near=.001;ray.far=Math.max(.001,distance-.001);
    const meshes=blockingMeshes();for(const mesh of meshes) mesh.updateWorldMatrix(true,false);
    return ray.intersectObjects(meshes,false).length===0;
  }
  const combat=createTarget({position:{x:3.8,y:floor+.8,z:32},lineOfSight});
  const warning=new THREE.Mesh(new THREE.RingGeometry(.72,.8,32),new THREE.MeshBasicMaterial({color:col('ochre'),side:THREE.DoubleSide,transparent:true,opacity:.8}));
  warning.rotation.x=-Math.PI/2;warning.visible=false;root.add(warning);
  function paintGuardian(state){
    warning.visible=state.phase==='windup';
    if(warning.visible){warning.position.set(state.locked.x-root.position.x,state.locked.y-root.position.y+.035,state.locked.z-root.position.z);warning.material.opacity=.45+.5*(1-state.remaining/.8);body.rotation.x-=.12*(1-state.remaining/.8);}
    mark.material.color.copy(col(warning.visible?'ochre':'brass'));
  }
  function paint(state=combat.snapshot()) {
    const recoil=state.hitAge<.2?Math.sin(state.hitAge/.2*Math.PI)*.12:0;
    body.rotation.x=state.defeated?.35:recoil;body.scale.y=state.defeated?.45:1;body.position.y=.65*body.scale.y;
    material.color.copy(col(state.defeated?'slate':state.hitAge<.2?'ochre':'chalkShade'));return state;
  }
  paint();return {root,combat,paint,paintGuardian,lineOfSight};
}
