// 프레임 데이터 — 기획서 §6.2·§7 의 표. 60틱 기준.
// 2026-09-11 플레이 소감 반영: 근접 리치 +0.25m, 다음 타는 후딜이 끝나야 나간다(연타 속도 ↓).
// 2026-09-11 2차 소감(공격이 너무 빠르다): 발동 ×1.2 · 후딜 ×1.25 (잡기·던지기 제외). 기획서 §6.2 표와 같다.
// 2026-09-12 3차 소감(맞는 쪽이 대응 못 한다): 경직은 원래 값으로 — 경직 < 후딜 + 다음 발동 이라 연타 사이에 가드·대시가 들어간다.
//   약공(Z)·강공(X) 두 사슬. 약공 사슬 중 강공을 누르면 강공 사슬의 마지막 타(피니시)로 이어진다. 가드로 막은 직후 공격 키 = 반격기(counter).
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
  multiHit: number;     // 지속 중 이 틱 간격으로 같은 상대를 다시 때린다 (0 = 1회)
  superArmor: boolean;  // 발동~지속 중 경타에 경직되지 않는다 (데미지는 받는다)
}

const base: Omit<MoveDef, 'id' | 'startup' | 'active' | 'recovery' | 'damage' | 'reach' | 'radius' | 'effect'> = {
  hitstun: 10, push: 1.5, launchH: 6, launchV: 7, arcDeg: 110, moveSpeed: 0, moveUntil: 'none', pierce: false, guardBreak: false, activeUntilLand: false, multiHit: 0, superArmor: false,
};
const def = (m: Partial<MoveDef> & Pick<MoveDef, 'id' | 'startup' | 'active' | 'recovery' | 'damage' | 'reach' | 'radius' | 'effect'>): MoveDef => ({ ...base, ...m });

