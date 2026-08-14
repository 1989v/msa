// 애니메이션 클립. 순환 동작(대기/이동)은 절차적으로, 타격 동작은 프레임 단위로 직접 찍었다.
// 각도 규약: 0 = 아래, +90 = 앞(오른쪽), 180 = 위.

const TAU = Math.PI * 2;

/** 기본 파이팅 스탠스 */
export const S = (o = {}) => ({
  hipX: 0, hipY: 0, lean: 0, twist: 0, head: 0, flow: 0, rot: 0,
  frontArm: 1, brow: -0.22, mouth: 0,
  arm: [[22, 122], [38, 112]],
  leg: [[-15, 15, -6], [15, -15, 6]],
  ...o,
});

const seq = (frames) => ({ n: frames.length, pose: (i) => frames[Math.min(i, frames.length - 1)] });
const cyc = (n, fn) => ({ n, pose: (i) => fn(i / n, i), loop: true });

// ---- 순환 동작 ----

const idle = cyc(10, (u) => {
  const b = Math.sin(u * TAU);
  const b2 = Math.sin(u * TAU + 1.1);
  return S({
    hipY: -0.6 + b * 0.9,
    lean: 2 + b2 * 1.6,
    head: -1 + b * 1.4,
    twist: b2 * 0.7,
    flow: b * 0.06,
    arm: [[20 + b * 4, 120 - b2 * 6], [36 + b2 * 5, 110 - b * 7]],
    leg: [[-15, 15, -6], [15, -15, 6]],
  });
});

const walk = cyc(12, (u) => {
  const a = u * TAU;
  const sw = Math.sin(a), co = Math.cos(a);
  return S({
    hipY: -1.4 + Math.abs(Math.cos(a)) * 2.2,
    lean: 6 + sw * 1.5,
    twist: sw * 1.6,
    head: -2,
    flow: -sw * 0.1,
    arm: [[18 - sw * 26, 112 - Math.max(0, sw) * 18], [34 + sw * 26, 104 + Math.max(0, -sw) * 16]],
    leg: [[-sw * 30, Math.max(0, sw) * -44, -6 + sw * 8], [sw * 30, Math.max(0, -sw) * -44, 6 - sw * 8]],
  });
});

const walkBack = cyc(12, (u) => {
  const a = -u * TAU;
  const sw = Math.sin(a);
  return S({
    hipY: -1.2 + Math.abs(Math.cos(a)) * 1.8,
    lean: -2,
    twist: sw * 1.2,
    flow: -sw * 0.06,
    arm: [[22 - sw * 16, 120], [40 + sw * 16, 116]],
    leg: [[-sw * 24, Math.max(0, sw) * -36, -6], [sw * 24, Math.max(0, -sw) * -36, 6]],
  });
});

const run = cyc(8, (u) => {
  const a = u * TAU;
  const sw = Math.sin(a);
  return S({
    hipY: -2.4 + Math.abs(Math.cos(a)) * 2.6,
    lean: 17,
    twist: sw * 2.4,
    head: -8,
    flow: -0.24 - sw * 0.1,
    arm: [[10 - sw * 48, 96], [26 + sw * 48, 92]],
    leg: [[-sw * 44, Math.max(0, sw) * -66, -10], [sw * 44, Math.max(0, -sw) * -66, 10]],
  });
});

// ---- 기본기 ----

const jab1 = seq([
  S({ lean: 4, twist: -1.4, arm: [[20, 124], [30, 128]], hipY: -0.5 }),
  S({ lean: 8, twist: 2.6, hipX: 1.2, arm: [[16, 128], [70, 42]], leg: [[-17, 17, -6], [18, -16, 6]], brow: -0.4 }),
  S({ lean: 11, twist: 4.2, hipX: 2.4, arm: [[14, 130], [88, 3]], leg: [[-19, 19, -6], [21, -18, 6]], brow: -0.45, mouth: 0.2, flow: -0.12 }),
  S({ lean: 10, twist: 3.6, hipX: 2, arm: [[15, 128], [86, 6]], leg: [[-19, 19, -6], [20, -17, 6]], brow: -0.4, flow: -0.08 }),
  S({ lean: 7, twist: 1.6, hipX: 0.8, arm: [[18, 126], [58, 62]], brow: -0.3 }),
  S({ lean: 4, twist: 0, arm: [[20, 124], [40, 108]] }),
]);

