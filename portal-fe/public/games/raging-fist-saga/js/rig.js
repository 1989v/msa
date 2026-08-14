// 절차 생성 캐릭터 렌더러.
// 스켈레톤 → 볼륨 있는 사지/의상/머리 → 외곽선 + 15비트 양자화 = 32비트기 스프라이트 룩.
// 전부 오른쪽을 보는 상태로만 굽고, 왼쪽은 런타임에 뒤집는다.

import { rad, shade, mix } from './core.js';

export const BOX_W = 120, BOX_H = 132, ANCHOR_X = 60, ANCHOR_Y = 120;

export const BASE_METRICS = {
  scale: 1, thigh: 21, shin: 19, foot: 8.5, upper: 16, fore: 15,
  torso: 20, neck: 5, headR: 8.6, shoulderW: 15, hipW: 11,
  limbW: 7.4, armW: 6.2, girth: 1,
};

const D = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];     // 0deg = 아래
const U = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];    // 0deg = 위
const add = (p, v, len) => [p[0] + v[0] * len, p[1] + v[1] * len];

/** 포즈 → 관절 좌표. 발바닥이 (0,0), 화면과 같은 y-down 좌표계. */
export function buildSkeleton(pose, M) {
  const s = M.scale;
  const g = M.girth;
  const hip = [(pose.hipX || 0) * s, -(M.thigh + M.shin + M.foot * 0.25 + (pose.hipY || 0)) * s];
  const lean = pose.lean || 0;
  const su = U(lean);
  const chest = add(hip, su, M.torso * s);
  const neck = add(chest, su, M.neck * s);
  const headC = add(neck, U(lean + (pose.head || 0)), M.headR * s * 0.95);

  const twist = (pose.twist || 0) * s;
  const shW = M.shoulderW * s * 0.5 * g;
  // 측면 뷰의 3/4 느낌: 먼 쪽 어깨는 뒤로, 가까운 쪽 어깨는 앞으로 민다.
  const shoulder = [
    [chest[0] - shW * 0.55 + twist, chest[1] + 1.2 * s],
    [chest[0] + shW * 0.55 + twist, chest[1] + 0.2 * s],
  ];
  const hipW = M.hipW * s * 0.5 * g;
  const hipJ = [
    [hip[0] - hipW * 0.5, hip[1]],
    [hip[0] + hipW * 0.5, hip[1]],
  ];

  const arms = [0, 1].map((i) => {
    const a = pose.arm[i];
    const elbow = add(shoulder[i], D(a[0]), M.upper * s);
    const hand = add(elbow, D(a[0] + a[1]), M.fore * s);
    return { shoulder: shoulder[i], elbow, hand, angle: a[0] + a[1] };
  });
  const legs = [0, 1].map((i) => {
    const a = pose.leg[i];
    const knee = add(hipJ[i], D(a[0]), M.thigh * s);
    const ankle = add(knee, D(a[0] + a[1]), M.shin * s);
    const toe = add(ankle, D(a[0] + a[1] + (a[2] || 0) + 90), M.foot * s);
    return { hip: hipJ[i], knee, ankle, toe };
  });

  return { hip, chest, neck, headC, arms, legs, lean, s };
}

// ---- 그리기 프리미티브 ----

