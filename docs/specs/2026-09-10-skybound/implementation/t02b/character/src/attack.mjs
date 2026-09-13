// Original Naru right-hand strike, generated against loaded bind frames; no damage.
export function createAttackClip(THREE, root) {
  const duration = .86, times = [0, .16, .29, .4, .62, duration];
  const curves = {
    spine: [[0,0,0],[.015,.12,0],[.06,-.16,0],[.035,-.10,0],[.01,-.02,0],[0,0,0]],
    chest: [[0,0,0],[0,.16,-.03],[.08,-.24,.03],[.035,-.10,0],[0,-.02,0],[0,0,0]],
    head: [[0,0,0],[0,-.12,0],[-.035,.12,0],[0,.06,0],[0,0,0],[0,0,0]],
    upperArm_R: [[0,0,0],[.35,-.15,.25],[-1.5,.05,.22],[-1.15,0,.22],[-.25,0,.16],[0,0,0]],
    forearm_R: [[0,0,0],[-1.2,0,0],[-.12,0,0],[-.4,0,0],[-.55,0,0],[0,0,0]],
    upperArm_L: [[0,0,0],[-.35,0,-.3],[-.55,.10,-.3],[-.4,0,-.3],[-.2,0,-.15],[0,0,0]],
    forearm_L: [[0,0,0],[-1,0,0],[-1.1,0,0],[-.9,0,0],[-.4,0,0],[0,0,0]],
    capeUpper: [[0,0,0],[.03,0,0],[-.04,.03,0],[-.06,0,0],[.02,0,0],[0,0,0]],
  };
  const tracks = Object.entries(curves).map(([name, keys]) => {
    const bone = root.getObjectByName(name); if (!bone?.isBone) throw new Error(`Attack needs ${name}`);
    const values = [], sampleTimes = [], q = new THREE.Quaternion();
    for (let i=0;i<=86;i++) {
      const t=i/100; let k=0; while(k<times.length-2 && t>times[k+1]) k++;
      const u=Math.min(1,(t-times[k])/(times[k+1]-times[k])), eased=u*u*(3-2*u);
      const from=new THREE.Quaternion().setFromEuler(new THREE.Euler(...keys[k]));
      const to=new THREE.Quaternion().setFromEuler(new THREE.Euler(...keys[k+1]));
      q.copy(bone.quaternion).multiply(from.slerp(to,eased)).normalize();
      sampleTimes.push(t);values.push(...q.toArray());
    }
    return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`,sampleTimes,values);
  });
  return new THREE.AnimationClip('attack',duration,tracks);
}
