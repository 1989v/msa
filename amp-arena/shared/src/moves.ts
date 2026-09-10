// 프레임 데이터 — 기획서 §6.2·§7 의 표. 60틱 기준.
export type HitEffect = 'hitstun' | 'launch';

export interface MoveDef {
  id: string;
  startup: number;
  active: number;       // 0 이면 착지까지 (다이빙 킥)
  recovery: number;
  damage: number;
  reach: number;        // 판정 구 중심까지 거리 (m)
  radius: number;       // 판정 구 반지름 (m)
  effect: HitEffect;
  hitstun: number;      // effect=hitstun 일 때 경직 틱
  push: number;         // 밀림 m/s
  launchH: number;      // effect=launch 수평 m/s
  launchV: number;      // effect=launch 상승 m/s
  arcDeg: number;       // 판정 부채꼴 (정면 기준 전체 각)
  moveSpeed: number;    // 발동~지속 동안 전진 m/s (태클·돌진)
  moveUntil: 'active' | 'none';
  pierce: boolean;      // 여러 명 관통
  guardBreak: boolean;  // 가드 무시
  activeUntilLand: boolean;
}

const base: Omit<MoveDef, 'id' | 'startup' | 'active' | 'recovery' | 'damage' | 'reach' | 'radius' | 'effect'> = {
  hitstun: 14, push: 1.5, launchH: 6, launchV: 7, arcDeg: 110, moveSpeed: 0, moveUntil: 'none', pierce: false, guardBreak: false, activeUntilLand: false,
};
const def = (m: Partial<MoveDef> & Pick<MoveDef, 'id' | 'startup' | 'active' | 'recovery' | 'damage' | 'reach' | 'radius' | 'effect'>): MoveDef => ({ ...base, ...m });

