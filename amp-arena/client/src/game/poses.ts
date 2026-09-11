// 포즈 = 관절 각(도, 앞쪽이 양수) + 몸 들어올림. 시안의 2D 포즈 표와 같은 수치를 3D 리그에 그대로 쓴다.
// 어깨는 몸통의 자식이라 앞기울기(lean)가 팔 각도에 더해진다 — 타격 팔을 수평으로 뻗으려면 어깨 각 = 90 − lean.
import { MOVES, type MoveId, type PState } from '@amp/shared';

export interface Pose {
  lean: number;   // 몸통 앞기울기
  head: number;
  nearArm: [number, number]; // 오른팔 [상완, 전완]
  farArm: [number, number];  // 왼팔
  nearLeg: [number, number]; // 오른다리 [허벅지, 정강이]
  farLeg: [number, number];
  lift: number;   // m
  lying: number;  // 몸 전체 뒤로 눕힘 (도). 90 이면 누움
  spin: number;   // 몸 전체 회전 (구르기·띄움)
  reach: number;  // m — 몸 전체를 앞으로 내밈 (타격 포즈의 「쭉 뻗는」 느낌)
}

const P = (lean: number, head: number, nearArm: [number, number], farArm: [number, number], nearLeg: [number, number], farLeg: [number, number], lift = 0, lying = 0, reach = 0): Pose =>
  ({ lean, head, nearArm, farArm, nearLeg, farLeg, lift, lying, spin: 0, reach });

/** 타격 포즈를 후딜의 이 비율만큼 더 붙잡아 둔다 — 뻗은 팔·다리가 눈에 남아야 동작이 읽힌다 */
export const STRIKE_HOLD = 0.4;

export const POSES = {
  idle: P(0, 0, [12, 25], [-8, 20], [0, 0], [0, 0]),
  walkA: P(4, 0, [35, 30], [-30, 25], [28, -15], [-22, 0]),
  walkB: P(4, 0, [-30, 25], [35, 30], [-22, 0], [28, -15]),
  runA: P(16, -4, [70, 80], [-55, 70], [50, -70], [-40, -20], 0.03),
  runB: P(16, -4, [-55, 70], [70, 80], [-40, -20], [50, -70], 0.03),
  jump: P(-6, -6, [150, 20], [140, 15], [45, -90], [30, -70]),
  fall: P(4, 8, [120, 10], [110, 10], [20, -40], [10, -30]),
  land: P(22, 4, [30, 40], [20, 40], [40, -60], [30, -50], -0.12),
  jabWind: P(2, 2, [-35, 80], [30, 90], [20, -5], [-20, 0]),
  jab: P(16, 4, [76, 0], [25, 100], [28, -6], [-26, 0], 0, 0, 0.16),
  straightWind: P(0, 2, [30, 90], [-40, 70], [25, -5], [-25, 0]),
  straight: P(24, 6, [-20, 90], [68, 0], [38, -10], [-30, 0], 0, 0, 0.24),
  roundWind: P(-8, -2, [-30, 40], [40, 50], [30, -70], [-20, 0]),
  roundhouse: P(-10, 0, [-45, 30], [60, 40], [100, 0], [-15, 0], 0.03, 0, 0.14),
  tackle: P(40, 6, [60, 0], [50, 0], [-10, -40], [-35, 0], 0.08, 0, 0.22),
  divekick: P(26, 4, [-50, 20], [-60, 20], [85, 0], [-20, -60], 0, 0, 0.16),
  uppercutWind: P(14, 6, [-40, 90], [20, 60], [35, -40], [-20, -10], -0.08),
  uppercut: P(-8, -8, [140, 0], [-30, 60], [30, -20], [-30, 0], 0.06, 0, 0.12),
  guard: P(6, 2, [55, -125], [50, -120], [20, -30], [-15, -25], -0.03),
  hit: P(-22, -14, [-60, -20], [-50, -10], [-15, 10], [10, 0]),
  launched: P(-70, -20, [-90, -30], [-100, -20], [40, -40], [10, -30]),
  grab: P(12, 4, [78, 0], [74, 0], [20, -5], [-25, 0], 0, 0, 0.14),
  held: P(-10, -6, [-40, -30], [-30, -30], [20, -50], [30, -60], 0.15),
  throw: P(28, 8, [135, 10], [110, 20], [40, -15], [-35, 0]),
  stun: P(-6, 8, [-15, 30], [-25, 35], [10, -15], [-10, -10], -0.02),
  getup: P(30, 0, [60, -40], [40, -20], [70, -100], [20, -60], -0.14),
  down: P(0, 0, [20, 10], [-10, 10], [10, 0], [-5, 0], 0.18, 90),
  dead: P(0, 10, [40, 10], [-30, 10], [15, 0], [-10, 0], 0.18, 92),
  swingWind: P(-14, -6, [178, -10], [-20, 40], [-20, -5], [25, 0]),
  swing: P(30, 8, [56, 0], [-30, 40], [32, -10], [-35, 0], 0, 0, 0.2),
  swing2Wind: P(-6, -4, [-50, 45], [-20, 40], [20, -5], [-25, 0]),
  swing2: P(22, 8, [70, 0], [-30, 40], [36, -10], [-30, 0], 0, 0, 0.24),
  thrustWind: P(-6, 0, [-40, 70], [40, 50], [25, -5], [-25, 0]),
  thrust: P(26, 4, [64, 0], [46, 0], [46, -15], [-40, 0], 0, 0, 0.28),
  shoot: P(8, 2, [82, 0], [-20, 60], [15, -5], [-15, 0], 0, 0, 0.06),
  bashWind: P(-6, 0, [-20, 60], [-40, 70], [20, -5], [-25, 0]),
  bash: P(20, 4, [-20, 60], [70, 0], [36, -10], [-30, 0], 0, 0, 0.22),
  slamWind: P(-16, -10, [170, -20], [160, -20], [20, -30], [10, -20], 0.02),
  slam: P(40, 12, [60, -20], [50, -20], [60, -90], [50, -80], -0.16),
  roll: P(60, 30, [80, -60], [70, -60], [90, -120], [80, -110], 0.1),
  kickHigh: P(-14, -4, [-50, 30], [50, 40], [125, 0], [-10, 0], 0.04, 0, 0.1),
  hookWind: P(-2, 2, [-40, 110], [30, 80], [20, -5], [-20, 0]),
  hook: P(16, 6, [72, 40], [-20, 90], [32, -10], [-30, 0], 0, 0, 0.16),
  flyKick: P(30, 6, [-60, 20], [-50, 20], [96, 0], [-30, -70], 0.12, 0, 0.22),
} as const;