const jab2 = seq([
  S({ lean: 3, twist: -2.4, frontArm: 0, arm: [[26, 132], [34, 116]] }),
  S({ lean: 8, twist: 1.8, frontArm: 0, hipX: 1, arm: [[62, 54], [30, 122]], leg: [[-16, 16, -6], [19, -17, 6]], brow: -0.42 }),
  S({ lean: 13, twist: 4.6, frontArm: 0, hipX: 2.6, arm: [[90, 2], [26, 126]], leg: [[-20, 20, -6], [23, -20, 6]], brow: -0.48, mouth: 0.25, flow: -0.16 }),
  S({ lean: 12, twist: 4, frontArm: 0, hipX: 2.2, arm: [[88, 5], [28, 124]], leg: [[-20, 20, -6], [22, -19, 6]], flow: -0.1 }),
  S({ lean: 8, twist: 1.4, frontArm: 0, hipX: 1, arm: [[58, 66], [32, 118]] }),
  S({ lean: 4, twist: 0, arm: [[22, 122], [38, 112]] }),
]);

// 3타 마무리 — 회전 뒤돌려차기
const jab3 = seq([
  S({ lean: -6, twist: -3, hipY: -2, arm: [[-14, 108], [8, 120]], leg: [[-18, 20, -6], [14, -16, 6]] }),
  S({ lean: 4, twist: 0, hipY: 1, arm: [[-30, 90], [-20, 100]], leg: [[-24, 26, -8], [30, -30, 8]], flow: 0.2 }),
  S({ lean: 20, twist: 4, hipY: 3, arm: [[-46, 70], [-40, 86]], leg: [[-30, 34, -8], [72, -14, 14]], flow: -0.28, mouth: 0.3, brow: -0.5 }),
  S({ lean: 26, twist: 5, hipY: 4, arm: [[-52, 62], [-46, 80]], leg: [[-34, 38, -8], [96, -4, 18]], flow: -0.34, mouth: 0.35, brow: -0.5 }),
  S({ lean: 24, twist: 4, hipY: 3.4, arm: [[-48, 66], [-42, 82]], leg: [[-32, 36, -8], [92, -6, 16]], flow: -0.26 }),
  S({ lean: 14, twist: 2, hipY: 1.4, arm: [[-20, 96], [-10, 104]], leg: [[-26, 28, -8], [52, -24, 10]], flow: -0.1 }),
  S({ lean: 5, twist: 0, arm: [[22, 122], [38, 112]] }),
]);

// 강공격 — 큰 훅
const heavy = seq([
  S({ lean: -9, twist: -4.5, hipY: -1.6, hipX: -1.6, arm: [[-34, 126], [-24, 140]], leg: [[-20, 22, -6], [12, -14, 6]], brow: -0.1 }),
  S({ lean: -12, twist: -5.5, hipY: -2, hipX: -2.4, arm: [[-46, 132], [-38, 146]], leg: [[-22, 24, -6], [10, -12, 6]], brow: 0 }),
  S({ lean: 6, twist: 1, hipY: -0.4, hipX: 0.6, arm: [[-10, 120], [26, 92]], leg: [[-18, 18, -6], [18, -16, 6]], brow: -0.4 }),
  S({ lean: 18, twist: 5.5, hipY: 0.6, hipX: 3.4, arm: [[8, 118], [96, 14]], leg: [[-22, 22, -6], [26, -22, 8]], brow: -0.55, mouth: 0.4, flow: -0.3 }),
  S({ lean: 20, twist: 6, hipY: 0.8, hipX: 4, arm: [[10, 116], [104, 6]], leg: [[-24, 24, -6], [28, -24, 8]], brow: -0.55, mouth: 0.4, flow: -0.24 }),
  S({ lean: 17, twist: 4.6, hipY: 0.4, hipX: 3, arm: [[12, 118], [96, 22]], leg: [[-22, 22, -6], [25, -22, 8]], flow: -0.14 }),
  S({ lean: 10, twist: 2, hipX: 1.2, arm: [[18, 122], [62, 70]] }),
  S({ lean: 4, twist: 0, arm: [[22, 122], [38, 112]] }),
]);

