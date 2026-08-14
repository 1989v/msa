// Math / RNG / timing primitives shared by every subsystem.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const sat = (v) => clamp(v, 0, 1);

// Frame-rate independent exponential approach.
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function approach(cur, target, delta) {
  if (cur < target) return Math.min(cur + delta, target);
  return Math.max(cur - delta, target);
}

export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}

export function angleApproach(a, b, maxStep) {
  const d = angleDiff(a, b);
  return a + clamp(d, -maxStep, maxStep);
}

// --- easing ---
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInCubic = (t) => t * t * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  const c4 = TAU / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** mulberry32 — small, fast, seedable. Every run is reproducible from its seed. */
export class Rng {
  constructor(seed = Date.now() >>> 0) {
    this.s = seed >>> 0;
  }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  bool(p = 0.5) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Weighted pick. `items` is [{w, ...}] or paired with a weight accessor. */
  weighted(items, wf = (o) => o.w) {
    let total = 0;
    for (const it of items) total += wf(it);
    let r = this.next() * total;
    for (const it of items) {
      r -= wf(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
  angle() { return this.next() * TAU; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

export const rng = new Rng((Math.random() * 0xffffffff) >>> 0);

/** Cheap value-noise, used for screen shake and organic wobble. */
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => {
    let t = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    t ^= t >>> 13;
    t = Math.imul(t, 0xc2b2ae35);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296 * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

/** Circle-vs-circle push-apart. Mutates nothing; returns the separation vector. */
export function separate(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  const d2 = dx * dx + dy * dy;
  const r = ar + br;
  if (d2 >= r * r || d2 === 0) return null;
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  return { x: dx * push, y: dy * push, d };
}

/** True when `px,py` is inside the cone at `ox,oy` facing `ang` with half-width `half`. */
export function inCone(ox, oy, ang, half, range, px, py) {
  const dx = px - ox, dy = py - oy;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range) return false;
  const a = Math.atan2(dy, dx);
  return Math.abs(angleDiff(ang, a)) <= half;
}

/** Shortest distance from point p to segment ab — used for beam / harpoon hits. */
export function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 === 0 ? 0 : clamp((apx * abx + apy * aby) / ab2, 0, 1);
  const cx = ax + abx * t, cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

export function formatInt(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Small object pool so particle churn does not thrash the GC mid-fight. */
export class Pool {
  constructor(factory, reset) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
  }
  get() {
    const o = this.free.pop() || this.factory();
    this.reset(o);
    return o;
  }
  put(o) {
    if (this.free.length < 512) this.free.push(o);
  }
}