export const MOVES = {
  // 파이터 (맨손 기본)
  jab: def({ id: 'jab', startup: 6, active: 3, recovery: 13, damage: 6, reach: 1.35, radius: 0.55, effect: 'hitstun', hitstun: 14, push: 1.5 }),
  straight: def({ id: 'straight', startup: 7, active: 3, recovery: 15, damage: 7, reach: 1.45, radius: 0.55, effect: 'hitstun', hitstun: 16, push: 2 }),
  roundhouse: def({ id: 'roundhouse', startup: 12, active: 5, recovery: 23, damage: 11, reach: 1.55, radius: 0.7, effect: 'launch', launchH: 6, launchV: 7 }),
  tackle: def({ id: 'tackle', startup: 10, active: 8, recovery: 20, damage: 8, reach: 1.2, radius: 0.6, effect: 'launch', launchH: 5, launchV: 5, moveSpeed: 6, moveUntil: 'active' }),
  divekick: def({ id: 'divekick', startup: 7, active: 0, recovery: 15, damage: 9, reach: 1.0, radius: 0.6, effect: 'launch', launchH: 4, launchV: 5, activeUntilLand: true }),
  uppercut: def({ id: 'uppercut', startup: 17, active: 4, recovery: 28, damage: 14, reach: 1.25, radius: 0.7, effect: 'launch', launchH: 2, launchV: 9 }),
  grab: def({ id: 'grab', startup: 4, active: 2, recovery: 12, damage: 0, reach: 0, radius: 0, effect: 'hitstun' }),
  // 그래플러
  hook: def({ id: 'hook', startup: 8, active: 3, recovery: 18, damage: 8, reach: 1.35, radius: 0.6, effect: 'hitstun', hitstun: 18, push: 2 }),
  bodySlam: def({ id: 'bodySlam', startup: 14, active: 5, recovery: 25, damage: 12, reach: 1.4, radius: 0.75, effect: 'launch', launchH: 5, launchV: 8, superArmor: true }),
  dashGrab: def({ id: 'dashGrab', startup: 4, active: 22, recovery: 14, damage: 0, reach: 0, radius: 0, effect: 'hitstun', moveSpeed: 9, moveUntil: 'active' }),
  // 스피드스타
  quick1: def({ id: 'quick1', startup: 4, active: 2, recovery: 9, damage: 4, reach: 1.3, radius: 0.5, effect: 'hitstun', hitstun: 12, push: 1 }),
  quick2: def({ id: 'quick2', startup: 4, active: 2, recovery: 9, damage: 4, reach: 1.3, radius: 0.5, effect: 'hitstun', hitstun: 12, push: 1 }),
  quick3: def({ id: 'quick3', startup: 5, active: 2, recovery: 10, damage: 6, reach: 1.35, radius: 0.5, effect: 'hitstun', hitstun: 14, push: 1.5 }),
  quick4: def({ id: 'quick4', startup: 8, active: 4, recovery: 20, damage: 8, reach: 1.5, radius: 0.65, effect: 'launch', launchH: 6, launchV: 6 }),
  spinKick: def({ id: 'spinKick', startup: 10, active: 18, recovery: 18, damage: 4, reach: 0.6, radius: 1.3, effect: 'hitstun', hitstun: 10, push: 2, arcDeg: 360, multiHit: 6 }),
  // 헤비
  heavy1: def({ id: 'heavy1', startup: 13, active: 4, recovery: 23, damage: 12, reach: 1.45, radius: 0.7, effect: 'hitstun', hitstun: 20, push: 3, superArmor: true }),
  heavy2: def({ id: 'heavy2', startup: 17, active: 5, recovery: 30, damage: 16, reach: 1.5, radius: 0.8, effect: 'launch', launchH: 7, launchV: 7, superArmor: true }),
  quake: def({ id: 'quake', startup: 24, active: 4, recovery: 33, damage: 18, reach: 0.5, radius: 2.6, effect: 'launch', launchH: 5, launchV: 8, arcDeg: 360, pierce: true, superArmor: true }),
  // 마셜 (발차기)
  kick1: def({ id: 'kick1', startup: 7, active: 3, recovery: 14, damage: 6, reach: 1.6, radius: 0.55, effect: 'hitstun', hitstun: 14, push: 2 }),
  kick2: def({ id: 'kick2', startup: 8, active: 3, recovery: 15, damage: 7, reach: 1.7, radius: 0.55, effect: 'hitstun', hitstun: 16, push: 2.5 }),
  kick3: def({ id: 'kick3', startup: 13, active: 5, recovery: 25, damage: 12, reach: 1.8, radius: 0.7, effect: 'launch', launchH: 7, launchV: 6 }),
  flyingKick: def({ id: 'flyingKick', startup: 7, active: 16, recovery: 18, damage: 12, reach: 1.3, radius: 0.7, effect: 'launch', launchH: 6, launchV: 6, moveSpeed: 9, moveUntil: 'active' }),
  // 브레이커 (대검)
  gs1: def({ id: 'gs1', startup: 11, active: 4, recovery: 18, damage: 10, reach: 1.85, radius: 0.8, effect: 'hitstun', hitstun: 20, push: 3, arcDeg: 120 }),
  gs2: def({ id: 'gs2', startup: 14, active: 5, recovery: 28, damage: 14, reach: 1.85, radius: 0.8, effect: 'launch', launchH: 6, launchV: 7, arcDeg: 120 }),
  gsSlam: def({ id: 'gsSlam', startup: 26, active: 4, recovery: 33, damage: 20, reach: 0.6, radius: 2.5, effect: 'launch', launchH: 5, launchV: 8, arcDeg: 360, pierce: true }),
  // 스파이크 (장창)
  sp1: def({ id: 'sp1', startup: 7, active: 3, recovery: 13, damage: 7, reach: 2.15, radius: 0.45, effect: 'hitstun', hitstun: 14, push: 2, arcDeg: 60 }),
  sp2: def({ id: 'sp2', startup: 7, active: 3, recovery: 13, damage: 7, reach: 2.15, radius: 0.45, effect: 'hitstun', hitstun: 16, push: 2, arcDeg: 60 }),
  sp3: def({ id: 'sp3', startup: 11, active: 4, recovery: 20, damage: 13, reach: 2.25, radius: 0.5, effect: 'launch', launchH: 6, launchV: 6, arcDeg: 60 }),
  spCharge: def({ id: 'spCharge', startup: 7, active: 30, recovery: 23, damage: 14, reach: 1.8, radius: 0.6, effect: 'launch', launchH: 6, launchV: 6, arcDeg: 40, moveSpeed: 12, moveUntil: 'active', pierce: true }),
  // 월 (방패)
  shieldBash: def({ id: 'shieldBash', startup: 8, active: 3, recovery: 15, damage: 9, reach: 1.25, radius: 0.6, effect: 'hitstun', hitstun: 16, push: 3 }),
  shieldCharge: def({ id: 'shieldCharge', startup: 7, active: 38, recovery: 20, damage: 12, reach: 1.1, radius: 0.6, effect: 'launch', launchH: 6, launchV: 5, moveSpeed: 8, moveUntil: 'active' }),
  // 부스터 (로켓 글러브)
  rk1: def({ id: 'rk1', startup: 6, active: 3, recovery: 13, damage: 6, reach: 1.75, radius: 0.55, effect: 'hitstun', hitstun: 14, push: 1.5 }),
  rk2: def({ id: 'rk2', startup: 7, active: 3, recovery: 15, damage: 6, reach: 1.85, radius: 0.55, effect: 'hitstun', hitstun: 16, push: 2 }),
  rk3: def({ id: 'rk3', startup: 12, active: 5, recovery: 23, damage: 11, reach: 1.95, radius: 0.7, effect: 'launch', launchH: 6, launchV: 7 }),
  rocketPunch: def({ id: 'rocketPunch', startup: 10, active: 1, recovery: 18, damage: 16, reach: 0, radius: 0, effect: 'launch', launchH: 6, launchV: 6 }),
  // ── 3차 소감: 약공·강공 사슬용 추가 동작 ──
  haymaker: def({ id: 'haymaker', startup: 14, active: 4, recovery: 26, damage: 15, reach: 1.5, radius: 0.7, effect: 'launch', launchH: 7, launchV: 7 }),
  hook2: def({ id: 'hook2', startup: 8, active: 3, recovery: 16, damage: 8, reach: 1.35, radius: 0.6, effect: 'hitstun', hitstun: 18, push: 2 }),
  headbutt: def({ id: 'headbutt', startup: 9, active: 3, recovery: 18, damage: 10, reach: 1.0, radius: 0.6, effect: 'hitstun', hitstun: 20, push: 3 }),
  lariat: def({ id: 'lariat', startup: 13, active: 5, recovery: 24, damage: 14, reach: 1.4, radius: 0.8, effect: 'launch', launchH: 7, launchV: 6, arcDeg: 160 }),
  axeKick: def({ id: 'axeKick', startup: 15, active: 4, recovery: 26, damage: 13, reach: 1.5, radius: 0.65, effect: 'launch', launchH: 3, launchV: 9 }),
  hammer1: def({ id: 'hammer1', startup: 9, active: 4, recovery: 18, damage: 9, reach: 1.4, radius: 0.7, effect: 'hitstun', hitstun: 18, push: 2.5 }),
  hammer2: def({ id: 'hammer2', startup: 10, active: 4, recovery: 20, damage: 10, reach: 1.45, radius: 0.7, effect: 'hitstun', hitstun: 20, push: 3 }),
  kneeStrike: def({ id: 'kneeStrike', startup: 8, active: 3, recovery: 16, damage: 8, reach: 1.2, radius: 0.55, effect: 'hitstun', hitstun: 16, push: 2 }),
  gsSweep: def({ id: 'gsSweep', startup: 10, active: 4, recovery: 18, damage: 10, reach: 1.85, radius: 0.8, effect: 'hitstun', hitstun: 20, push: 3, arcDeg: 150 }),
  gsOverhead: def({ id: 'gsOverhead', startup: 16, active: 5, recovery: 30, damage: 17, reach: 1.9, radius: 0.9, effect: 'launch', launchH: 5, launchV: 9, arcDeg: 90 }),
  spSweep: def({ id: 'spSweep', startup: 12, active: 5, recovery: 24, damage: 13, reach: 1.9, radius: 0.8, effect: 'launch', launchH: 7, launchV: 6, arcDeg: 170 }),
  gunBurst: def({ id: 'gunBurst', startup: 5, active: 1, recovery: 20, damage: 3, reach: 0, radius: 0, effect: 'hitstun', hitstun: 8, push: 1 }),
  shieldJab: def({ id: 'shieldJab', startup: 6, active: 3, recovery: 12, damage: 7, reach: 1.2, radius: 0.55, effect: 'hitstun', hitstun: 14, push: 2 }),
  shieldSlam: def({ id: 'shieldSlam', startup: 13, active: 4, recovery: 24, damage: 14, reach: 1.3, radius: 0.7, effect: 'launch', launchH: 7, launchV: 6 }),
  rkHeavy: def({ id: 'rkHeavy', startup: 14, active: 5, recovery: 26, damage: 14, reach: 2.0, radius: 0.7, effect: 'launch', launchH: 7, launchV: 7 }),
  // 반격기: 가드로 막은 직후 15틱 안에 공격 키 — 빠르고 띄운다 (모든 직업 공통)
  counter: def({ id: 'counter', startup: 4, active: 3, recovery: 16, damage: 8, reach: 1.3, radius: 0.65, effect: 'launch', launchH: 6, launchV: 6 }),
  // 아이템 던지기 (판정 없음 — 아이템이 한다)
  itemThrow: def({ id: 'itemThrow', startup: 6, active: 0, recovery: 12, damage: 0, reach: 0, radius: 0, effect: 'hitstun' }),
  // 더블탭 (쌍권총) — 실제 판정은 투사체
  gunShot: def({ id: 'gunShot', startup: 4, active: 1, recovery: 12, damage: 3, reach: 0, radius: 0, effect: 'hitstun', hitstun: 8, push: 1 }),
  gunRoll: def({ id: 'gunRoll', startup: 5, active: 20, recovery: 13, damage: 4, reach: 0, radius: 0, effect: 'hitstun', hitstun: 8, push: 1, moveSpeed: -9, moveUntil: 'active' }),
  // 공중 약공 (2026-09-13): 점프 궤적을 유지한 채 지르는 발차기. 급강하(divekick)와 달리 아래로 끌어내리지 않는다 —
  // 공중 체공 약 0.9초에 총 20틱이라 한 번 뛰어 최대 두 번. 모든 직업·악세서리 공통(급강하와 같은 결).
  airAttack: def({ id: 'airAttack', startup: 5, active: 3, recovery: 12, damage: 7, reach: 1.45, radius: 0.6, effect: 'hitstun', hitstun: 14, push: 2 }),
} as const;