// 띄우기 어퍼컷
const launcher = seq([
  S({ lean: 14, hipY: -5, twist: -2, arm: [[30, 130], [46, 128]], leg: [[-18, 26, -6], [16, -24, 6]], brow: 0 }),
  S({ lean: 8, hipY: -6, twist: -1, arm: [[34, 134], [52, 132]], leg: [[-20, 30, -6], [18, -28, 6]] }),
  S({ lean: -8, hipY: 2, twist: 4, arm: [[24, 126], [150, 62]], leg: [[-14, 12, -6], [14, -12, 6]], brow: -0.5, mouth: 0.4, flow: 0.3 }),
  S({ lean: -14, hipY: 3.4, twist: 5, arm: [[20, 124], [172, 26]], leg: [[-12, 10, -6], [12, -10, 6]], brow: -0.55, mouth: 0.45, flow: 0.36 }),
  S({ lean: -12, hipY: 2.6, twist: 4.4, arm: [[20, 124], [168, 32]], leg: [[-13, 11, -6], [13, -11, 6]], flow: 0.24 }),
  S({ lean: -4, hipY: 0.6, twist: 2, arm: [[21, 123], [120, 80]], flow: 0.1 }),
  S({ lean: 4, twist: 0, arm: [[22, 122], [38, 112]] }),
]);

// ---- 점프 ----

const jumpRise = seq([S({
  hipY: 1.5, lean: -4, arm: [[-40, 96], [-52, 88]],
  leg: [[-26, 46, -14], [16, -52, 12]], flow: 0.34, head: -4,
})]);
const jumpFall = seq([S({
  hipY: 0.5, lean: 8, arm: [[-18, 108], [-28, 100]],
  leg: [[18, -18, -4], [-14, 30, 8]], flow: -0.28, head: 3,
})]);
const jumpAtk = seq([
  S({ hipY: 1, lean: 10, arm: [[-24, 100], [40, 96]], leg: [[-16, 44, -10], [40, -12, 16]], flow: -0.2 }),
  S({ hipY: 0.6, lean: 16, arm: [[-30, 92], [64, 58]], leg: [[-12, 52, -12], [78, -6, 20]], flow: -0.3, brow: -0.5, mouth: 0.4 }),
  S({ hipY: 0.4, lean: 18, arm: [[-34, 88], [72, 44]], leg: [[-10, 56, -12], [92, -2, 22]], flow: -0.34, brow: -0.5, mouth: 0.4 }),
  S({ hipY: 0.6, lean: 14, arm: [[-28, 94], [60, 62]], leg: [[-12, 50, -12], [84, -6, 20]], flow: -0.26 }),
]);

// ---- 피격 / 다운 ----

const hurt = seq([
  S({ lean: -12, hipX: -1.6, head: -8, arm: [[-12, 92], [-4, 96]], leg: [[-18, 18, -6], [10, -12, 6]], brow: 0.3, mouth: -0.5 }),
  S({ lean: -18, hipX: -3, head: -14, arm: [[-22, 84], [-14, 88]], leg: [[-22, 22, -6], [6, -8, 6]], brow: 0.35, mouth: -0.6 }),
  S({ lean: -12, hipX: -1.6, head: -9, arm: [[-14, 92], [-6, 94]], leg: [[-18, 18, -6], [10, -12, 6]], brow: 0.3, mouth: -0.4 }),
  S({ lean: -5, hipX: -0.6, head: -3, arm: [[6, 106], [14, 106]], brow: 0.1 }),
]);

const hurtHeavy = seq([
  S({ lean: -20, hipX: -3, head: -16, hipY: -1, arm: [[-34, 74], [-26, 80]], leg: [[-26, 26, -6], [4, -6, 6]], brow: 0.4, mouth: -0.7 }),
  S({ lean: -28, hipX: -5, head: -22, hipY: -2, arm: [[-48, 62], [-40, 68]], leg: [[-32, 32, -6], [0, -2, 6]], brow: 0.45, mouth: -0.8 }),
  S({ lean: -22, hipX: -3.4, head: -18, hipY: -1.4, arm: [[-38, 70], [-30, 76]], leg: [[-28, 28, -6], [2, -4, 6]], brow: 0.4, mouth: -0.7 }),
  S({ lean: -14, hipX: -1.6, head: -10, arm: [[-16, 88], [-8, 92]], brow: 0.2, mouth: -0.4 }),
]);

