// 공용 상수 · 수학 · 색 · 캔버스 유틸.

export const VW = 480;          // 내부 렌더 해상도 (픽셀아트 기준 해상도)
export const VH = 270;
export const GROUND_TOP = 176;  // 벨트(이동 가능 바닥)의 화면상 위쪽 한계
export const GROUND_BOT = 254;  // 아래쪽 한계
export const DEPTH_HIT = 13;    // 같은 "깊이"로 판정하는 허용 오차
export const FPS = 60;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const rad = (deg) => (deg * Math.PI) / 180;
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

// 시각 요소(창문 불빛, 벽돌 얼룩 등)를 매 실행 동일하게 뽑기 위한 시드 RNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rnd = Math.random;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ---- 색 ----
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgbToHex(r, g, b) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** amt<1 어둡게, amt>1 밝게 */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * amt, g * amt, b * amt);
}
/** 두 색 사이 보간 */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---- 캔버스 ----
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: false });
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/** 실루엣을 4방향으로 깔아 1px 외곽선을 만든다 (스프라이트 룩의 핵심). */
export function outline(src, color = '#0b0810') {
  const w = src.width, h = src.height;
  const sil = makeCanvas(w, h);
  sil.ctx.drawImage(src, 0, 0);
  sil.ctx.globalCompositeOperation = 'source-in';
  sil.ctx.fillStyle = color;
  sil.ctx.fillRect(0, 0, w, h);

  const out = makeCanvas(w, h);
  const o = out.ctx;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    o.drawImage(sil.c, dx, dy);
  }
  o.drawImage(src, 0, 0);
  return out.c;
}

// 32비트기 하드웨어의 15비트 컬러를 흉내내 색 계단을 만든다.
const Q = new Uint8Array(256);
for (let i = 0; i < 256; i++) Q[i] = (i & 0xf8) | (i >> 5);

export function quantize(cv) {
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 24) { d[i + 3] = 0; continue; }
    d[i + 3] = d[i + 3] > 160 ? 255 : d[i + 3];
    d[i] = Q[d[i]]; d[i + 1] = Q[d[i + 1]]; d[i + 2] = Q[d[i + 2]];
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** 스프라이트를 단색으로 물들인 사본 (히트 플래시 / 실루엣 연출용) */
export function tinted(src, color) {
  const t = makeCanvas(src.width, src.height);
  t.ctx.drawImage(src, 0, 0);
  t.ctx.globalCompositeOperation = 'source-in';
  t.ctx.fillStyle = color;
  t.ctx.fillRect(0, 0, src.width, src.height);
  return t.c;
}
