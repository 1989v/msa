// Gliding temporarily reuses the original fall clip; dedicated grip pose is pending.
const modes = { idle: 'idle', walking: 'walk', running: 'run', rising: 'jump', falling: 'fall', gliding: 'fall' };
export function createAnimationBridge(durations) {
  let previous = null, name = 'idle', time = 0;
  return {
    update(snapshot, dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Nonnegative animation dt required');
      const mapped = modes[snapshot.mode];
      if (!mapped) throw new Error(`Unknown movement mode ${snapshot.mode}`);
      const respawned = previous !== null && previous.respawns !== snapshot.respawns;
      const moving = Math.hypot(snapshot.velocity.x, snapshot.velocity.z) > .01;
      const landed = previous && !previous.grounded && snapshot.grounded && !respawned;
      let next = mapped;
      if (!respawned && snapshot.grounded && !moving) {
        if (landed || (name === 'land' && time + dt < durations.land)) next = 'land';
      }
      const changed = respawned || next !== name || previous === null;
      time = changed ? 0 : time + dt;
      name = next;
      const once = name === 'jump' || name === 'land';
      time = once ? Math.min(time, durations[name]) : time % durations[name];
      previous = snapshot;
      return { name, time, once, changed, respawned };
    },
  };
}
