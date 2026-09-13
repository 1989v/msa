// Short torso/arm lean only: preserve planted leg geometry, no roll/root displacement.
export function createDodgePose(THREE,root) {
  const names=['spine','chest','upperArm_L','upperArm_R'];
  const bones=names.map(name=>{const bone=root.getObjectByName(name);if(!bone?.isBone)throw new Error(`Dodge needs ${name}`);return bone;});
  const saved=bones.map(b=>b.quaternion.clone()),axis=new THREE.Vector3(1,0,0),q=new THREE.Quaternion();let applied=false;
  function restore(){if(applied)bones.forEach((b,i)=>b.quaternion.copy(saved[i]));applied=false;}
  function apply(state){
    if(!state.active)return;
    const strength=Math.sin(Math.min(1,state.elapsed/.28)*Math.PI);
    bones.forEach((bone,i)=>{saved[i].copy(bone.quaternion);bone.quaternion.multiply(q.setFromAxisAngle(axis,[.24,-.06,-.22,-.22][i]*strength));});
    applied=true;
  }
  return {apply,restore};
}