export type PoseId = keyof typeof POSES;

/** 동작별 준비 → 타격 포즈 */
export const MOVE_POSES: Record<MoveId, [PoseId, PoseId]> = {
  jab: ['jabWind', 'jab'], straight: ['straightWind', 'straight'], roundhouse: ['roundWind', 'roundhouse'],
  tackle: ['tackle', 'tackle'], divekick: ['divekick', 'divekick'], uppercut: ['uppercutWind', 'uppercut'], grab: ['grab', 'grab'],
  gs1: ['swingWind', 'swing'], gs2: ['swing2Wind', 'swing2'], gsSlam: ['slamWind', 'slam'],
  sp1: ['thrustWind', 'thrust'], sp2: ['thrustWind', 'thrust'], sp3: ['thrustWind', 'thrust'], spCharge: ['thrust', 'thrust'],
  shieldBash: ['bashWind', 'bash'], shieldCharge: ['bash', 'bash'],
  rk1: ['jabWind', 'jab'], rk2: ['straightWind', 'straight'], rk3: ['uppercutWind', 'uppercut'], rocketPunch: ['straightWind', 'straight'],
  gunShot: ['shoot', 'shoot'], gunRoll: ['roll', 'shoot'],
  itemThrow: ['throw', 'throw'],
  hook: ['hookWind', 'hook'], bodySlam: ['slamWind', 'slam'], dashGrab: ['tackle', 'grab'],
  quick1: ['jabWind', 'jab'], quick2: ['straightWind', 'straight'], quick3: ['jabWind', 'jab'], quick4: ['roundWind', 'roundhouse'],
  spinKick: ['roundWind', 'kickHigh'],
  heavy1: ['swingWind', 'swing'], heavy2: ['swing2Wind', 'swing2'], quake: ['slamWind', 'slam'],
  kick1: ['roundWind', 'roundhouse'], kick2: ['roundWind', 'kickHigh'], kick3: ['roundWind', 'roundhouse'], flyingKick: ['flyKick', 'flyKick'],
};

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const l = (x: number, y: number) => x + (y - x) * k;
  return {
    lean: l(a.lean, b.lean), head: l(a.head, b.head),
    nearArm: [l(a.nearArm[0], b.nearArm[0]), l(a.nearArm[1], b.nearArm[1])],
    farArm: [l(a.farArm[0], b.farArm[0]), l(a.farArm[1], b.farArm[1])],
    nearLeg: [l(a.nearLeg[0], b.nearLeg[0]), l(a.nearLeg[1], b.nearLeg[1])],
    farLeg: [l(a.farLeg[0], b.farLeg[0]), l(a.farLeg[1], b.farLeg[1])],
    lift: l(a.lift, b.lift), lying: l(a.lying, b.lying), spin: l(a.spin, b.spin), reach: l(a.reach, b.reach),
  };
}

