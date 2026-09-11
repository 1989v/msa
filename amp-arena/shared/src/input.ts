// 입력 — 클라가 카메라 기준으로 돌린 월드 방향(mx, mz)과 버튼 비트마스크만 보낸다.
export const BTN_ATTACK = 1;
export const BTN_JUMP = 2;
export const BTN_GUARD = 4;
export const BTN_SPECIAL = 8;
export const BTN_DASH = 16;
export const BTN_PICKUP = 32;
export const BTN_HEAVY = 64;   // 강공 (2026-09-12: 약공·강공 두 키)
export const BTN_ALL = 127;

export interface Input {
  seq: number;
  mx: number;
  mz: number;
  btn: number;
}

export const EMPTY_INPUT: Input = Object.freeze({ seq: 0, mx: 0, mz: 0, btn: 0 });

export const pressed = (cur: number, prev: number, bit: number) => (cur & bit) !== 0 && (prev & bit) === 0;
export const held = (cur: number, bit: number) => (cur & bit) !== 0;

/** 신뢰 경계: 범위 밖 값은 버린다. |m| ≤ 1, 버튼은 정의된 비트만. */
export function sanitizeInput(raw: unknown): Input | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const seq = r.seq, mx = r.mx, mz = r.mz, btn = r.btn;
  if (typeof seq !== 'number' || typeof mx !== 'number' || typeof mz !== 'number' || typeof btn !== 'number') return null;
  if (!Number.isFinite(seq) || !Number.isFinite(mx) || !Number.isFinite(mz) || !Number.isInteger(btn)) return null;
  let x = mx, z = mz;
  const l = Math.hypot(x, z);
  if (l > 1) { x /= l; z /= l; }
  return { seq: seq >>> 0, mx: x, mz: z, btn: btn & BTN_ALL };
}
