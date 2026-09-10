// 치비 캐릭터 "루키" SVG 생성기 — 측면(3/4) 포즈와 정면.
// 단위: 발바닥 중심이 (0,0), 위가 음수. 전체 키 약 120.
import { T, r2 } from './tokens.mjs';

const SW = 3; // 외곽선 두께
const st = (fill, extra = '') =>
  `style="fill:${fill};stroke:${T.outline};stroke-width:${SW}px;stroke-linejoin:round;stroke-linecap:round;${extra}"`;

// 팔·다리 각도: 0 = 아래로 곧게, 양수 = 앞(바라보는 쪽)으로 올림.
// [상완, 전완] / [허벅지, 정강이]. lean 은 몸통 앞기울기, head 는 머리 앞기울기, lift 는 지면에서 띄우기.
export const POSES = {
  idle:       { lean: 0,   head: 0,   nearArm: [12, 25],    farArm: [-8, 20],    nearLeg: [0, 0],     farLeg: [0, 0],     lift: 0 },
  walk:       { lean: 4,   head: 0,   nearArm: [35, 30],    farArm: [-30, 25],   nearLeg: [28, -15],  farLeg: [-22, 0],   lift: 0 },
  run:        { lean: 16,  head: -4,  nearArm: [70, 80],    farArm: [-55, 70],   nearLeg: [50, -70],  farLeg: [-40, -20], lift: 3 },
  jump:       { lean: -6,  head: -6,  nearArm: [150, 20],   farArm: [140, 15],   nearLeg: [45, -90],  farLeg: [30, -70],  lift: 34 },
  attack1:    { lean: 10,  head: 4,   nearArm: [95, 0],     farArm: [20, 100],   nearLeg: [25, -5],   farLeg: [-25, 0],   lift: 0 },
  attack2:    { lean: 18,  head: 6,   nearArm: [-20, 90],   farArm: [100, 0],    nearLeg: [35, -10],  farLeg: [-30, 0],   lift: 0 },
  attack3:    { lean: -12, head: 0,   nearArm: [-40, 30],   farArm: [60, 40],    nearLeg: [105, 0],   farLeg: [-15, 0],   lift: 4 },
  dashAttack: { lean: 38,  head: 6,   nearArm: [110, 10],   farArm: [80, 10],    nearLeg: [-10, -40], farLeg: [-35, 0],   lift: 10 },
  jumpAttack: { lean: 26,  head: 4,   nearArm: [-50, 20],   farArm: [-60, 20],   nearLeg: [70, 0],    farLeg: [-20, -60], lift: 36 },
  guard:      { lean: 6,   head: 2,   nearArm: [55, -125],  farArm: [50, -120],  nearLeg: [20, -30],  farLeg: [-15, -25], lift: -4 },
  hit:        { lean: -22, head: -14, nearArm: [-60, -20],  farArm: [-50, -10],  nearLeg: [-15, 10],  farLeg: [10, 0],    lift: 0 },
  launched:   { lean: -70, head: -20, nearArm: [-90, -30],  farArm: [-100, -20], nearLeg: [40, -40],  farLeg: [10, -30],  lift: 40 },
  grab:       { lean: 12,  head: 4,   nearArm: [80, 25],    farArm: [75, 30],    nearLeg: [20, -5],   farLeg: [-25, 0],   lift: 0 },
  throw:      { lean: 28,  head: 8,   nearArm: [135, 10],   farArm: [110, 20],   nearLeg: [40, -15],  farLeg: [-35, 0],   lift: 0 },
  uppercut:   { lean: -14, head: -8,  nearArm: [175, 15],   farArm: [-30, 60],   nearLeg: [30, -20],  farLeg: [-30, 0],   lift: 8 },
  stun:       { lean: -6,  head: 8,   nearArm: [-15, 30],   farArm: [-25, 35],   nearLeg: [10, -15],  farLeg: [-10, -10], lift: -2 },
  getup:      { lean: 30,  head: 0,   nearArm: [60, -40],   farArm: [40, -20],   nearLeg: [70, -100], farLeg: [20, -60],  lift: -14 },
  down:       { lean: 0,   head: 0,   nearArm: [20, 10],    farArm: [-10, 10],   nearLeg: [10, 0],    farLeg: [-5, 0],    lift: 0, lying: true },
  swing:      { lean: 22,  head: 6,   nearArm: [120, -10],  farArm: [-30, 40],   nearLeg: [30, -10],  farLeg: [-35, 0],   lift: 0 },
  thrust:     { lean: 20,  head: 4,   nearArm: [90, 0],     farArm: [70, 0],     nearLeg: [45, -15],  farLeg: [-40, 0],   lift: 0 },
  shoot:      { lean: 6,   head: 2,   nearArm: [88, 0],     farArm: [-20, 60],   nearLeg: [15, -5],   farLeg: [-15, 0],   lift: 0 },
  bash:       { lean: 14,  head: 4,   nearArm: [40, -70],   farArm: [-30, 40],   nearLeg: [35, -10],  farLeg: [-30, 0],   lift: 0 },
};

