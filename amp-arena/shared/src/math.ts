export interface Vec3 { x: number; y: number; z: number }

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const len2 = (x: number, z: number) => Math.hypot(x, z);
export const TAU = Math.PI * 2;

/** 바라보는 방향: yaw 0 = +z. 방향 벡터 = (sin yaw, 0, cos yaw) */
export const yawFromDir = (x: number, z: number) => Math.atan2(x, z);
export const dirX = (yaw: number) => Math.sin(yaw);
export const dirZ = (yaw: number) => Math.cos(yaw);

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

/** 결정적 난수 (mulberry32). 봇·아이템 드랍이 쓴다 — 서버·클라 재현이 같아야 한다. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