function capsule(ctx, p0, p1, w0, w1, col, light = 1) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 0.001;
  const nx = -dy / len, ny = dx / len;
  const h0 = w0 / 2, h1 = w1 / 2;

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(p0[0] + nx * h0, p0[1] + ny * h0);
  ctx.lineTo(p1[0] + nx * h1, p1[1] + ny * h1);
  ctx.lineTo(p1[0] - nx * h1, p1[1] - ny * h1);
  ctx.lineTo(p0[0] - nx * h0, p0[1] - ny * h0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(p0[0], p0[1], h0, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.arc(p1[0], p1[1], h1, 0, 6.284); ctx.fill();

  if (light) {
    // 광원은 우상단. 법선 부호로 앞/뒤 면을 갈라 음영을 넣는다.
    const side = nx >= 0 ? 1 : -1;
    ctx.fillStyle = shade(col, 1.4);
    ctx.beginPath();
    ctx.moveTo(p0[0] + nx * h0 * side, p0[1] + ny * h0 * side);
    ctx.lineTo(p1[0] + nx * h1 * side, p1[1] + ny * h1 * side);
    ctx.lineTo(p1[0] + nx * h1 * 0.35 * side, p1[1] + ny * h1 * 0.35 * side);
    ctx.lineTo(p0[0] + nx * h0 * 0.35 * side, p0[1] + ny * h0 * 0.35 * side);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = shade(col, 0.56);
    ctx.beginPath();
    ctx.moveTo(p0[0] - nx * h0 * side, p0[1] - ny * h0 * side);
    ctx.lineTo(p1[0] - nx * h1 * side, p1[1] - ny * h1 * side);
    ctx.lineTo(p1[0] - nx * h1 * 0.45 * side, p1[1] - ny * h1 * 0.45 * side);
    ctx.lineTo(p0[0] - nx * h0 * 0.45 * side, p0[1] - ny * h0 * 0.45 * side);
    ctx.closePath(); ctx.fill();
  }
}

function poly(ctx, pts, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, col, rot = 0) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, 6.284);
  ctx.fill();
}

/** 머리띠 끝 / 스카프 / 포니테일: 관성으로 흔들리는 3분절 꼬리 */
function tail(ctx, root, baseAngle, flow, segs, len, w, col) {
  let p = root, a = baseAngle;
  for (let i = 0; i < segs; i++) {
    a += flow * (i + 1) * 0.55;
    const n = add(p, D(a), len);
    capsule(ctx, p, n, w * (1 - i * 0.22), w * (1 - (i + 1) * 0.22), col, 0);
    p = n;
  }
  ctx.fillStyle = shade(col, 1.25);
}

// ---- 파츠 ----

function drawLeg(ctx, leg, P, M, far) {
  const s = M.scale;
  const dim = far ? 0.7 : 1;
  const pantCol = shade(P.pants, dim);
  const bootCol = shade(P.boots, dim);
  const skinCol = shade(P.skin, dim);
  const w = M.limbW * s * M.girth;
  const bare = P.bareLegs;

  capsule(ctx, leg.hip, leg.knee, w * 1.18, w * 0.9, bare ? skinCol : pantCol);
  // 허벅지 볼륨
  const thighM = lerpP(leg.hip, leg.knee, 0.32);
  ellipse(ctx, thighM[0], thighM[1], w * 0.68, w * 0.82, bare ? skinCol : pantCol);
  ellipse(ctx, thighM[0] + w * 0.22, thighM[1], w * 0.32, w * 0.5, shade(bare ? skinCol : pantCol, 1.22));
  capsule(ctx, leg.knee, leg.ankle, w * 0.86, w * 0.66, bare ? skinCol : (P.shinGuard ? bootCol : pantCol));
  // 종아리
  const calf = lerpP(leg.knee, leg.ankle, 0.34);
  ellipse(ctx, calf[0], calf[1], w * 0.5, w * 0.62, shade(bare ? skinCol : pantCol, 1.08));
  // 부츠
  capsule(ctx, leg.ankle, leg.toe, w * 0.98, w * 0.78, bootCol);
  ellipse(ctx, leg.ankle[0], leg.ankle[1] - 1 * s, w * 0.6, w * 0.55, shade(bootCol, 1.2));
}