const FACE_FOR_POSE = {
  attack1: 'angry', attack2: 'angry', attack3: 'angry', dashAttack: 'angry', jumpAttack: 'angry', uppercut: 'angry',
  swing: 'angry', thrust: 'angry', shoot: 'angry', bash: 'angry', throw: 'angry', grab: 'angry',
  hit: 'hurt', launched: 'hurt', down: 'dizzy', stun: 'dizzy', guard: 'calm',
};

/** 두 겹 스트로크로 굵은 팔다리 하나를 그린다: 바깥 외곽선 + 안쪽 색. */
function limb(len, width, fill) {
  return (
    `<line x1="0" y1="0" x2="0" y2="${len}" style="stroke:${T.outline};stroke-width:${width + SW * 2}px;stroke-linecap:round"></line>` +
    `<line x1="0" y1="0" x2="0" y2="${len}" style="stroke:${fill};stroke-width:${width}px;stroke-linecap:round"></line>`
  );
}

function foot(shoes) {
  return `<path d="M -6 -3 L 10 -3 Q 15 -3 15 2 Q 15 6 10 6 L -6 6 Q -9 6 -9 2 Q -9 -3 -6 -3 Z" ${st(shoes)}></path>` +
    `<line x1="-2" y1="1" x2="9" y2="1" style="stroke:${T.outline};stroke-width:2px;stroke-linecap:round"></line>`;
}

function hand(r, skin) {
  return `<circle cx="0" cy="0" r="${r}" ${st(skin)}></circle>`;
}

/** 손 좌표계(전완 방향 = +y)에 그리는 악세서리. */
export function accessoryInHand(acc, { skin }) {
  switch (acc) {
    case 'greatsword':
      return (
        `<rect x="-8" y="6" width="16" height="5" rx="1.5" ${st(T.amp)}></rect>` +
        `<path d="M -5 11 L 5 11 L 5 56 L 0 66 L -5 56 Z" ${st(T.steel)}></path>` +
        `<line x1="0" y1="14" x2="0" y2="54" style="stroke:${T.steelDark};stroke-width:2px"></line>` +
        `<rect x="-3.5" y="-9" width="7" height="15" rx="2" ${st(T.woodDark)}></rect>` +
        hand(6.5, skin)
      );
    case 'spear':
      return (
        `<line x1="0" y1="-34" x2="0" y2="70" style="stroke:${T.outline};stroke-width:${4 + SW * 2}px;stroke-linecap:round"></line>` +
        `<line x1="0" y1="-34" x2="0" y2="70" style="stroke:${T.wood};stroke-width:4px;stroke-linecap:round"></line>` +
        `<path d="M -6 68 L 6 68 L 0 90 Z" ${st(T.steel)}></path>` +
        `<rect x="-5" y="60" width="10" height="5" rx="1" ${st(T.amp)}></rect>` +
        hand(6.5, skin)
      );
    case 'pistol':
      return (
        hand(6.5, skin) +
        `<rect x="-4" y="2" width="8" height="12" rx="1.5" ${st('#3b4260')}></rect>` +
        `<rect x="-3" y="12" width="6" height="16" rx="1.5" ${st(T.steelDark)}></rect>` +
        `<circle cx="0" cy="8" r="1.6" style="fill:${T.amp}"></circle>`
      );
    case 'shield':
      return hand(6.5, skin);
    case 'rocket':
      return (
        `<path d="M -12 -14 Q -18 -22 -12 -30 Q -8 -24 -10 -18 Q -6 -22 -3 -30 Q 0 -22 -4 -14 Z" style="fill:${T.amp2};stroke:${T.outline};stroke-width:2px;stroke-linejoin:round"></path>` +
        `<circle cx="0" cy="0" r="11" ${st(T.red)}></circle>` +
        `<circle cx="0" cy="-2" r="4" style="fill:${T.amp}"></circle>` +
        `<rect x="-11" y="-13" width="22" height="6" rx="2" ${st(T.steel)}></rect>`
      );
    default:
      return hand(6.5, skin);
  }
}