// 공중 회전 후 낙하 — rot로 몸 전체를 굴린다
const down = seq([
  S({ rot: -18, lean: -14, hipY: 1, arm: [[-56, 60], [-48, 66]], leg: [[-30, 40, -8], [10, -22, 8]], brow: 0.4, mouth: -0.8 }),
  S({ rot: -44, lean: -16, hipY: 2, arm: [[-70, 48], [-62, 54]], leg: [[-38, 50, -8], [4, -30, 8]], brow: 0.4, mouth: -0.8 }),
  S({ rot: -68, lean: -18, hipY: 2, arm: [[-84, 40], [-76, 46]], leg: [[-44, 56, -8], [0, -36, 8]], brow: 0.45, mouth: -0.9 }),
  S({ rot: -86, lean: -18, hipY: -12, arm: [[-84, 34], [-70, 28]], leg: [[-18, 30, -12], [-4, 18, -8]], brow: 0.45, mouth: -0.9 }),
  S({ rot: -90, lean: -14, hipY: -21, arm: [[-80, 30], [-64, 24]], leg: [[-10, 20, -12], [2, 12, -8]], brow: 0.4, mouth: -0.8 }),
]);
const downed = seq([S({
  rot: -90, lean: -12, hipY: -21, arm: [[-82, 28], [-66, 22]],
  leg: [[-8, 18, -12], [4, 10, -8]], brow: 0.35, mouth: -0.7,
})]);

const getup = seq([
  S({ rot: -78, lean: -14, hipY: -19, arm: [[-74, 32], [-58, 30]], leg: [[-12, 26, -12], [0, 16, -8]], brow: 0.3 }),
  S({ rot: -56, lean: -10, hipY: -14, arm: [[-60, 44], [-46, 48]], leg: [[-30, 50, -8], [0, -12, 4]], brow: 0.2 }),
  S({ rot: -30, lean: 6, hipY: -9, arm: [[-40, 74], [-30, 84]], leg: [[-28, 52, -8], [8, -26, 8]], brow: 0.1 }),
  S({ rot: -10, lean: 14, hipY: -5, arm: [[-14, 98], [-4, 104]], leg: [[-20, 40, -8], [14, -20, 8]] }),
  S({ lean: 8, hipY: -2, arm: [[10, 112], [20, 114]], leg: [[-16, 22, -6], [16, -16, 6]], brow: -0.3 }),
  S({ lean: 4, arm: [[22, 122], [38, 112]] }),
]);

const block = seq([
  S({ lean: -4, hipY: -1.5, twist: -1, arm: [[46, 116], [58, 112]], leg: [[-17, 17, -6], [13, -13, 6]], brow: 0.1 }),
  S({ lean: -6, hipY: -2.2, twist: -1.4, arm: [[50, 118], [62, 114]], leg: [[-18, 18, -6], [12, -12, 6]], brow: 0.15 }),
]);

// ---- 잡기 ----

const grabHold = seq([
  S({ lean: 10, twist: 3, arm: [[72, 30], [78, 26]], leg: [[-16, 16, -6], [18, -16, 6]], brow: -0.45 }),
  S({ lean: 11, twist: 3.4, arm: [[74, 28], [80, 24]], leg: [[-16, 16, -6], [19, -17, 6]], brow: -0.45 }),
]);
const knee = seq([
  S({ lean: 14, twist: 3, arm: [[76, 26], [82, 22]], leg: [[-18, 18, -6], [30, -50, 10]], brow: -0.5 }),
  S({ lean: 18, twist: 3.6, hipY: 1.5, arm: [[80, 22], [86, 18]], leg: [[-20, 20, -6], [78, -92, 14]], brow: -0.55, mouth: 0.4 }),
  S({ lean: 16, twist: 3.2, hipY: 0.6, arm: [[78, 24], [84, 20]], leg: [[-19, 19, -6], [62, -78, 12]], mouth: 0.3 }),
  S({ lean: 12, twist: 3, arm: [[74, 28], [80, 24]], leg: [[-16, 16, -6], [24, -40, 8]] }),
]);
const throwSwing = seq([
  S({ lean: -14, twist: -4, arm: [[-30, 60], [-24, 56]], leg: [[-22, 22, -6], [10, -12, 6]], brow: -0.3 }),
  S({ lean: 4, twist: 2, arm: [[70, 30], [76, 26]], leg: [[-18, 18, -6], [18, -16, 6]], brow: -0.5, mouth: 0.4 }),
  S({ lean: 22, twist: 6, hipX: 2, arm: [[140, 14], [148, 10]], leg: [[-24, 24, -6], [26, -22, 8]], brow: -0.55, mouth: 0.5, flow: -0.3 }),
  S({ lean: 24, twist: 6.4, hipX: 2.6, arm: [[152, 10], [160, 6]], leg: [[-26, 26, -6], [28, -24, 8]], flow: -0.24 }),
  S({ lean: 14, twist: 3, hipX: 1, arm: [[100, 40], [108, 36]], flow: -0.1 }),
  S({ lean: 5, arm: [[22, 122], [38, 112]] }),
]);
const grabbed = seq([
  S({ lean: -14, head: -10, arm: [[-40, 60], [-52, 52]], leg: [[-14, 14, -6], [10, -10, 6]], brow: 0.4, mouth: -0.6 }),
  S({ lean: -10, head: -14, arm: [[-52, 52], [-40, 60]], leg: [[-10, 10, -6], [14, -14, 6]], brow: 0.4, mouth: -0.6 }),
]);

