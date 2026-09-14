const point = p => p && ['x', 'y', 'z'].every(k => Number.isFinite(p[k]));
export const CHARGE = Object.freeze({ windup: 1.1, duration: .8, recovery: 1.4, speed: 5, returnSpeed: 1.3, detection: 6, leash: 8 });

// Feet coordinates. Damage is an event for the combat owner, never private player HP.
export function createCharger({ home, terrain, canMove = () => true, lineOfSight = () => true }) {
  if (!point(home) || typeof terrain?.heightAt !== 'function' || typeof canMove !== 'function' || typeof lineOfSight !== 'function') throw new TypeError('Charger requires home and terrain');
  const origin = Object.freeze({ ...home });
  let position, phase, remaining, direction, locked, sequence, hitConsumed, blocked;
  function reset() {
    position = { ...origin }; phase = 'idle'; remaining = 0; direction = { x: 0, z: -1 };
    locked = null; sequence = 0; hitConsumed = false; blocked = false; return snapshot();
  }
  function snapshot() { return { position: { ...position }, phase, remaining, direction: { ...direction }, locked: locked ? { ...locked } : null, sequence, blocked }; }
  function moveToward(dx, dz, distance) {
    const length = Math.hypot(dx, dz); if (length < 1e-9) return true;
    const travel = Math.min(length, distance), next = { x: position.x + dx / length * travel, y: position.y, z: position.z + dz / length * travel };
    for (const [ox, oz] of [[0, 0], [-.5, -.5], [-.5, .5], [.5, -.5], [.5, .5]]) {
      const floor = terrain.heightAt(next.x + ox, next.z + oz);
      if (!Number.isFinite(floor) || Math.abs(floor - position.y) > .5) return false;
      if (ox === 0 && oz === 0) next.y = floor;
    }
    if (!canMove(position, next)) return false;
    position = next; direction = { x: dx / length, z: dz / length }; return true;
  }
  function advance(dt, player, { paused = false, defeated = false } = {}) {
    if (!Number.isFinite(dt) || dt < 0 || dt > .25 || !point(player) || typeof paused !== 'boolean' || typeof defeated !== 'boolean') throw new TypeError('Valid fixed charger frame required');
    const hits = [];
    if (defeated) { phase = 'defeated'; remaining = 0; locked = null; return { ...snapshot(), hits }; }
    if (paused || dt === 0 || phase === 'defeated') return { ...snapshot(), hits };
    let budget = dt;
    while (budget > 1e-10) {
      const step = Math.min(budget, 1 / 120, remaining > 1e-10 ? remaining : Infinity); budget -= step;
      if (phase === 'idle') {
        const distance = Math.hypot(player.x - position.x, player.z - position.z);
        if (distance > CHARGE.detection || Math.hypot(player.x - origin.x, player.z - origin.z) > CHARGE.leash || Math.abs(player.y - position.y) > 1.2 || !lineOfSight(position, player)) continue;
        locked = { ...player }; direction = distance > 1e-9 ? { x: (player.x - position.x) / distance, z: (player.z - position.z) / distance } : { x: 0, z: -1 };
        phase = 'windup'; remaining = CHARGE.windup; sequence++; hitConsumed = false; blocked = false;
      }
      if (phase === 'return') {
        if (Math.hypot(position.x - origin.x, position.z - origin.z) < .02) { phase = 'idle'; continue; }
        blocked = !moveToward(origin.x - position.x, origin.z - position.z, CHARGE.returnSpeed * step); continue;
      }
      const spent = Math.min(step, remaining); remaining -= spent;
      if (phase === 'charge') {
        // Unit direction stays locked; use a long ray so each step can travel its full budget.
        blocked = !moveToward(direction.x * 10, direction.z * 10, CHARGE.speed * spent);
        if (blocked) remaining = 0;
        if (!blocked && !hitConsumed && Math.hypot(player.x - position.x, player.z - position.z) <= .75 && Math.abs(player.y - position.y) <= 1.2 && lineOfSight(position, player)) {
          hitConsumed = true; hits.push({ sequence, offset: dt - budget });
        }
      }
      if (remaining <= 1e-10) {
        if (phase === 'windup') { phase = 'charge'; remaining = CHARGE.duration; }
        else if (phase === 'charge') { phase = 'recovery'; remaining = CHARGE.recovery; locked = null; }
        else { phase = 'return'; remaining = 0; }
      }
    }
    return { ...snapshot(), hits };
  }
  reset(); return { advance, snapshot, reset };
}
