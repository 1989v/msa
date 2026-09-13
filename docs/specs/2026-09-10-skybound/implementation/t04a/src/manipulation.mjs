const EPS = 1e-9;
const axes = ['x', 'y', 'z'];
function vector(v) {
  if (!v || !axes.every(k => Number.isFinite(v[k]))) throw new TypeError('Finite xyz required');
  return Object.fromEntries(axes.map(k => [k, v[k]]));
}
function box(b) {
  const min = vector(b?.min), max = vector(b?.max);
  if (!axes.every(k => max[k] > min[k])) throw new RangeError('Positive AABB dimensions required');
  return { min, max };
}
function pose(p) {
  const position = vector(p?.position), yaw = p?.yaw ?? 0;
  if (!Number.isFinite(yaw) || yaw % 90 !== 0) throw new RangeError('Yaw must be a finite quarter turn in degrees');
  return { position, yaw: ((yaw % 360) + 360) % 360 };
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function overlaps(a, b) {
  return axes.every(k => a.min[k] < b.max[k] - EPS && a.max[k] > b.min[k] + EPS);
}
// Open-interior slab test: touching a face/edge alone does not block.
export function segmentHitsBox(from, to, bounds) {
  const a = vector(from), b = vector(to), target = box(bounds);
  let enter = 0, exit = 1;
  for (const k of axes) {
    const lo = target.min[k] + EPS, hi = target.max[k] - EPS, delta = b[k] - a[k];
    if (Math.abs(delta) < EPS) { if (a[k] <= lo || a[k] >= hi) return false; }
    else {
      const t0 = (lo - a[k]) / delta, t1 = (hi - a[k]) / delta;
      enter = Math.max(enter, Math.min(t0, t1)); exit = Math.min(exit, Math.max(t0, t1));
      if (enter >= exit) return false;
    }
  }
  return enter < exit;
}
export function objectBounds(object, at = object) {
  const { position, yaw } = pose(at), size = vector(object.size);
  if (!axes.every(k => size[k] > 0)) throw new RangeError('Positive object dimensions required');
  const half = { x: (yaw % 180 ? size.z : size.x) / 2, y: size.y / 2, z: (yaw % 180 ? size.x : size.z) / 2 };
  return { min: Object.fromEntries(axes.map(k => [k, position[k] - half[k]])), max: Object.fromEntries(axes.map(k => [k, position[k] + half[k]])) };
}

export function createManipulation({ objects, walls = [], reach = 4, lineOfSight = () => true, resolvePlacement = (object, at) => ({ pose: at, reason: null }) }) {
  if (!Array.isArray(objects) || !Array.isArray(walls) || !Number.isFinite(reach) || reach <= 0 || typeof lineOfSight !== 'function' || typeof resolvePlacement !== 'function') throw new TypeError('Objects, walls, positive reach and LOS function required');
  const ids = new Set();
  const originals = objects.map(o => {
    if (!o || typeof o.id !== 'string' || !o.id || ids.has(o.id) || !['stone', 'prism'].includes(o.kind)) throw new TypeError('Unique allowed stone/prism ID required');
    ids.add(o.id); const value = { id: o.id, kind: o.kind, size: vector(o.size), ...pose(o) }; objectBounds(value); return value;
  });
  freeze(originals); const obstacles = freeze(walls.map(box));
  const initial = () => freeze({ objects: structuredClone(originals), selected: null, held: null, preview: null, paused: false });
  let state = initial();
  const snapshot = () => state;
  function context(value) {
    if (value?.walls !== undefined && !Array.isArray(value.walls)) throw new TypeError('Frame walls must be an array');
    return { eye: vector(value?.eye), player: box(value?.player), walls: [...obstacles, ...(value?.walls ?? []).map(box)] };
  }
  function visible(at, ctx) {
    if (Math.hypot(...axes.map(k => at.position[k] - ctx.eye[k])) > reach + EPS) return 'range';
    if (ctx.walls.some(b => segmentHitsBox(ctx.eye, at.position, b)) || lineOfSight(freeze({ ...ctx.eye }), freeze({ ...at.position })) !== true) return 'occluded';
    return null;
  }
  // Optional pure adapter may snap a candidate or reject support before any mutation.
  function resolve(object, at) {
    const result = resolvePlacement(freeze(structuredClone(object)), freeze(structuredClone(at)));
    if (!result || (result.reason !== null && typeof result.reason !== 'string')) throw new TypeError('Placement resolver requires pose and nullable reason');
    return { pose: pose(result.pose), reason: result.reason };
  }
  function placement(object, at, ctx, from) {
    const reason = visible(at, ctx); if (reason) return reason;
    const others = [...ctx.walls, ctx.player, ...state.objects.filter(o => o.id !== object.id).map(o => objectBounds(o))];
    const target = objectBounds(object, at);
    if (others.some(b => overlaps(target, b))) return 'overlap';
    if (from) {
      const start = objectBounds(object, from);
      const rotating = at.yaw !== from.yaw;
      const radial = Math.hypot(object.size.x, object.size.z) / 2;
      const half = Object.fromEntries(axes.map(k => [k, rotating && k !== 'y' ? radial : Math.max(target.max[k] - at.position[k], start.max[k] - from.position[k])]));
      if (others.some(b => segmentHitsBox(from.position, at.position, {
        min: Object.fromEntries(axes.map(k => [k, b.min[k] - half[k]])),
        max: Object.fromEntries(axes.map(k => [k, b.max[k] + half[k]])),
      }))) return 'sweep';
    }
    return null;
  }
  function dispatch(action, frame) {
    if (!action || typeof action.type !== 'string') throw new TypeError('Action required');
    const reject = reason => ({ ok: false, reason, state });
    if (action.type === 'reset') { state = initial(); return { ok: true, state }; }
    if (action.type === 'pause' || action.type === 'resume') {
      state = freeze({ ...state, paused: action.type === 'pause' }); return { ok: true, state };
    }
    if (!['select', 'grab', 'move', 'rotate', 'drop', 'cancel'].includes(action.type)) throw new TypeError('Unknown manipulation action');
    if (state.paused) return reject('paused');
    if (action.type === 'cancel') { state = freeze({ ...state, selected: null, held: null, preview: null }); return { ok: true, state }; }
    const ctx = context(frame);
    if (action.type === 'select') {
      if (state.held) return reject('held');
      const object = state.objects.find(o => o.id === action.id); if (!object) return reject('unknown');
      const reason = visible(object, ctx); if (reason) return reject(reason);
      state = freeze({ ...state, selected: object.id });
    } else if (action.type === 'grab') {
      if (state.held) return reject('held');
      const object = state.objects.find(o => o.id === state.selected); if (!object) return reject('selection');
      const resolved = resolve(object, object);
      const reason = resolved.reason || placement(object, resolved.pose, ctx); if (reason) return reject(reason);
      state = freeze({ ...state, held: { id: object.id, ...resolved.pose }, preview: null });
    } else {
      if (!state.held) return reject('empty');
      const object = state.objects.find(o => o.id === state.held.id);
      const candidate = action.type === 'move' ? pose({ position: action.position, yaw: state.held.yaw })
        : action.type === 'rotate' ? pose({ position: state.held.position, yaw: action.yaw })
          : pose(state.preview?.pose ?? state.held);
      const resolved = resolve(object, candidate), at = resolved.pose;
      const reason = resolved.reason || placement(object, at, ctx, state.held);
      if (action.type === 'drop') {
        if (reason) return reject(reason);
        state = freeze({ ...state, objects: state.objects.map(o => o.id === object.id ? { ...o, ...at } : o), held: null, selected: null, preview: null });
      } else {
        state = freeze({ ...state, held: reason ? state.held : { id: object.id, ...at }, preview: { pose: at, valid: !reason, reason } });
        if (reason) return reject(reason);
      }
    }
    return { ok: true, state };
  }
  // Diagnostic committed poses only, not a game-save schema. Held/preview never enter it.
  return Object.freeze({ snapshot, dispatch, committedSnapshot: () => state.objects });
}
