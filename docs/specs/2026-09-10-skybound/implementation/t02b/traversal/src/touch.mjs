// Pure pointer ownership; DOM capture and lifecycle belong to the viewer.
export function createTouchInput({ radius = 40 } = {}) {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Positive joystick radius required');
  const owners = { move: null, look: null, sprint: null, jump: null };
  let x = 0, z = 0, jumpPending = false;
  const point = (x, y) => { if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Finite touch coordinates required'); };
  function begin(role, id, px = 0, py = 0) {
    if (!Object.hasOwn(owners, role) || !Number.isInteger(id) || id < 0) throw new TypeError('Known role and pointer ID required');
    point(px, py);
    if (owners[role] || Object.values(owners).some(owner => owner?.id === id)) return false;
    owners[role] = { id, x: px, y: py };
    if (role === 'jump') jumpPending = true;
    return true;
  }
  function move(id, px, py) {
    point(px, py);
    if (owners.move?.id === id) {
      const dx = (px - owners.move.x) / radius, dz = (py - owners.move.y) / radius;
      const length = Math.max(1, Math.hypot(dx, dz)); x = dx / length; z = dz / length;
    }
    if (owners.look?.id === id) {
      const delta = { dx: px - owners.look.x, dy: py - owners.look.y };
      owners.look.x = px; owners.look.y = py; return delta;
    }
    return null;
  }
  function end(id, { cancel = false } = {}) {
    for (const role of Object.keys(owners)) if (owners[role]?.id === id) {
      owners[role] = null;
      if (role === 'move') { x = 0; z = 0; }
      if (role === 'jump' && cancel) jumpPending = false;
      return true;
    }
    return false;
  }
  function clear() { Object.keys(owners).forEach(role => { owners[role] = null; }); x = 0; z = 0; jumpPending = false; }
  return { begin, move, end, clear,
    consumeJump() { const pulse = jumpPending; jumpPending = false; return pulse; },
    snapshot() { return { x, z, sprint: owners.sprint !== null, moveId: owners.move?.id ?? null, lookId: owners.look?.id ?? null,
      sprintId: owners.sprint?.id ?? null, jumpId: owners.jump?.id ?? null, jumpPending }; },
  };
}
