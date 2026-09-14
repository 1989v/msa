// Presentation-only cadence: actual travel prevents footsteps against a wall.
export function createFootsteps(play) {
  let previous = null, distance = 0;
  const reset = () => { previous = null; distance = 0; };
  return {
    reset,
    update(snapshot, elapsed, { blocked = false, respawned = false } = {}) {
      if (respawned || blocked || !snapshot.grounded || snapshot.dodge.active) { reset(); return; }
      if (!(elapsed > 0)) return;
      const position = snapshot.position;
      const speed = Math.hypot(snapshot.velocity.x, snapshot.velocity.z);
      if (speed < .1) { reset(); return; }
      const travelled = previous ? Math.hypot(position.x - previous.x, position.z - previous.z) : 0;
      previous = { x: position.x, z: position.z };
      // Discontinuous relocation must never generate a burst of queued steps.
      if (travelled > 8 * elapsed + .05) { distance = 0; return; }
      distance += travelled;
      const stride = 1.2 + Math.min(speed, 6) * .1;
      if (distance >= stride) { distance %= stride; play('step'); }
    },
  };
}