/** 상태·틱·동작 → 목표 포즈. 공격은 프레임 데이터의 발동/지속/후딜 구간으로 키프레임을 나눈다. */
export function targetPose(state: PState, t: number, move: MoveId | null, speed: number, grounded: boolean, holding = false): Pose {
  if (holding && (state === 'idle' || state === 'walk' || state === 'run' || state === 'jump' || state === 'fall' || state === 'land')) {
    const base = targetPose(state, t, move, speed, grounded, false);
    return { ...base, nearArm: [165, 10], farArm: [165, 10] };
  }
  switch (state) {
    case 'idle': {
      const breathe = Math.sin(t / 18) * 1.5;
      const p = { ...POSES.idle, lean: breathe, lift: Math.sin(t / 18) * 0.004 };
      return p;
    }
    case 'walk': {
      const ph = (t * 0.22 * Math.max(0.5, speed / 4.5)) % (Math.PI * 2);
      return lerpPose(POSES.walkA, POSES.walkB, (Math.sin(ph) + 1) / 2);
    }
    case 'run': {
      const ph = (t * 0.32) % (Math.PI * 2);
      const p = lerpPose(POSES.runA, POSES.runB, (Math.sin(ph) + 1) / 2);
      p.lift += Math.abs(Math.cos(ph)) * 0.05;
      return p;
    }
    case 'jump': return POSES.jump;
    case 'fall': return POSES.fall;
    case 'land': return t < 3 ? POSES.land : lerpPose(POSES.land, POSES.idle, (t - 3) / 6);
    case 'attack': case 'special': case 'dashAttack': case 'jumpAttack': {
      const m = MOVES[move ?? 'jab'];
      const [windId, strikeId] = MOVE_POSES[move ?? 'jab'];
      const wind = POSES[windId], strike = POSES[strikeId];
      if (m.activeUntilLand) return strike;
      if (move === 'spinKick' && t >= m.startup && t < m.startup + m.active) return { ...strike, spin: 0, lean: strike.lean, lift: 0.05 };
      if (t < m.startup) {
        // 준비 동작은 발동의 앞 55%, 나머지에 준비 → 타격으로 뻗는다
        const half = Math.max(1, m.startup * 0.55);
        return t < half ? lerpPose(POSES.idle, wind, t / half) : lerpPose(wind, strike, (t - half) / Math.max(1, m.startup - half));
      }
      // 지속 + 후딜의 앞 40% 는 타격 포즈 고정 — 뻗은 팔·다리가 눈에 남는다. 나머지 후딜에 복귀
      const holdEnd = m.startup + m.active + Math.round(m.recovery * STRIKE_HOLD);
      if (t < holdEnd) return strike;
      const r = (t - holdEnd) / Math.max(1, m.startup + m.active + m.recovery - holdEnd);
      return lerpPose(strike, POSES.idle, r * r);
    }
    case 'guard': return POSES.guard;
    case 'stun': { const p = { ...POSES.stun }; p.lean += Math.sin(t / 5) * 4; return p; }
    case 'grabTry': case 'grabbing': return POSES.grab;
    case 'held': return POSES.held;
    case 'throw': return t < 10 ? lerpPose(POSES.grab, POSES.throw, t / 10) : lerpPose(POSES.throw, POSES.idle, (t - 10) / 20);
    case 'hitstun': { const p = { ...POSES.hit }; p.lean += Math.sin(t * 1.3) * 3 * Math.max(0, 1 - t / 14); return p; }
    case 'launched': case 'thrown': { const p = { ...POSES.launched }; p.spin = grounded ? 0 : Math.min(t * 6, 320); return p; }
    case 'down': return POSES.down;
    case 'getup': return t < 12 ? lerpPose(POSES.down, POSES.getup, t / 12) : lerpPose(POSES.getup, POSES.idle, (t - 12) / 12);
    case 'roll': { const p = { ...POSES.roll }; p.spin = t * 12; return p; }
    case 'dead': return POSES.dead;
  }
}