function drawArm(ctx, arm, P, M, far) {
  const s = M.scale;
  const dim = far ? 0.7 : 1;
  const skinCol = shade(P.skin, dim);
  const sleeveCol = shade(P.top, dim);
  const gloveCol = shade(P.glove || P.accent, dim);
  const w = M.armW * s * M.girth;

  if (P.sleeve === 'long') {
    capsule(ctx, arm.shoulder, arm.elbow, w * 1.18, w * 0.98, sleeveCol);
    capsule(ctx, arm.elbow, arm.hand, w * 0.92, w * 0.74, sleeveCol);
  } else if (P.sleeve === 'short') {
    const mid = [(arm.shoulder[0] + arm.elbow[0]) / 2, (arm.shoulder[1] + arm.elbow[1]) / 2];
    capsule(ctx, arm.shoulder, arm.elbow, w * 1.1, w * 0.9, skinCol);
    capsule(ctx, arm.shoulder, mid, w * 1.22, w * 1.05, sleeveCol);
    capsule(ctx, arm.elbow, arm.hand, w * 0.86, w * 0.7, skinCol);
  } else {
    capsule(ctx, arm.shoulder, arm.elbow, w * 1.12, w * 0.92, skinCol);
    capsule(ctx, arm.elbow, arm.hand, w * 0.86, w * 0.7, skinCol);
  }
  if (P.wraps) {
    const mid = [lerpP(arm.elbow, arm.hand, 0.35), lerpP(arm.elbow, arm.hand, 1)];
    capsule(ctx, mid[0], mid[1], w * 0.84, w * 0.76, shade(P.wraps, dim));
  }
  // 삼각근 — 어깨에 볼륨을 준다
  const delt = lerpP(arm.shoulder, arm.elbow, 0.22);
  ellipse(ctx, delt[0], delt[1], w * 0.78, w * 0.9, P.sleeve === 'long' ? sleeveCol : skinCol);
  ellipse(ctx, delt[0] + w * 0.2, delt[1] - w * 0.16, w * 0.44, w * 0.5,
    shade(P.sleeve === 'long' ? sleeveCol : skinCol, 1.26));
  // 주먹
  ellipse(ctx, arm.hand[0], arm.hand[1], w * 0.58, w * 0.55, gloveCol);
  ellipse(ctx, arm.hand[0] + 0.5, arm.hand[1] - 0.7, w * 0.34, w * 0.27, shade(gloveCol, 1.3));
}
const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function drawTorso(ctx, sk, P, M, pose) {
  const s = M.scale, g = M.girth;
  const shW = M.shoulderW * s * 0.5 * g;
  const hpW = M.hipW * s * 0.5 * g;
  const u = U(sk.lean);
  const n = [-u[1], u[0]];
  const waist = lerpP(sk.hip, sk.chest, 0.42);
  const wW = (shW + hpW) * 0.44;

  const L = (p, w) => [p[0] - n[0] * w, p[1] - n[1] * w];
  const R = (p, w) => [p[0] + n[0] * w, p[1] + n[1] * w];
  const shoulderLine = add(sk.chest, u, 1.5 * s);

  const body = [
    L(sk.hip, hpW * 1.05), L(waist, wW), L(shoulderLine, shW),
    R(shoulderLine, shW), R(waist, wW), R(sk.hip, hpW * 1.05),
  ];
  const topCol = P.outfit === 'bare' ? P.skin : P.top;
  poly(ctx, body, topCol);
  // 앞뒤 면 음영
  poly(ctx, [L(sk.hip, hpW * 1.05), L(waist, wW), L(shoulderLine, shW),
    L(shoulderLine, shW * 0.45), L(waist, wW * 0.4), L(sk.hip, hpW * 0.4)], shade(topCol, 0.58));
  poly(ctx, [R(sk.hip, hpW * 1.05), R(waist, wW), R(shoulderLine, shW),
    R(shoulderLine, shW * 0.5), R(waist, wW * 0.45), R(sk.hip, hpW * 0.45)], shade(topCol, 1.34));

  if (P.outfit === 'bare') {
    // 흉근/복근 라인 (맨몸일 때만 — 조끼 위에 그리면 얼룩처럼 보인다)
    const c = lerpP(sk.hip, sk.chest, 0.72);
    ellipse(ctx, c[0] + n[0] * wW * 0.52, c[1] + n[1] * wW * 0.52, wW * 0.46, wW * 0.32, shade(P.skin, 1.24), rad(sk.lean));
    ellipse(ctx, c[0] - n[0] * wW * 0.32, c[1] - n[1] * wW * 0.32, wW * 0.36, wW * 0.26, shade(P.skin, 0.8), rad(sk.lean));
    const ab = lerpP(sk.hip, sk.chest, 0.36);
    ellipse(ctx, ab[0] + n[0] * wW * 0.28, ab[1] + n[1] * wW * 0.28, wW * 0.3, wW * 0.5, shade(P.skin, 0.86), rad(sk.lean));
    ctx.strokeStyle = shade(P.skin, 0.66);
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(c[0] + n[0] * wW * 0.06, c[1] + n[1] * wW * 0.06);
    ctx.lineTo(ab[0] + n[0] * wW * 0.06, ab[1] + n[1] * wW * 0.06);
    ctx.stroke();
  }
  if (P.outfit === 'vest') {
    poly(ctx, [L(sk.hip, hpW * 0.95), L(waist, wW * 0.95), L(shoulderLine, shW * 0.95),
      L(shoulderLine, shW * 0.2), L(sk.hip, hpW * 0.2)], P.top);
    poly(ctx, [R(sk.hip, hpW * 0.95), R(waist, wW * 0.95), R(shoulderLine, shW * 0.95),
      R(shoulderLine, shW * 0.3), R(sk.hip, hpW * 0.3)], shade(P.top, 1.12));
  }
  if (P.outfit === 'coat') {
    const skirt = add(sk.hip, [0, 1], M.thigh * s * 0.85);
    const sway = (pose.flow || 0) * 8;
    poly(ctx, [L(sk.hip, hpW * 1.1), R(sk.hip, hpW * 1.1),
      [skirt[0] + hpW * 1.5 - sway, skirt[1]], [skirt[0] - hpW * 1.6 - sway * 1.4, skirt[1] + 2]],
      shade(P.top, 0.86));
  }
  if (P.outfit === 'armor') {
    // 흉갑 — 3톤 + 능선 + 허리 판금
    poly(ctx, [L(waist, wW * 1.06), L(shoulderLine, shW * 1.06), R(shoulderLine, shW * 1.06), R(waist, wW * 1.06)],
      shade(P.accent, 0.9));
    poly(ctx, [R(waist, wW * 1.02), R(shoulderLine, shW * 1.02), R(shoulderLine, shW * 0.25), R(waist, wW * 0.3)],
      shade(P.accent, 1.35));
    poly(ctx, [L(waist, wW * 1.02), L(shoulderLine, shW * 1.02), L(shoulderLine, shW * 0.55), L(waist, wW * 0.6)],
      shade(P.accent, 0.62));
    ctx.strokeStyle = shade(P.accent, 1.55);
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    const a1 = R(shoulderLine, shW * 0.2), a2 = R(waist, wW * 0.24);
    ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]);
    ctx.stroke();
    // 목 보호대
    const gorget = lerpP(sk.chest, sk.neck, 0.6);
    ellipse(ctx, gorget[0] + n[0] * 1.2 * s, gorget[1], shW * 0.66, 2.6 * s, shade(P.accent, 1.2), rad(sk.lean));
    // 허리 판금
    poly(ctx, [L(sk.hip, hpW * 1.16), R(sk.hip, hpW * 1.16),
      [sk.hip[0] + n[0] * hpW * 1.0, sk.hip[1] + 7 * s],
      [sk.hip[0] - n[0] * hpW * 1.1, sk.hip[1] + 6 * s]], shade(P.accent, 0.75));
  }
  // 벨트
  const bl = L(sk.hip, hpW * 1.12), br = R(sk.hip, hpW * 1.12);
  capsule(ctx, [bl[0], bl[1] - 1 * s], [br[0], br[1] - 1 * s], 3.4 * s, 3.4 * s, P.belt || shade(P.pants, 0.6), 0);
  ellipse(ctx, sk.hip[0] + n[0] * hpW * 0.7, sk.hip[1] - 1 * s, 1.9 * s, 1.6 * s, P.accent);

  if (P.shoulderPad) {
    for (const i of [0, 1]) {
      const sp = sk.arms[i].shoulder;
      const dim = i === 0 ? 0.72 : 1;
      ellipse(ctx, sp[0], sp[1] - 1 * s, M.armW * s * 0.95, M.armW * s * 0.8, shade(P.accent, dim));
      ellipse(ctx, sp[0] + 0.8, sp[1] - 2.2 * s, M.armW * s * 0.6, M.armW * s * 0.4, shade(P.accent, dim * 1.3));
    }
  }
}