/** 전완 좌표계에 붙는 방패 (전완 바깥쪽). */
function shieldOnForearm() {
  return (
    `<g transform="translate(6 4)">` +
    `<path d="M -13 -18 L 13 -18 L 13 4 Q 13 14 0 20 Q -13 14 -13 4 Z" ${st(T.blue)}></path>` +
    `<path d="M -7 -10 L 7 -10 L 7 2 Q 7 8 0 11 Q -7 8 -7 2 Z" style="fill:${T.amp}"></path>` +
    `</g>`
  );
}

function face(kind, headR) {
  const ex1 = 13, ex2 = 1, ey = -1;
  const eye = (x) =>
    `<circle cx="${x}" cy="${ey}" r="4.2" style="fill:${T.outline}"></circle>` +
    `<circle cx="${x + 1.4}" cy="${ey - 1.5}" r="1.4" style="fill:#ffffff"></circle>`;
  switch (kind) {
    case 'angry':
      return (
        eye(ex1) + eye(ex2) +
        `<line x1="${ex1 - 5}" y1="${ey - 9}" x2="${ex1 + 5}" y2="${ey - 6}" style="stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round"></line>` +
        `<line x1="${ex2 - 5}" y1="${ey - 6}" x2="${ex2 + 5}" y2="${ey - 9}" style="stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round"></line>` +
        `<path d="M 6 9 Q 11 16 16 9 Z" style="fill:${T.outline}"></path>`
      );
    case 'hurt':
      return (
        `<path d="M ${ex1 - 4} ${ey - 4} L ${ex1 + 3} ${ey} L ${ex1 - 4} ${ey + 4}" style="fill:none;stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round;stroke-linejoin:round"></path>` +
        `<path d="M ${ex2 + 4} ${ey - 4} L ${ex2 - 3} ${ey} L ${ex2 + 4} ${ey + 4}" style="fill:none;stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round;stroke-linejoin:round"></path>` +
        `<path d="M 6 10 Q 9 7 12 10 Q 15 13 18 10" style="fill:none;stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round"></path>`
      );
    case 'dizzy': {
      const spiral = (cx, cy) =>
        `<path d="M ${cx} ${cy} m 0 -1 a 1 1 0 1 1 -1 1 a 2 2 0 1 0 2 -2 a 3.5 3.5 0 1 1 -3.5 3.5" style="fill:none;stroke:${T.outline};stroke-width:2px;stroke-linecap:round"></path>`;
      return spiral(ex1, ey) + spiral(ex2, ey) +
        `<circle cx="11" cy="10" r="2.6" style="fill:${T.outline}"></circle>`;
    }
    default:
      return eye(ex1) + eye(ex2) +
        `<path d="M 7 8 Q 11 12 15 8" style="fill:none;stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round"></path>`;
  }
}

/**
 * 측면(3/4) 치비 캐릭터.
 * @param {object} o x,y: 발 중심 좌표 · s: 배율 · facing: 1 오른쪽 / -1 왼쪽 · pose · shirt/pants/band/shoes 색 · acc 악세서리 · alpha
 */