export const MOVES = {
  // 맨손
  jab: def({ id: 'jab', startup: 5, active: 3, recovery: 8, damage: 5, reach: 1.1, radius: 0.5, effect: 'hitstun', hitstun: 14, push: 1.5 }),
  straight: def({ id: 'straight', startup: 6, active: 3, recovery: 10, damage: 6, reach: 1.2, radius: 0.5, effect: 'hitstun', hitstun: 16, push: 2 }),
  roundhouse: def({ id: 'roundhouse', startup: 10, active: 5, recovery: 18, damage: 10, reach: 1.3, radius: 0.7, effect: 'launch', launchH: 6, launchV: 7 }),
  tackle: def({ id: 'tackle', startup: 8, active: 8, recovery: 16, damage: 8, reach: 1.0, radius: 0.6, effect: 'launch', launchH: 5, launchV: 5, moveSpeed: 6, moveUntil: 'active' }),
  divekick: def({ id: 'divekick', startup: 6, active: 0, recovery: 12, damage: 9, reach: 0.9, radius: 0.6, effect: 'launch', launchH: 4, launchV: 5, activeUntilLand: true }),
  uppercut: def({ id: 'uppercut', startup: 14, active: 4, recovery: 22, damage: 14, reach: 1.0, radius: 0.7, effect: 'launch', launchH: 2, launchV: 9 }),
  grab: def({ id: 'grab', startup: 4, active: 2, recovery: 12, damage: 0, reach: 0, radius: 0, effect: 'hitstun' }),
  // 브레이커 (대검)
  gs1: def({ id: 'gs1', startup: 9, active: 4, recovery: 14, damage: 12, reach: 1.6, radius: 0.9, effect: 'hitstun', hitstun: 20, push: 3, arcDeg: 150 }),
  gs2: def({ id: 'gs2', startup: 12, active: 5, recovery: 22, damage: 16, reach: 1.6, radius: 0.9, effect: 'launch', launchH: 6, launchV: 7, arcDeg: 150 }),
  gsSlam: def({ id: 'gsSlam', startup: 22, active: 4, recovery: 26, damage: 20, reach: 0.6, radius: 2.5, effect: 'launch', launchH: 5, launchV: 8, arcDeg: 360, pierce: true }),
  // 스파이크 (장창)
  sp1: def({ id: 'sp1', startup: 6, active: 3, recovery: 10, damage: 6, reach: 1.9, radius: 0.45, effect: 'hitstun', hitstun: 14, push: 2, arcDeg: 30 }),
  sp2: def({ id: 'sp2', startup: 6, active: 3, recovery: 10, damage: 6, reach: 1.9, radius: 0.45, effect: 'hitstun', hitstun: 16, push: 2, arcDeg: 30 }),
  sp3: def({ id: 'sp3', startup: 9, active: 4, recovery: 16, damage: 12, reach: 2.0, radius: 0.5, effect: 'launch', launchH: 6, launchV: 6, arcDeg: 30 }),
  spCharge: def({ id: 'spCharge', startup: 6, active: 30, recovery: 18, damage: 14, reach: 1.6, radius: 0.6, effect: 'launch', launchH: 6, launchV: 6, arcDeg: 40, moveSpeed: 12, moveUntil: 'active', pierce: true }),
  // 월 (방패)
  shieldBash: def({ id: 'shieldBash', startup: 7, active: 3, recovery: 12, damage: 8, reach: 1.0, radius: 0.6, effect: 'hitstun', hitstun: 16, push: 3 }),
  shieldCharge: def({ id: 'shieldCharge', startup: 6, active: 38, recovery: 16, damage: 12, reach: 0.9, radius: 0.6, effect: 'launch', launchH: 6, launchV: 5, moveSpeed: 8, moveUntil: 'active' }),
  // 부스터 (로켓 글러브)
  rk1: def({ id: 'rk1', startup: 5, active: 3, recovery: 8, damage: 6, reach: 1.5, radius: 0.5, effect: 'hitstun', hitstun: 14, push: 1.5 }),
  rk2: def({ id: 'rk2', startup: 6, active: 3, recovery: 10, damage: 6, reach: 1.6, radius: 0.5, effect: 'hitstun', hitstun: 16, push: 2 }),
  rk3: def({ id: 'rk3', startup: 10, active: 5, recovery: 18, damage: 12, reach: 1.7, radius: 0.7, effect: 'launch', launchH: 6, launchV: 7 }),
  rocketPunch: def({ id: 'rocketPunch', startup: 8, active: 1, recovery: 14, damage: 16, reach: 0, radius: 0, effect: 'launch', launchH: 6, launchV: 6 }),
  // 더블탭 (쌍권총) — 실제 판정은 투사체
  gunShot: def({ id: 'gunShot', startup: 3, active: 1, recovery: 8, damage: 4, reach: 0, radius: 0, effect: 'hitstun', hitstun: 8, push: 1 }),
  gunRoll: def({ id: 'gunRoll', startup: 4, active: 20, recovery: 10, damage: 4, reach: 0, radius: 0, effect: 'hitstun', hitstun: 8, push: 1, moveSpeed: -9, moveUntil: 'active' }),
} as const;

export type MoveId = keyof typeof MOVES;
export const MOVE_IDS = Object.keys(MOVES) as MoveId[];

/** 투사체를 쏘는 동작 — 판정은 투사체가 한다 */
export interface ProjectileSpec { speed: number; range: number; radius: number; fanCount: number; fanDeg: number; every: number }
export const PROJECTILE_MOVES: Partial<Record<MoveId, ProjectileSpec>> = {
  gunShot: { speed: 22, range: 14, radius: 0.3, fanCount: 1, fanDeg: 0, every: 0 },
  gunRoll: { speed: 22, range: 12, radius: 0.3, fanCount: 6, fanDeg: 60, every: 0 },
  rocketPunch: { speed: 14, range: 10, radius: 0.5, fanCount: 1, fanDeg: 0, every: 0 },
};

export const totalTicks = (m: MoveDef) => m.startup + m.active + m.recovery;
/** 콤보 캔슬 창: 지속 끝 + 후딜 절반부터 다음 타로 넘어간다 */
export const chainTick = (m: MoveDef) => m.startup + m.active + Math.ceil(m.recovery / 2);
export const isActiveAt = (m: MoveDef, t: number) => t >= m.startup && t < m.startup + m.active;
