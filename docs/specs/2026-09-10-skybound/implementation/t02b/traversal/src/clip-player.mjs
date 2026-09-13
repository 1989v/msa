// Delta advances crossfades; explicit bridge time keeps deterministic phase inspection.
export function createClipPlayer(THREE, root, clips) {
  const mixer = new THREE.AnimationMixer(root), actions = new Map();
  let current = null, blend = null;
  function reset() { mixer.stopAllAction(); mixer.setTime(0); current = null; blend = null; actions.clear(); }
  function apply(motion, dt) {
    if (motion.respawned) reset();
    let action = actions.get(motion.name);
    if (!action) { action = mixer.clipAction(clips[motion.name]); actions.set(motion.name,action); }
    if (current !== action) {
      const weights = new Map([...actions.values()].map(a=>[a,a.enabled && a.isScheduled() ? a.getEffectiveWeight() : 0]));
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).setLoop(motion.once ? THREE.LoopOnce : THREE.LoopRepeat,motion.once ? 1 : Infinity);
      action.clampWhenFinished = motion.once; action.time = motion.time; action.play();
      blend = current ? { weights, elapsed: 0, duration: motion.name === 'attack' ? .10 : .18 } : null;
      current = action;
    }
    if (blend) {
      blend.elapsed = Math.min(blend.duration,blend.elapsed+dt);
      const t=blend.elapsed/blend.duration, ease=t*t*(3-2*t);
      for(const a of actions.values()) {
        const from=blend.weights.get(a) ?? 0;
        a.setEffectiveWeight(from+((a===current?1:0)-from)*ease);
      }
      if(t===1) blend=null;
    }
    mixer.update(dt); action.time = motion.time; mixer.update(0);
    for (const other of actions.values()) if (other !== current && other.getEffectiveWeight() === 0) other.stop();
  }
  return { apply, reset };
}