export function figure(o = {}) {
  const {
    x = 0, y = 0, s = 1, facing = 1, pose = 'idle', shirt = T.slot[0], pants = T.pants, band = T.amp,
    shoes = T.shoe, acc = null, skin = T.skin, faceKind = null, shadow = true, alpha = 1, hair = T.hair,
  } = o;
  const P = POSES[pose] ?? POSES.idle;
  const F = faceKind ?? FACE_FOR_POSE[pose] ?? 'calm';
  const parts = [];

  if (shadow) {
    parts.push(P.lying
      ? `<ellipse cx="-30" cy="4" rx="70" ry="9" style="fill:rgba(0,0,0,0.30)"></ellipse>`
      : `<ellipse cx="0" cy="2" rx="27" ry="7" style="fill:rgba(0,0,0,0.30)"></ellipse>`);
  }

  // 누운 포즈: 발을 축으로 -90° 돌려 머리가 뒤쪽(-x)으로 눕는다. 몸 두께만큼 띄운다.
  const bodyTransform = P.lying ? `translate(30 -20) rotate(-90)` : `translate(0 ${-P.lift})`;
  parts.push(`<g transform="${bodyTransform}">`);

  const leg = (angles, near) =>
    `<g transform="translate(${near ? 6 : -6} -30) rotate(${-angles[0]})">` +
    limb(14, 10, pants) +
    `<g transform="translate(0 14) rotate(${-angles[1]})">` +
    limb(12, 8, skin) +
    `<g transform="translate(0 12)">` + foot(shoes) + `</g>` +
    `</g></g>`;

  const arm = (angles, near) =>
    `<g transform="translate(${near ? 13 : -13} -30) rotate(${-angles[0]})">` +
    limb(15, 9, skin) +
    `<g transform="translate(0 15) rotate(${-angles[1]})">` +
    limb(13, 8, skin) +
    (acc === 'shield' && !near ? shieldOnForearm() : '') +
    `<g transform="translate(0 15)">` + (near ? accessoryInHand(acc, { skin }) : hand(6.5, skin)) + `</g>` +
    `</g></g>`;

  // 뒤쪽 다리·팔 → 몸통 → 앞쪽 다리·팔 → 머리
  parts.push(leg(P.farLeg, false));
  parts.push(`<g transform="translate(0 -30) rotate(${-P.lean})">`);
  parts.push(arm(P.farArm, false));
  parts.push(
    `<path d="M -12 0 L 12 0 L 15 -30 Q 15 -34 11 -34 L -11 -34 Q -15 -34 -15 -30 Z" ${st(shirt)}></path>` +
    `<path d="M -9 -33 L -4 -22 L 4 -22 L 9 -33" style="fill:none;stroke:${T.outline};stroke-width:2px;stroke-linecap:round"></path>`
  );
  // 머리
  parts.push(`<g transform="translate(0 -56) rotate(${-P.head})">`);
  parts.push(
    `<path d="M -8 -24 L -34 -38 L -20 -18 L -42 -22 L -24 -8 L -40 0 L -22 0 Z" ${st(hair)}></path>` +
    `<circle cx="0" cy="0" r="26" ${st(skin)}></circle>` +
    `<path d="M -25 -8 Q 0 -17 25 -8" style="fill:none;stroke:${T.outline};stroke-width:${7 + SW * 2}px;stroke-linecap:round"></path>` +
    `<path d="M -25 -8 Q 0 -17 25 -8" style="fill:none;stroke:${band};stroke-width:7px;stroke-linecap:round"></path>` +
    `<path d="M -25 -8 L -40 -6 L -30 -1 Z" ${st(band)}></path>` +
    `<path d="M -26 -7 L -38 3 L -27 1 Z" ${st(band)}></path>` +
    face(F, 26)
  );
  parts.push(`</g>`); // head
  parts.push(arm(P.nearArm, true));
  parts.push(`</g>`); // torso
  parts.push(leg(P.nearLeg, true));
  parts.push(`</g>`); // lift

  const op = alpha < 1 ? `opacity:${alpha};` : '';
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${r2(s * facing)} ${r2(s)})" style="${op}">${parts.join('')}</g>`;
}