// ---- 필살기 ----

// 파열탄 — 기를 모아 앞으로 밀어낸다
const spShot = seq([
  S({ lean: -8, hipY: -3, twist: -3, arm: [[-46, 118], [-40, 124]], leg: [[-20, 24, -6], [12, -16, 6]], brow: -0.1 }),
  S({ lean: -12, hipY: -4.5, twist: -4, arm: [[-58, 124], [-52, 130]], leg: [[-24, 30, -6], [8, -14, 6]], brow: 0 }),
  S({ lean: -10, hipY: -4, twist: -3, arm: [[-54, 122], [-48, 128]], leg: [[-22, 28, -6], [10, -14, 6]], brow: -0.2 }),
  S({ lean: 10, hipY: -1, twist: 3, arm: [[40, 60], [46, 56]], leg: [[-18, 18, -6], [18, -16, 6]], brow: -0.5, mouth: 0.3 }),
  S({ lean: 20, hipY: 0, twist: 6, hipX: 2, arm: [[86, 8], [92, 4]], leg: [[-22, 22, -6], [26, -22, 8]], brow: -0.55, mouth: 0.5, flow: -0.34 }),
  S({ lean: 21, hipY: 0, twist: 6.2, hipX: 2.4, arm: [[88, 6], [94, 2]], leg: [[-23, 23, -6], [27, -23, 8]], flow: -0.28 }),
  S({ lean: 16, twist: 4, hipX: 1.2, arm: [[70, 40], [76, 36]], flow: -0.14 }),
  S({ lean: 5, arm: [[22, 122], [38, 112]] }),
]);

// 승천각 — 웅크렸다가 무적 대공
const spRise = seq([
  S({ lean: 16, hipY: -8, twist: -2, arm: [[26, 130], [40, 126]], leg: [[-16, 34, -6], [14, -32, 6]], brow: 0 }),
  S({ lean: 18, hipY: -10, twist: -3, arm: [[30, 134], [44, 130]], leg: [[-18, 40, -6], [12, -38, 6]], brow: 0.1 }),
  S({ lean: -10, hipY: 4, twist: 4, arm: [[18, 120], [156, 44]], leg: [[-8, 20, -6], [24, -30, 10]], brow: -0.5, mouth: 0.5, flow: 0.4 }),
  S({ lean: -18, hipY: 6, twist: 5, arm: [[14, 116], [176, 12]], leg: [[-4, 26, -8], [30, -40, 14]], brow: -0.55, mouth: 0.5, flow: 0.46 }),
  S({ lean: -20, hipY: 6, twist: 5.2, arm: [[12, 114], [182, 4]], leg: [[0, 30, -8], [34, -46, 16]], flow: 0.44 }),
  S({ lean: -16, hipY: 5, twist: 4.4, arm: [[14, 116], [176, 10]], leg: [[-4, 26, -8], [30, -40, 14]], flow: 0.36 }),
  S({ lean: -6, hipY: 2, twist: 2, arm: [[18, 120], [140, 56]], leg: [[-10, 18, -6], [20, -24, 8]], flow: 0.2 }),
  S({ lean: 6, hipY: -2, arm: [[22, 122], [38, 112]] }),
]);

