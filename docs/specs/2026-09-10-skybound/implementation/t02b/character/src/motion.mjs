// Self-authored in-place gait study for Naru's 19-bone rig. No external motion data.
// Rest offsets are the rig contract in model.mjs: hip .88, knee .51, ankle .13m.
// Planar two-link solving happens at authoring time; playback needs only glTF tracks.
export function createLocomotionClips(THREE) {
  const samples = 64;
  const configs = [
    { name: 'walk', duration: 1.12, stride: .17, lift: .075, pelvis: .835, bob: .006, arm: .36, elbow: .24, lean: .025 },
    { name: 'run', duration: .68, stride: .26, lift: .165, pelvis: .805, bob: .012, arm: .64, elbow: .88, lean: .075 },
  ];
  const axisX = new THREE.Vector3(1, 0, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const quaternion = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
  return configs.map(config => {
    const tracks = new Map();
    const times = Array.from({ length: samples + 1 }, (_, i) => i * config.duration / samples);
    function add(name, values) {
      if (!tracks.has(name)) tracks.set(name, []);
      tracks.get(name).push(...values);
    }
    function rotate(name, x, y = 0, z = 0) { add(`${name}.quaternion`, quaternion(x, y, z).toArray()); }
    for (let frame = 0; frame <= samples; frame++) {
      // Use exactly the first phase for the final sample, eliminating loop seams.
      const phase = frame === samples ? 0 : frame / samples;
      const theta = phase * Math.PI * 2;
      const pelvisY = config.pelvis + config.bob * Math.cos(theta * 2);
      add('hips.position', [0, pelvisY, 0]);
      rotate('spine', config.lean, .028 * Math.sin(theta));
      rotate('chest', -.012, -.035 * Math.sin(theta));
      rotate('head', -config.lean * .45, .012 * Math.sin(theta - .3));
      rotate('capeUpper', -.018 + .025 * Math.sin(theta * 2 - .5));
      rotate('capeLower', -.045 + .055 * Math.sin(theta * 2 - .9));
      for (const [side, sign, offset] of [['L', 1, 0], ['R', -1, .5]]) {
        const t = (phase + offset) % 1;
        const angle = t * Math.PI * 2;
        // First half is stance (foot travels rearward), second half is recovery.
        // Sine-squared lift has zero vertical velocity at toe-off and contact.
        const lift = t >= .5 ? config.lift * Math.sin(angle) ** 2 : 0;
        const ankleY = .133 + lift;
        const ankleZ = .015 + config.stride * Math.cos(angle);
        const down = pelvisY + .01 - ankleY;
        const upperLength = .37;
        const lowerLength = Math.hypot(.38, .015);
        const radiusSquared = down * down + ankleZ * ankleZ;
        const cosine = (radiusSquared - upperLength ** 2 - lowerLength ** 2) / (2 * upperLength * lowerLength);
        if (Math.abs(cosine) > 1) throw new Error(`${config.name}: ankle target outside Naru leg reach`);
        const bend = Math.acos(cosine);
        const thigh = -Math.atan2(ankleZ, down) - Math.atan2(lowerLength * Math.sin(bend), upperLength + lowerLength * Math.cos(bend));
        const shin = bend + Math.atan2(.015, .38);
        rotate(`thigh_${side}`, thigh);
        rotate(`shin_${side}`, shin);
        // Keep the sole level in world space; the target controls contact height.
        rotate(`foot_${side}`, -thigh - shin);
        // Lower the authored A-pose toward the body, then swing opposite the leg.
        const arm = new THREE.Quaternion().setFromAxisAngle(axisX, config.arm * Math.cos(angle));
        arm.multiply(new THREE.Quaternion().setFromAxisAngle(axisZ, -sign * .34));
        add(`upperArm_${side}.quaternion`, arm.toArray());
        rotate(`forearm_${side}`, -config.elbow - .075 * Math.sin(angle));
      }
    }
    return new THREE.AnimationClip(config.name, config.duration, [...tracks].map(([name, values]) =>
      name.endsWith('.position')
        ? new THREE.VectorKeyframeTrack(name, times, values)
        : new THREE.QuaternionKeyframeTrack(name, times, values)));
  });
}