/** 정면 치비 캐릭터 (캐릭터 시트·슬롯 아바타·결과 MVP). */
export function figureFront(o = {}) {
  const {
    x = 0, y = 0, s = 1, shirt = T.slot[0], pants = T.pants, band = T.amp, shoes = T.shoe, skin = T.skin,
    hair = T.hair, shadow = true, armsUp = false, faceKind = 'calm',
  } = o;
  const parts = [];
  if (shadow) parts.push(`<ellipse cx="0" cy="2" rx="30" ry="7" style="fill:rgba(0,0,0,0.30)"></ellipse>`);
  const legF = (sx) =>
    `<g transform="translate(${sx} -30)">` + limb(14, 11, pants) +
    `<g transform="translate(0 14)">` + limb(12, 9, skin) +
    `<g transform="translate(0 12)"><path d="M -8 -3 L 8 -3 Q 12 -3 12 2 Q 12 6 8 6 L -8 6 Q -12 6 -12 2 Q -12 -3 -8 -3 Z" ${st(shoes)}></path></g>` +
    `</g></g>`;
  const armF = (sx, dir) => {
    const a = armsUp ? 150 * dir : 18 * dir;
    return `<g transform="translate(${sx} -58) rotate(${a})">` + limb(15, 9, skin) +
      `<g transform="translate(0 15) rotate(${armsUp ? -10 * dir : 6 * dir})">` + limb(13, 8, skin) +
      `<g transform="translate(0 15)">${hand(6.5, skin)}</g></g></g>`;
  };
  parts.push(legF(-8), legF(8));
  parts.push(armF(-16, 1), armF(16, -1));
  parts.push(
    `<path d="M -14 -30 L 14 -30 L 17 -60 Q 17 -64 13 -64 L -13 -64 Q -17 -64 -17 -60 Z" ${st(shirt)}></path>` +
    `<path d="M -8 -63 L -3 -54 L 3 -54 L 8 -63" style="fill:none;stroke:${T.outline};stroke-width:2px;stroke-linecap:round"></path>`
  );
  // 머리
  parts.push(`<g transform="translate(0 -86)">`);
  parts.push(
    `<path d="M -10 -22 L -14 -36 L -4 -26 L 0 -38 L 4 -26 L 14 -36 L 10 -22 Z" ${st(hair)}></path>` +
    `<circle cx="0" cy="0" r="26" ${st(skin)}></circle>` +
    `<path d="M -25 -8 Q 0 -17 25 -8" style="fill:none;stroke:${T.outline};stroke-width:${7 + SW * 2}px;stroke-linecap:round"></path>` +
    `<path d="M -25 -8 Q 0 -17 25 -8" style="fill:none;stroke:${band};stroke-width:7px;stroke-linecap:round"></path>` +
    `<path d="M 25 -8 L 38 -12 L 34 -2 Z" ${st(band)}></path>`
  );
  const eye = (ex) =>
    `<circle cx="${ex}" cy="-1" r="4.4" style="fill:${T.outline}"></circle>` +
    `<circle cx="${ex + 1.5}" cy="-2.5" r="1.5" style="fill:#ffffff"></circle>`;
  if (faceKind === 'angry') {
    parts.push(eye(-9) + eye(9) +
      `<line x1="-14" y1="-9" x2="-4" y2="-6" style="stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round"></line>` +
      `<line x1="14" y1="-9" x2="4" y2="-6" style="stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round"></line>` +
      `<path d="M -5 9 Q 0 16 5 9 Z" style="fill:${T.outline}"></path>`);
  } else {
    parts.push(eye(-9) + eye(9) + `<path d="M -5 8 Q 0 13 5 8" style="fill:none;stroke:${T.outline};stroke-width:2.5px;stroke-linecap:round"></path>`);
  }
  parts.push(`</g>`);
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${r2(s)} ${r2(s)})">${parts.join('')}</g>`;
}

/** 독립 SVG 로 감싼다 (뷰박스는 발 기준 좌표계). */
export function svgWrap(inner, { w, h, vb, extra = '' }) {
  return `<svg viewBox="${vb}" width="${w}" height="${h}" style="display:block;overflow:visible;${extra}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