// 선풍참 — 전진 회전 다단
const spSpin = seq([
  S({ lean: -10, hipY: -2, twist: -4, arm: [[-40, 100], [-30, 108]], leg: [[-20, 22, -6], [12, -14, 6]] }),
  S({ rot: 20, lean: 6, hipY: 1, twist: 2, arm: [[-70, 60], [-80, 54]], leg: [[-30, 30, -8], [40, -30, 10]], flow: 0.3, brow: -0.5 }),
  S({ rot: 60, lean: 10, hipY: 2, twist: 4, arm: [[-100, 40], [-110, 34]], leg: [[-40, 36, -8], [60, -26, 12]], flow: 0.4, mouth: 0.4 }),
  S({ rot: 110, lean: 12, hipY: 2.4, twist: 5, arm: [[-120, 26], [-130, 20]], leg: [[-46, 40, -8], [72, -22, 14]], flow: 0.44, mouth: 0.4 }),
  S({ rot: 160, lean: 12, hipY: 2.4, twist: 5, arm: [[-140, 18], [-150, 12]], leg: [[-50, 42, -8], [78, -20, 14]], flow: 0.4, mouth: 0.4 }),
  S({ rot: 210, lean: 10, hipY: 2, twist: 4, arm: [[-160, 14], [-170, 8]], leg: [[-46, 40, -8], [72, -22, 12]], flow: 0.34 }),
  S({ rot: 260, lean: 6, hipY: 1, twist: 2, arm: [[-180, 20], [-190, 14]], leg: [[-38, 34, -8], [58, -28, 10]], flow: 0.24 }),
  S({ rot: 320, lean: 2, hipY: 0, arm: [[-40, 90], [-30, 96]], leg: [[-24, 26, -6], [24, -24, 8]], flow: 0.1 }),
  S({ lean: 5, arm: [[22, 122], [38, 112]] }),
]);

// 폭쇄장 — 반원 커맨드, 벽꽝 장타
const spPalm = seq([
  S({ lean: -14, hipY: -3, twist: -5, arm: [[-50, 130], [-56, 134]], leg: [[-24, 26, -6], [10, -14, 6]] }),
  S({ lean: -16, hipY: -4, twist: -6, arm: [[-58, 136], [-64, 140]], leg: [[-26, 30, -6], [8, -12, 6]], brow: 0.1 }),
  S({ lean: 2, hipY: -2, twist: 0, arm: [[10, 100], [4, 104]], leg: [[-20, 20, -6], [16, -16, 6]], brow: -0.4 }),
  S({ lean: 24, hipY: 0, twist: 7, hipX: 3.5, arm: [[96, 4], [100, 0]], leg: [[-26, 26, -6], [32, -26, 10]], brow: -0.6, mouth: 0.55, flow: -0.4 }),
  S({ lean: 26, hipY: 0, twist: 7.4, hipX: 4.2, arm: [[100, 0], [104, -4]], leg: [[-28, 28, -6], [34, -28, 10]], flow: -0.34 }),
  S({ lean: 22, twist: 5, hipX: 2.6, arm: [[86, 20], [90, 16]], flow: -0.2 }),
  S({ lean: 12, twist: 2, hipX: 1, arm: [[50, 70], [54, 66]], flow: -0.08 }),
  S({ lean: 5, arm: [[22, 122], [38, 112]] }),
]);

// 초필살기 — 발광 → 돌진 → 난무 → 마무리
const superMove = seq([
  S({ lean: -14, hipY: -5, twist: -5, arm: [[-40, 130], [-46, 134]], leg: [[-22, 30, -6], [10, -18, 6]], brow: -0.2 }),
  S({ lean: -18, hipY: -7, twist: -6, arm: [[-52, 138], [-58, 142]], leg: [[-26, 38, -6], [6, -16, 6]], brow: 0, mouth: 0.6 }),
  S({ lean: -20, hipY: -8, twist: -6.5, arm: [[-56, 142], [-62, 146]], leg: [[-28, 42, -6], [4, -14, 6]], brow: 0, mouth: 0.7, flow: 0.5 }),
  S({ lean: 22, hipY: -1, twist: 5, hipX: 3, arm: [[-20, 90], [88, 8]], leg: [[-26, 26, -6], [30, -26, 10]], brow: -0.55, mouth: 0.5, flow: -0.4 }),
  S({ lean: 20, hipY: -1, twist: -4, hipX: 3, frontArm: 0, arm: [[94, 2], [-14, 96]], leg: [[-24, 24, -6], [28, -24, 10]], brow: -0.55, mouth: 0.5, flow: -0.34 }),
  S({ lean: 24, hipY: 0, twist: 5.5, hipX: 3.6, arm: [[-24, 86], [98, 0]], leg: [[-28, 28, -6], [34, -28, 10]], brow: -0.6, mouth: 0.55, flow: -0.42 }),
  S({ lean: 18, hipY: 1.5, twist: 4, hipX: 3, arm: [[-30, 80], [40, 70]], leg: [[-30, 30, -8], [88, -10, 18]], brow: -0.6, mouth: 0.55, flow: -0.36 }),
  S({ lean: 22, hipY: 2.5, twist: 5, hipX: 3.6, arm: [[-36, 74], [30, 76]], leg: [[-34, 34, -8], [110, -4, 22]], brow: -0.6, mouth: 0.6, flow: -0.44 }),
  S({ lean: -6, hipY: 5, twist: 3, arm: [[16, 118], [168, 20]], leg: [[-6, 24, -8], [28, -36, 14]], brow: -0.6, mouth: 0.6, flow: 0.5 }),
  S({ lean: -16, hipY: 7, twist: 5, arm: [[12, 114], [184, 2]], leg: [[0, 30, -8], [34, -46, 16]], brow: -0.6, mouth: 0.6, flow: 0.56 }),
  S({ lean: -14, hipY: 6, twist: 4.4, arm: [[13, 115], [180, 6]], leg: [[-2, 28, -8], [32, -42, 15]], flow: 0.5 }),
  S({ lean: -4, hipY: 2, twist: 2, arm: [[18, 120], [130, 62]], flow: 0.28 }),
  S({ lean: 8, hipY: -1, arm: [[22, 122], [50, 100]], flow: 0.12 }),
  S({ lean: 5, arm: [[22, 122], [38, 112]] }),
]);

