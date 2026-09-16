import {createArchiveSurvey} from '../../../t10a/src/archive-survey.mjs';
export function createArchiveView(T,col,terrain){
 const root=new T.Group();root.name='high archive wind observations';
 const device={x:-48,y:terrain.heightAt(-48,-126),z:-126};
 const rings=[{x:-44,y:device.y+6,z:-126},{x:-51,y:device.y+10,z:-123},{x:-48,y:device.y+14,z:-130}];
 const survey=createArchiveSurvey(rings,device),views=[];
 const plate=new T.Mesh(new T.CylinderGeometry(.65,.8,.4,12),new T.MeshStandardMaterial({color:col('chalk'),roughness:.9}));plate.position.set(device.x,device.y+.2,device.z);plate.castShadow=true;plate.receiveShadow=true;root.add(plate);
 const emblem=new T.Mesh(new T.TorusGeometry(.4,.045,6,24),new T.MeshStandardMaterial({color:col('slate'),metalness:.4,roughness:.6}));emblem.rotation.x=-Math.PI/2;emblem.position.set(device.x,device.y+.43,device.z);root.add(emblem);
 rings.forEach((position,index)=>{
  const group=new T.Group();group.position.copy(position);group.rotation.y=Math.atan2(position.x-device.x,position.z-device.z);root.add(group);
  const material=new T.MeshStandardMaterial({color:col('slate'),metalness:.4,roughness:.6});
  const ring=new T.Mesh(new T.TorusGeometry(1.2,.075,6,40),material);group.add(ring);views.push(ring);
  for(let i=0;i<=index;i++){const mark=new T.Mesh(new T.BoxGeometry(.1,.22,.1),material);mark.position.set((i-index/2)*.2,1.27,0);group.add(mark);}
 });
 return{root,device,rings,meshes:[plate],solidBounds:[{min:{x:device.x-.8,y:device.y,z:device.z-.8},max:{x:device.x+.8,y:device.y+.4,z:device.z+.8}}],
  ...survey,near(position){return Math.hypot(position.x-device.x,position.z-device.z)<=2.2&&Math.abs(position.y-device.y)<=1.2;},
  update(unlocked){const state=survey.snapshot();views.forEach((ring,i)=>ring.material.color.copy(col(i<state.count?'brass':unlocked&&i===state.count?'ochre':'slate')));emblem.material.color.copy(col(state.complete?'brass':'slate'));return state;},
 };
}