function drawHead(ctx, sk, P, M, pose) {
  const s = M.scale;
  const r = M.headR * s;
  const [hx, hy] = sk.headC;
  const tilt = sk.lean + (pose.head || 0);
  const flow = pose.flow || 0;

  capsule(ctx, sk.neck, [hx, hy + r * 0.5], M.armW * s * 0.95, M.armW * s * 0.9, shade(P.skin, 0.86));

  // 뒷머리 / 긴 머리는 두개골보다 먼저
  if (P.hair === 'long' || P.hair === 'pony') {
    ellipse(ctx, hx - r * 0.5, hy + r * 0.1, r * 0.95, r * 1.05, shade(P.hairCol, 0.8), rad(tilt));
  }
  ellipse(ctx, hx, hy, r * 0.93, r * 1.04, P.skin, rad(tilt));
  // 턱선
  poly(ctx, [[hx - r * 0.5, hy + r * 0.35], [hx + r * 0.72, hy + r * 0.2], [hx + r * 0.42, hy + r * 1.0], [hx - r * 0.2, hy + r * 0.95]], P.skin);
  ellipse(ctx, hx + r * 0.32, hy - r * 0.1, r * 0.55, r * 0.72, shade(P.skin, 1.14), rad(tilt));
  ellipse(ctx, hx - r * 0.55, hy + r * 0.05, r * 0.42, r * 0.6, shade(P.skin, 0.78), rad(tilt));
  // 귀
  ellipse(ctx, hx - r * 0.18, hy + r * 0.12, r * 0.2, r * 0.28, shade(P.skin, 0.88));

  // 헤어 — 얼굴보다 먼저 (이마 위쪽만 덮는다)
  const H = P.hairCol;
  switch (P.hair) {
    case 'mohawk':
      ellipse(ctx, hx - r * 0.12, hy - r * 0.62, r * 0.9, r * 0.55, shade(H, 0.8));
      poly(ctx, [[hx - r * 0.8, hy - r * 0.72], [hx - r * 0.5, hy - r * 1.95],
        [hx - r * 0.1, hy - r * 2.15], [hx + r * 0.3, hy - r * 1.8], [hx + r * 0.48, hy - r * 0.95]], H);
      poly(ctx, [[hx - r * 0.5, hy - r * 1.95], [hx - r * 0.1, hy - r * 2.15], [hx + r * 0.08, hy - r * 1.55]], shade(H, 1.35));
      break;
    case 'spike':
      ellipse(ctx, hx - r * 0.06, hy - r * 0.6, r * 0.98, r * 0.6, H);
      for (let i = 0; i < 5; i++) {
        const a = -1.95 + i * 0.44;
        const bx = hx + Math.sin(a) * r * 0.78, by = hy - r * 0.7 - Math.cos(a) * r * 0.3;
        poly(ctx, [[bx - r * 0.24, by + r * 0.2], [bx + r * 0.22, by + r * 0.2],
          [bx + Math.sin(a) * r * 0.85, by - r * (0.9 - i * 0.09)]], i % 2 ? shade(H, 1.2) : H);
      }
      break;
    case 'pony':
      ellipse(ctx, hx - r * 0.08, hy - r * 0.56, r * 1.0, r * 0.62, H);
      tail(ctx, [hx - r * 0.88, hy - r * 0.42], 140 + flow * 26, -flow * 0.8 - 0.16, 3, r * 0.85, r * 0.5, H);
      break;
    case 'long':
      ellipse(ctx, hx - r * 0.12, hy - r * 0.52, r * 1.04, r * 0.68, H);
      poly(ctx, [[hx - r * 1.0, hy - r * 0.7], [hx - r * 0.2, hy - r * 0.6],
        [hx - r * 0.35, hy + r * 1.6 + flow * 6], [hx - r * 1.25, hy + r * 1.3 + flow * 8]], shade(H, 0.88));
      break;
    case 'bald':
      ellipse(ctx, hx - r * 0.24, hy - r * 0.58, r * 0.74, r * 0.34, shade(P.skin, 1.12));
      break;
    case 'cap':
      ellipse(ctx, hx - r * 0.06, hy - r * 0.58, r * 1.0, r * 0.6, P.accent);
      poly(ctx, [[hx + r * 0.1, hy - r * 0.66], [hx + r * 1.45, hy - r * 0.56],
        [hx + r * 1.4, hy - r * 0.34], [hx + r * 0.1, hy - r * 0.36]], shade(P.accent, 0.82));
      break;
    case 'helm':
      ellipse(ctx, hx - r * 0.02, hy - r * 0.4, r * 1.08, r * 0.86, P.accent);
      poly(ctx, [[hx - r * 1.1, hy - r * 0.44], [hx + r * 1.05, hy - r * 0.5],
        [hx + r * 1.0, hy - r * 0.16], [hx - r * 1.05, hy - r * 0.1]], shade(P.accent, 1.25));
      poly(ctx, [[hx - r * 0.1, hy - r * 1.22], [hx + r * 0.15, hy - r * 1.18],
        [hx + r * 0.05, hy - r * 2.0], [hx - r * 0.3, hy - r * 1.9]], P.hairCol);
      break;
    case 'topknot':
      ellipse(ctx, hx - r * 0.06, hy - r * 0.58, r * 0.98, r * 0.62, H);
      ellipse(ctx, hx - r * 0.18, hy - r * 1.22, r * 0.34, r * 0.4, H);
      break;
    default:
      ellipse(ctx, hx - r * 0.06, hy - r * 0.56, r * 0.98, r * 0.64, H);
  }
  if (P.headband) {
    const by = hy - r * 0.46;
    poly(ctx, [[hx - r * 1.02, by - r * 0.2], [hx + r * 0.95, by - r * 0.28],
      [hx + r * 0.92, by + r * 0.16], [hx - r * 1.0, by + r * 0.22]], P.headband);
    tail(ctx, [hx - r * 0.95, by], 128 + flow * 30, -flow * 1.1 - 0.22, 3, r * 0.8, r * 0.42, P.headband);
    tail(ctx, [hx - r * 0.9, by + r * 0.2], 148 + flow * 22, -flow * 0.9 - 0.14, 3, r * 0.68, r * 0.34, shade(P.headband, 0.82));
  }

  // 얼굴
  const eyeX = hx + r * 0.44, eyeY = hy - r * 0.02;
  if (!P.mask || P.mask === 'lower') {
    if (P.shades) {
      poly(ctx, [[hx - r * 0.1, eyeY - r * 0.3], [hx + r * 0.84, eyeY - r * 0.32],
        [hx + r * 0.8, eyeY + r * 0.24], [hx - r * 0.05, eyeY + r * 0.12]], '#15121c');
      poly(ctx, [[hx + r * 0.2, eyeY - r * 0.26], [hx + r * 0.55, eyeY - r * 0.28],
        [hx + r * 0.45, eyeY - r * 0.03]], 'rgba(255,255,255,0.35)');
    } else {
      ellipse(ctx, eyeX, eyeY, r * 0.26, r * 0.28, '#efe6dd');
      ellipse(ctx, eyeX + r * 0.08, eyeY + r * 0.02, r * 0.15, r * 0.23, P.eye || '#20161f');
      ellipse(ctx, eyeX + r * 0.04, eyeY - r * 0.08, r * 0.05, r * 0.06, '#ffffff');
      const br = pose.brow ?? -0.22;
      ctx.strokeStyle = shade(P.hairCol, 0.7);
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(eyeX - r * 0.32, eyeY - r * (0.42 - br));
      ctx.lineTo(eyeX + r * 0.36, eyeY - r * (0.5 + br));
      ctx.stroke();
      // 콧날
      ctx.strokeStyle = shade(P.skin, 0.72);
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.78, eyeY + r * 0.06);
      ctx.lineTo(hx + r * 0.66, eyeY + r * 0.34);
      ctx.stroke();
    }
    ctx.strokeStyle = shade(P.skin, 0.5);
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(hx + r * 0.42, hy + r * 0.6);
    ctx.lineTo(hx + r * 0.7, hy + r * (0.6 + (pose.mouth || 0)));
    ctx.stroke();
  }
  if (P.mask === 'lower') {
    poly(ctx, [[hx - r * 0.35, hy + r * 0.3], [hx + r * 0.8, hy + r * 0.24],
      [hx + r * 0.48, hy + r * 1.02], [hx - r * 0.25, hy + r * 0.95]], P.accent);
  } else if (P.mask === 'full') {
    ellipse(ctx, hx, hy, r * 0.96, r * 1.06, P.accent, rad(tilt));
    poly(ctx, [[hx + r * 0.05, hy - r * 0.2], [hx + r * 0.85, hy - r * 0.25],
      [hx + r * 0.8, hy + r * 0.05], [hx + r * 0.1, hy + r * 0.02]], '#0d0b12');
    ellipse(ctx, hx + r * 0.5, hy - r * 0.1, r * 0.16, r * 0.1, P.eye || '#ff4a3d');
  }
  if (P.beard) {
    // 입 아래만 덮어 눈이 가려지지 않게 한다
    poly(ctx, [[hx - r * 0.24, hy + r * 0.72], [hx + r * 0.66, hy + r * 0.66],
      [hx + r * 0.38, hy + r * 1.32], [hx - r * 0.12, hy + r * 1.1]], shade(P.hairCol, 0.85));
    poly(ctx, [[hx + r * 0.1, hy + r * 0.74], [hx + r * 0.6, hy + r * 0.7],
      [hx + r * 0.4, hy + r * 1.05]], shade(P.hairCol, 1.15));
  }
  if (P.scarf) {
    const sy = sk.neck[1] + 1 * s;
    ellipse(ctx, sk.neck[0], sy, M.armW * s * 1.05, M.armW * s * 0.62, P.scarf);
    tail(ctx, [sk.neck[0] - 1 * s, sy], 118 + flow * 34, -flow * 1.3 - 0.3, 4, r * 0.95, r * 0.6, P.scarf);
  }
}

/** 캐릭터 1장 그리기. ctx는 발밑이 (0,0)이 되도록 미리 translate 되어 있어야 한다. */
export function drawFighter(ctx, style, pose, M) {
  const sk = buildSkeleton(pose, M);
  const P = style;
  if (pose.rot) {
    ctx.translate(sk.hip[0], sk.hip[1]);
    ctx.rotate(rad(pose.rot));
    ctx.translate(-sk.hip[0], -sk.hip[1]);
  }
  const front = pose.frontArm ?? 1;
  const back = 1 - front;

  drawLeg(ctx, sk.legs[0], P, M, true);
  drawArm(ctx, sk.arms[back], P, M, back === 0);
  drawTorso(ctx, sk, P, M, pose);
  drawLeg(ctx, sk.legs[1], P, M, false);
  drawHead(ctx, sk, P, M, pose);
  drawArm(ctx, sk.arms[front], P, M, false);

  return sk;
}