// 히든 초필 — 기를 끌어모아 대지를 부수는 일격
const hiddenSuper = seq([
  S({ lean: 0, hipY: -6, twist: 0, arm: [[-60, 150], [-60, 150]], leg: [[-24, 36, -6], [24, -36, 6]], brow: 0.1, mouth: 0.7 }),
  S({ lean: -4, hipY: -8, twist: 0, arm: [[-80, 160], [-80, 160]], leg: [[-28, 44, -6], [28, -44, 6]], mouth: 0.8, flow: 0.6 }),
  S({ lean: -8, hipY: -9, twist: 0, arm: [[-100, 168], [-100, 168]], leg: [[-30, 48, -6], [30, -48, 6]], mouth: 0.9, flow: 0.66 }),
  S({ lean: -10, hipY: -9, twist: 0, arm: [[-130, 172], [-130, 172]], leg: [[-32, 50, -6], [32, -50, 6]], mouth: 0.9, flow: 0.7 }),
  S({ lean: 6, hipY: -2, twist: 2, arm: [[-40, 120], [-36, 124]], leg: [[-22, 26, -6], [22, -26, 6]], brow: -0.5, mouth: 0.5 }),
  S({ lean: 28, hipY: 1, twist: 7, hipX: 4, arm: [[104, -6], [108, -10]], leg: [[-30, 30, -6], [36, -30, 12]], brow: -0.6, mouth: 0.6, flow: -0.5 }),
  S({ lean: 30, hipY: 1.4, twist: 7.6, hipX: 4.6, arm: [[110, -10], [114, -14]], leg: [[-32, 32, -6], [38, -32, 12]], flow: -0.44 }),
  S({ lean: 26, hipY: 1, twist: 6, hipX: 3.4, arm: [[96, 14], [100, 10]], flow: -0.3 }),
  S({ lean: 14, twist: 3, hipX: 1.4, arm: [[54, 68], [58, 64]], flow: -0.14 }),
  S({ lean: 5, arm: [[22, 122], [38, 112]] }),
]);

// ---- 무기 / 기타 ----