export type MoveId = keyof typeof MOVES;
export const MOVE_IDS = Object.keys(MOVES) as MoveId[];

/** 투사체를 쏘는 동작 — 판정은 투사체가 한다 */
export interface ProjectileSpec { speed: number; range: number; radius: number; fanCount: number; fanDeg: number; every: number }
export const PROJECTILE_MOVES: Partial<Record<MoveId, ProjectileSpec>> = {
  gunShot: { speed: 22, range: 14, radius: 0.3, fanCount: 1, fanDeg: 0, every: 0 },
  gunBurst: { speed: 22, range: 13, radius: 0.3, fanCount: 3, fanDeg: 14, every: 0 },
  gunRoll: { speed: 22, range: 12, radius: 0.3, fanCount: 6, fanDeg: 60, every: 0 },
  rocketPunch: { speed: 14, range: 10, radius: 0.5, fanCount: 1, fanDeg: 0, every: 0 },
};

/** 잡기로 이어지는 동작 — 지속 중 상대가 닿으면 잡는다 */
export const GRAB_MOVES: Partial<Record<MoveId, true>> = { grab: true, dashGrab: true };

/** 오브젝트가 주는 피해 — 플레이어 동작이 아니라 아이템 판정에 쓴다 */
export const CRATE_HIT: MoveDef = def({ id: 'jab', startup: 0, active: 0, recovery: 0, damage: 8, reach: 0, radius: 0, effect: 'launch', launchH: 5, launchV: 6 });
export const BOMB_HIT: MoveDef = def({ id: 'jab', startup: 0, active: 0, recovery: 0, damage: 20, reach: 0, radius: 0, effect: 'launch', launchH: 6, launchV: 8, guardBreak: true });
export const BARREL_HIT: MoveDef = def({ id: 'jab', startup: 0, active: 0, recovery: 0, damage: 25, reach: 0, radius: 0, effect: 'launch', launchH: 7, launchV: 9, guardBreak: true });

export const totalTicks = (m: MoveDef) => m.startup + m.active + m.recovery;
/** 다음 타로 넘어가는 시점 — 후딜이 끝나야 한다 (연타 속도는 후딜이 정한다) */
export const chainTick = (m: MoveDef) => m.startup + m.active + m.recovery;
export const isActiveAt = (m: MoveDef, t: number) => t >= m.startup && t < m.startup + m.active;
