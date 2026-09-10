export const MOVEMENT = Object.freeze({ step: 1 / 120, maxFrame: .25, walk: 3.2, run: 6, gravity: 20, jumpSpeed: 7, coyote: .1, jumpBuffer: .12, maxStep: .5, staminaMax: 100, sprintDrain: 24, staminaRecovery: 28, waterHeight: -18 });

function intent(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Input object required');
  const result = { x: 0, z: 0, yaw: 0, sprint: false, jumpPressed: false, ...value };
  for (const key of ['x', 'z', 'yaw']) if (!Number.isFinite(result[key])) throw new TypeError(`Finite ${key} required`);
  if (Math.abs(result.x) > 1 || Math.abs(result.z) > 1) throw new RangeError('Movement axes must be within [-1, 1]');
  for (const key of ['sprint', 'jumpPressed']) if (typeof result[key] !== 'boolean') throw new TypeError(`Boolean ${key} required`);
  return result;
}

export function createSimulation({ terrain, checkpoint = { x: 0, z: 35 }, progress = {}, waterHeight = MOVEMENT.waterHeight }) {
  if (typeof terrain?.heightAt !== 'function') throw new TypeError('Terrain adapter required');
  if (!Number.isFinite(waterHeight)) throw new TypeError('Finite water height required');
  function safePoint(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) throw new TypeError('Finite checkpoint required');
    const y = terrain.heightAt(point.x, point.z);
    if (!Number.isFinite(y) || y <= waterHeight) throw new RangeError('Checkpoint must be above water on terrain');
    // Keep a modest footprint away from edges; only caller-approved safe points enter here.
    for (const [dx, dz] of [[.4, 0], [-.4, 0], [0, .4], [0, -.4]]) {
      const nearby = terrain.heightAt(point.x + dx, point.z + dz);
      if (!Number.isFinite(nearby) || Math.abs(nearby - y) > MOVEMENT.maxStep) throw new RangeError('Unsafe checkpoint footprint');
    }
    return { x: point.x, y, z: point.z };
  }
  let safe = safePoint(checkpoint), position = { ...safe }, velocity = { x: 0, y: 0, z: 0 };
  let persistent = structuredClone(progress), accumulator = 0, tick = 0, grounded = true;
  let coyote = MOVEMENT.coyote, buffer = 0, stamina = MOVEMENT.staminaMax, exhausted = false, respawns = 0;
  let current = intent({}), sprinting = false;
  const snapshot = () => ({ tick, position: { ...position }, velocity: { ...velocity }, grounded,
    mode: grounded ? (sprinting ? 'running' : Math.hypot(velocity.x, velocity.z) > 0 ? 'walking' : 'idle') : velocity.y > 0 ? 'rising' : 'falling',
    sprinting,
    stamina, checkpoint: { ...safe }, progress: structuredClone(persistent), respawns });
  function step() {
    const dt = MOVEMENT.step;
    if (grounded) coyote = MOVEMENT.coyote;
    if (!current.sprint) exhausted = false;
    const length = Math.hypot(current.x, current.z), divisor = Math.max(1, length);
    const running = grounded && current.sprint && !exhausted && length > 0 && stamina > 0;
    const speed = running ? MOVEMENT.run : MOVEMENT.walk;
    const x = current.x / divisor, z = current.z / divisor;
    velocity.x = (x * Math.cos(current.yaw) + z * Math.sin(current.yaw)) * speed;
    velocity.z = (-x * Math.sin(current.yaw) + z * Math.cos(current.yaw)) * speed;
    if (buffer > 0 && coyote > 0) { velocity.y = MOVEMENT.jumpSpeed; grounded = false; coyote = 0; buffer = 0; }
    const previousY = position.y, previousX = position.x, previousZ = position.z;
    position.x += velocity.x * dt; position.z += velocity.z * dt;
    const floor = terrain.heightAt(position.x, position.z);
    if (grounded && floor !== null && floor - previousY > MOVEMENT.maxStep) {
      // An unwalkable upward ledge must block the proposed step, not put feet under its top.
      position.x = previousX; position.z = previousZ; velocity.x = 0; velocity.z = 0; velocity.y = 0;
    } else if (grounded && floor !== null && Math.abs(floor - previousY) <= MOVEMENT.maxStep) {
      position.y = floor; velocity.y = 0;
    } else {
      grounded = false; velocity.y -= MOVEMENT.gravity * dt; position.y += velocity.y * dt;
      if (floor !== null && velocity.y <= 0 && previousY >= floor - 1e-8 && position.y <= floor) {
        grounded = true; position.y = floor; velocity.y = 0;
      }
    }
    stamina = Math.max(0, Math.min(MOVEMENT.staminaMax, stamina + (running ? -MOVEMENT.sprintDrain : grounded ? MOVEMENT.staminaRecovery : 0) * dt));
    if (stamina === 0) exhausted = true;
    sprinting = grounded && running;
    coyote = Math.max(0, coyote - dt); buffer = Math.max(0, buffer - dt);
    if (position.y <= waterHeight) {
      position = { ...safe }; velocity = { x: 0, y: 0, z: 0 }; grounded = true;
      coyote = MOVEMENT.coyote; buffer = 0; stamina = MOVEMENT.staminaMax; sprinting = false; current = intent({}); respawns++;
    }
    tick++;
  }
  return Object.freeze({
    snapshot,
    advance(dt, input = {}) {
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Finite nonnegative dt required');
      const validated = intent(input); // invalid input must not partially advance state
      current = validated;
      if (current.jumpPressed) buffer = MOVEMENT.jumpBuffer;
      const accepted = Math.min(dt, MOVEMENT.maxFrame);
      accumulator += accepted;
      let steps = 0;
      while (accumulator + 1e-12 >= MOVEMENT.step && steps < 30) { step(); accumulator = Math.max(0, accumulator - MOVEMENT.step); steps++; }
      return { ...snapshot(), alpha: accumulator / MOVEMENT.step, steps, droppedTime: dt - accepted };
    },
    clearInput() { current = intent({}); buffer = 0; accumulator = 0; },
    setCheckpoint(point) { safe = safePoint(point); return { ...safe }; },
    setProgress(value) { persistent = structuredClone(value); },
  });
}
