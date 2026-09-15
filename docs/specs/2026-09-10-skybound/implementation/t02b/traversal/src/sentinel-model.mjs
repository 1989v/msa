// Original compact quadruped: ceramic shell, articulated stone feet, brass sight.
export function createSentinelModel(T, col) {
  const body = new T.Group(); body.name = 'four foot wind sentinel';
  const material = new T.MeshStandardMaterial({color:col('chalkShade'),roughness:.92});
  const trim = new T.MeshStandardMaterial({color:col('slate'),roughness:.95});
  const brass = new T.MeshStandardMaterial({color:col('brass'),metalness:.5,roughness:.55});
  const profile = new T.Shape();
  profile.moveTo(-.4,-.22);profile.lineTo(.4,-.22);profile.lineTo(.4,.16);profile.lineTo(.23,.3);profile.lineTo(-.23,.3);profile.lineTo(-.4,.16);profile.closePath();
  const shell = new T.ExtrudeGeometry(profile,{depth:.62,steps:1,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:1});shell.translate(0,0,-.31);
  const torso = new T.Mesh(shell,material);torso.castShadow=true;torso.receiveShadow=true;body.add(torso);
  const collar = new T.Mesh(new T.BoxGeometry(.68,.07,.68),trim);collar.position.y=-.16;body.add(collar);
  const mark = new T.Mesh(new T.TorusGeometry(.15,.035,6,20),brass);mark.position.set(0,.07,.39);body.add(mark);
  const eye = new T.Mesh(new T.IcosahedronGeometry(.085,1),brass);eye.position.z=.015;mark.add(eye);
  for (const x of [-.18,0,.18]) {
    const groove=new T.Mesh(new T.BoxGeometry(.035,.018,.36),trim);groove.position.set(x,.32,-.03);body.add(groove);
  }
  const legs=[];
  for (const x of [-1,1]) for (const z of [-1,1]) {
    const pivot=new T.Group();pivot.position.set(x*.39,-.18,z*.25);body.add(pivot);
    const joint=new T.Mesh(new T.SphereGeometry(.11,8,6),brass);pivot.add(joint);
    const shin=new T.Mesh(new T.CylinderGeometry(.075,.11,.25,5),material);shin.position.y=-.17;shin.rotation.z=x*-.18;shin.castShadow=true;pivot.add(shin);
    const foot=new T.Mesh(new T.BoxGeometry(.2,.12,.23),trim);foot.position.set(x*.035,-.36,.035);foot.castShadow=true;pivot.add(foot);
    legs.push({pivot,offset:x===z?0:Math.PI});
  }
  let phase=0,moving=false;
  return {body,material,mark,travel(distance){
    moving=distance>1e-5&&distance<.4;if(moving)phase+=distance*9;
    for(const {pivot,offset} of legs){const wave=moving?Math.sin(phase+offset):0;pivot.rotation.x=wave*.3;pivot.position.y=-.18+Math.max(0,wave)*.055;}
  },bob:()=>moving?Math.abs(Math.sin(phase))*.025:0};
}
