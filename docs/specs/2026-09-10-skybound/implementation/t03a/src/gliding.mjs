// Skybound SR-2 rule slice. Caller owns position, shared stamina and fixed ticks.
export const GLIDING = Object.freeze({ maxStep: 1 / 30, staminaMax: 100,
  drain: 12, groundRecovery: 28, sprintDrain: 24, windRecovery: 18,
  terminalDescent: -2.5, maxWindSpeed: 6, acceleration: 18 });
const finite = value => { if (!Number.isFinite(value)) throw new TypeError('Finite flight values required'); };
const bool = value => { if (typeof value !== 'boolean') throw new TypeError('Boolean flight flags required'); };
const clampStamina = value => Math.max(0, Math.min(GLIDING.staminaMax, value));

export function stepGliding(state, frame, volumes = []) {
  if (!state || !frame || !frame.position) throw new TypeError('State, frame and position required');
  const { dt, grounded, position, actionPressed = false, sprinting = false, reset = false } = frame;
  [dt, state.stamina, state.velocityY, position.x, position.y, position.z].forEach(finite);
  [state.deployed, grounded, actionPressed, sprinting, reset].forEach(bool);
  if (dt < 0 || dt > GLIDING.maxStep) throw new RangeError('Use fixed dt within [0, 1/30] seconds');
  if (!Array.isArray(volumes)) throw new TypeError('Wind volumes must be an array');
  let windSpeed = 0;
  for (const volume of volumes) {
    if (!volume) throw new TypeError('Wind volume required');
    const { x, z, radius, minY, maxY, speed } = volume;
    [x, z, radius, minY, maxY, speed].forEach(finite);
    if (radius <= 0 || maxY <= minY || speed < 0) throw new RangeError('Invalid wind cylinder');
    // Closed radial/bottom boundary; open top. Overlap uses strongest, never sum.
    if (position.y >= minY && position.y < maxY && Math.hypot(position.x - x, position.z - z) <= radius) {
      windSpeed = Math.max(windSpeed, Math.min(speed, GLIDING.maxWindSpeed));
    }
  }
  let stamina = clampStamina(state.stamina), deployed = state.deployed, velocityY = state.velocityY, glidingTime = 0;
  if (reset) return Object.freeze({ deployed: false, stamina, velocityY, windSpeed, glidingTime });
  if (grounded) {
    stamina = clampStamina(stamina + (sprinting ? -GLIDING.sprintDrain : GLIDING.groundRecovery) * dt);
    return Object.freeze({ deployed: false, stamina, velocityY, windSpeed, glidingTime });
  }
  if (stamina === 0) deployed = false;
  // No private input buffer: route a press only on a real fixed tick.
  if (dt > 0 && actionPressed) deployed = deployed ? false : stamina > 0;
  if (deployed && dt > 0) {
    const rate = windSpeed > 0 ? GLIDING.windRecovery : -GLIDING.drain;
    // If exhaustion occurs inside this tick, the sail acts only for its funded time.
    const activeTime = rate < 0 ? Math.min(dt, stamina / -rate) : dt;
    glidingTime = activeTime;
    const target = windSpeed > 0 ? windSpeed : GLIDING.terminalDescent;
    const change = Math.max(-GLIDING.acceleration * activeTime, Math.min(GLIDING.acceleration * activeTime, target - velocityY));
    velocityY += change;
    stamina = clampStamina(stamina + rate * dt);
    if (stamina === 0) deployed = false;
  }
  return Object.freeze({ deployed, stamina, velocityY, windSpeed, glidingTime });
}
