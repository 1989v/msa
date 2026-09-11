// Original pose study only: the game controller owns ballistic root translation.
export const AERIAL_PLAYBACK = Object.freeze({ jump: 'once', fall: 'repeat', land: 'once' });
export function createAerialClips(THREE) {
  const smooth = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  return [['jump', .7], ['fall', 1.2], ['land', .9]].map(([name, duration]) => {
    const times = [], values = new Map();
    const add = (track, v) => { if (!values.has(track)) values.set(track, []); values.get(track).push(...v); };
    for (let frame = 0; frame <= 64; frame++) {
      const t = frame / 64;
      times.push(duration * t);
      let pelvis, lift, strength, lean, arm;
      if (name === 'land') {
        const absorb = smooth(t / .24), recover = smooth((t - .24) / .58);
        pelvis = .825 - .065 * absorb + .11 * recover;
        lift = 0; strength = 1 - smooth((t - .82) / .18);
        lean = .13 * (1 - recover); arm = -.28 * (1 - recover);
      } else if (name === 'jump') {
        const tuck = smooth((t - .3) / .7);
        strength = smooth(t / .12);
        pelvis = .87 - .035 * Math.sin(Math.PI * t) ** 2;
        lift = .10 * tuck; lean = .055 * strength; arm = -.5 * tuck;
      } else {
        const wave = Math.sin(t * Math.PI * 2);
        pelvis = .85; lift = .065 + .008 * wave;
        strength = 1; lean = .065; arm = -.35 + .025 * wave;
      }
      add('hips.position', [0, pelvis, 0]);
      const rotate = (bone, x = 0, y = 0, z = 0) => add(`${bone}.quaternion`, new THREE.Quaternion().setFromEuler(new THREE.Euler(x * strength, y * strength, z * strength)).toArray());
      rotate('spine', lean); rotate('chest', -lean * .25); rotate('head', -lean * .5);
      rotate('capeUpper', -.04 * strength); rotate('capeLower', -.10 * strength);
      for (const [side, sign] of [['L', 1], ['R', -1]]) {
        const down = pelvis + .01 - (.13 + lift), forward = .015;
        const upper = .37, lower = Math.hypot(.38, .015);
        const cosine = (down * down + forward * forward - upper * upper - lower * lower) / (2 * upper * lower);
        if (Math.abs(cosine) > 1 + 1e-8) throw new Error(`${name}: unreachable ankle`);
        const bend = Math.acos(Math.max(-1, Math.min(1, cosine)));
        const thigh = -Math.atan2(forward, down) - Math.atan2(lower * Math.sin(bend), upper + lower * Math.cos(bend));
        const shin = bend + Math.atan2(.015, .38);
        rotate(`thigh_${side}`, thigh); rotate(`shin_${side}`, shin); rotate(`foot_${side}`, -thigh - shin);
        rotate(`upperArm_${side}`, arm, 0, -sign * .18);
        rotate(`forearm_${side}`, -.38);
      }
    }
    return new THREE.AnimationClip(name, duration, [...values].map(([track, v]) => track.endsWith('.position')
      ? new THREE.VectorKeyframeTrack(track, times, v) : new THREE.QuaternionKeyframeTrack(track, times, v)));
  });
}
