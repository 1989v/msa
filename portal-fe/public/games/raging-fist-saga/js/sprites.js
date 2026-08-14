// 스프라이트 베이커: 리그를 프레임 단위로 구워 외곽선 + 15비트 양자화 후 크롭 저장.
// 스테이지별로 필요한 캐릭터만 굽는다 (초기 로딩 단축).

import { makeCanvas, rad } from './core.js';
import { drawFighter, BOX_W, BOX_H, ANCHOR_X, ANCHOR_Y } from './rig.js';
import { CLIPS } from './anim.js';
import { CHARS } from './chars.js';

const bank = new Map();
export const sprites = (id) => bank.get(id);
export const isBaked = (id) => bank.has(id);

const scratch = makeCanvas(BOX_W, BOX_H);
const sil = makeCanvas(BOX_W, BOX_H);
const out = makeCanvas(BOX_W, BOX_H);
const OUTLINE = '#100c18';
const RIM = '#ffe4b8';
const OFF = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

const Q = new Uint8Array(256);
for (let i = 0; i < 256; i++) Q[i] = (i & 0xf8) | (i >> 5);

function bakeFrame(style, pose, metrics) {
  const a = scratch.ctx;
  a.clearRect(0, 0, BOX_W, BOX_H);
  a.save();
  a.translate(ANCHOR_X, ANCHOR_Y);
  const sk = drawFighter(a, style, pose, metrics);
  a.restore();

  const s = sil.ctx;
  s.clearRect(0, 0, BOX_W, BOX_H);
  s.globalCompositeOperation = 'source-over';
  s.drawImage(scratch.c, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = OUTLINE;
  s.fillRect(0, 0, BOX_W, BOX_H);
  s.globalCompositeOperation = 'source-over';

  const o = out.ctx;
  o.clearRect(0, 0, BOX_W, BOX_H);
  for (const [dx, dy] of OFF) o.drawImage(sil.c, dx, dy);
  // 광원(우상단) 쪽 외곽선만 밝게 — 어두운 캐릭터가 배경에 묻히지 않는다
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = RIM;
  s.fillRect(0, 0, BOX_W, BOX_H);
  s.globalCompositeOperation = 'source-over';
  o.globalAlpha = 0.55;
  o.drawImage(sil.c, 1, -1);
  o.drawImage(sil.c, 0, -1);
  o.globalAlpha = 1;
  o.drawImage(scratch.c, 0, 0);

  // 양자화 + 바운딩 박스를 한 번의 픽셀 순회로 처리
  const img = o.getImageData(0, 0, BOX_W, BOX_H);
  const d = img.data;
  let x0 = BOX_W, y0 = BOX_H, x1 = -1, y1 = -1;
  for (let y = 0; y < BOX_H; y++) {
    const row = y * BOX_W * 4;
    for (let x = 0; x < BOX_W; x++) {
      const i = row + x * 4;
      if (d[i + 3] < 26) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      d[i] = Q[d[i]]; d[i + 1] = Q[d[i + 1]]; d[i + 2] = Q[d[i + 2]];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 1; }
  o.putImageData(img, 0, 0);

  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const cut = makeCanvas(w, h);
  cut.ctx.drawImage(out.c, -x0, -y0);

  // 손 좌표는 발밑 기준. rot 포즈는 힙 중심 회전을 수동 적용.
  let hand = sk.arms[pose.frontArm ?? 1].hand;
  let handA = sk.arms[pose.frontArm ?? 1].angle;
  if (pose.rot) {
    const c = Math.cos(rad(pose.rot)), s2 = Math.sin(rad(pose.rot));
    const dx = hand[0] - sk.hip[0], dy = hand[1] - sk.hip[1];
    hand = [sk.hip[0] + dx * c - dy * s2, sk.hip[1] + dx * s2 + dy * c];
    handA += pose.rot;
  }
  return {
    c: cut.c, w, h,
    ox: x0 - ANCHOR_X, oy: y0 - ANCHOR_Y,
    hand: [hand[0], hand[1]], handA,
    head: [sk.headC[0], sk.headC[1]],
  };
}

/** 굽기 작업 목록 생성 */
function jobsFor(ids) {
  const jobs = [];
  for (const id of ids) {
    if (bank.has(id)) continue;
    const def = CHARS[id];
    if (!def) continue;
    const clips = {};
    bank.set(id, clips);
    for (const name of def.clips) {
      const clip = CLIPS[name];
      if (!clip) continue;
      const arr = new Array(clip.n);
      clips[name] = arr;
      for (let i = 0; i < clip.n; i++) jobs.push({ def, clip, i, arr });
    }
  }
  return jobs;
}

/** 시간 예산을 나눠 비동기로 굽는다. onProgress(0..1) */
export function bakeChars(ids, onProgress) {
  const jobs = jobsFor(ids);
  const total = jobs.length;
  if (!total) { onProgress?.(1); return Promise.resolve(); }
  let n = 0;
  return new Promise((resolve) => {
    const step = () => {
      const t0 = performance.now();
      while (n < total && performance.now() - t0 < 10) {
        const j = jobs[n++];
        j.arr[j.i] = bakeFrame(j.def.style, j.clip.pose(j.i, j.clip.n), j.def.metrics);
      }
      onProgress?.(n / total);
      if (n < total) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** 베이크된 프레임을 화면에 그린다. (fx, fy) = 발밑 위치, dir = 1|-1 */
export function drawSprite(ctx, frame, fx, fy, dir, alpha = 1) {
  if (!frame) return;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.translate(fx | 0, fy | 0);
  if (dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(frame.c, frame.ox | 0, frame.oy | 0);
  ctx.restore();
}