const weaponSwing = seq([
  S({ lean: -12, twist: -5, hipY: -1, arm: [[-56, 96], [-64, 104]], leg: [[-20, 22, -6], [12, -14, 6]] }),
  S({ lean: -14, twist: -6, hipY: -1.4, arm: [[-72, 88], [-80, 96]], leg: [[-22, 24, -6], [10, -12, 6]], brow: -0.2 }),
  S({ lean: 8, twist: 2, hipY: 0, arm: [[10, 74], [16, 70]], leg: [[-18, 18, -6], [20, -18, 6]], brow: -0.5 }),
  S({ lean: 22, twist: 6, hipX: 3, arm: [[86, 24], [92, 20]], leg: [[-24, 24, -6], [30, -26, 8]], brow: -0.55, mouth: 0.45, flow: -0.34 }),
  S({ lean: 24, twist: 6.4, hipX: 3.6, arm: [[100, 16], [106, 12]], leg: [[-26, 26, -6], [32, -28, 8]], flow: -0.28 }),
  S({ lean: 16, twist: 3.4, hipX: 1.6, arm: [[70, 52], [76, 48]], flow: -0.14 }),
  S({ lean: 6, twist: 0, arm: [[30, 100], [44, 96]] }),
]);
const weaponIdle = cyc(10, (u) => {
  const b = Math.sin(u * TAU);
  return S({ hipY: -0.6 + b * 0.8, lean: 3 + b * 1.2, flow: b * 0.05, arm: [[20 + b * 3, 118], [34 + b * 4, 88 - b * 4]] });
});
const throwItem = seq([
  S({ lean: -12, twist: -4, arm: [[-46, 110], [-54, 116]], brow: -0.2 }),
  S({ lean: 0, twist: 0, arm: [[10, 90], [4, 96]], brow: -0.4 }),
  S({ lean: 18, twist: 5, hipX: 2.4, arm: [[92, 10], [98, 6]], brow: -0.5, mouth: 0.35, flow: -0.28 }),
  S({ lean: 16, twist: 4, hipX: 1.8, arm: [[86, 20], [92, 16]], flow: -0.18 }),
  S({ lean: 6, arm: [[22, 122], [38, 112]] }),
]);

const win = cyc(12, (u) => {
  const b = Math.sin(u * TAU);
  return S({
    hipY: -0.4 + b * 1.2, lean: -6 + b * 2, head: 4, brow: -0.4, mouth: 0.5,
    flow: b * 0.16,
    arm: [[16 + b * 6, 126], [172 + b * 8, 14]],
    leg: [[-12, 12, -6], [12, -12, 6]],
  });
});
const taunt = cyc(12, (u) => {
  const b = Math.sin(u * TAU * 2);
  return S({
    hipY: -1 + b * 1.4, lean: 6, head: -3, brow: -0.5, mouth: 0.4,
    twist: b * 2, flow: -b * 0.14,
    arm: [[10, 130], [96 + b * 12, 60 - b * 20]],
  });
});
const defeat = seq([
  S({ rot: -70, lean: -16, hipY: -16, arm: [[-72, 36], [-58, 30]], leg: [[-18, 30, -12], [-4, 18, -8]], brow: 0.4, mouth: -0.8 }),
  S({ rot: -88, lean: -14, hipY: -21, arm: [[-80, 30], [-64, 24]], leg: [[-10, 20, -12], [2, 12, -8]], brow: 0.4, mouth: -0.9 }),
  S({ rot: -92, lean: -12, hipY: -22, arm: [[-84, 26], [-68, 20]], leg: [[-8, 18, -12], [4, 10, -8]], brow: 0.35, mouth: -0.9 }),
]);
const intro = seq([
  S({ lean: -10, hipY: -3, arm: [[-30, 140], [-36, 144]], brow: 0, mouth: 0.3 }),
  S({ lean: -6, hipY: -1, arm: [[0, 130], [-6, 136]], brow: -0.2, mouth: 0.4 }),
  S({ lean: 6, hipY: 0, arm: [[40, 100], [70, 60]], brow: -0.4, mouth: 0.5, flow: -0.2 }),
  S({ lean: 8, hipY: 0, arm: [[30, 110], [56, 80]], brow: -0.5, mouth: 0.4, flow: -0.1 }),
  S({ lean: 4, arm: [[22, 122], [38, 112]], brow: -0.4 }),
]);

export const CLIPS = {
  idle, walk, walkBack, run, jab1, jab2, jab3, heavy, launcher,
  jumpRise, jumpFall, jumpAtk, hurt, hurtHeavy, down, downed, getup, block,
  grabHold, knee, throwSwing, grabbed,
  spShot, spRise, spSpin, spPalm, superMove, hiddenSuper,
  weaponSwing, weaponIdle, throwItem, win, taunt, defeat, intro,
};

/** 잡졸은 필살기 클립을 굽지 않는다 (로딩 절약) */
export const GRUNT_CLIPS = [
  'idle', 'walk', 'walkBack', 'run', 'jab1', 'heavy', 'jumpAtk', 'hurt', 'hurtHeavy',
  'down', 'downed', 'getup', 'block', 'grabHold', 'grabbed', 'throwItem', 'defeat', 'weaponSwing',
];
export const BOSS_CLIPS = GRUNT_CLIPS.concat(['jab2', 'jab3', 'launcher', 'spShot', 'spRise', 'spSpin', 'spPalm', 'knee', 'throwSwing', 'win', 'intro']);
export const HERO_CLIPS = Object.keys(CLIPS);
