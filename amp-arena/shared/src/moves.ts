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

  // ── 직업당 악세서리 3종 (2026-09-13 소감) — 아래는 전부 맨 뒤에 붙인 새 동작이다.
  //    **순서를 바꾸거나 중간에 끼워 넣지 않는다**: 스냅샷이 MOVE_IDS 의 인덱스를 싣는다.

  // 너클 (파이터) — 리치가 짧은 대신 제일 빠르다. 한 대는 가볍고 붙어서 쉬지 않고 때리는 무기.
  kn1: def({ id: 'kn1', startup: 5, active: 3, recovery: 11, damage: 5, reach: 1.25, radius: 0.5, effect: 'hitstun', hitstun: 13, push: 1.2 }),
  kn2: def({ id: 'kn2', startup: 5, active: 3, recovery: 12, damage: 6, reach: 1.3, radius: 0.5, effect: 'hitstun', hitstun: 15, push: 1.5 }),
  knHook: def({ id: 'knHook', startup: 9, active: 4, recovery: 17, damage: 9, reach: 1.35, radius: 0.6, effect: 'hitstun', hitstun: 18, push: 2.5 }),
  knSmash: def({ id: 'knSmash', startup: 13, active: 4, recovery: 24, damage: 13, reach: 1.4, radius: 0.65, effect: 'launch', launchH: 6, launchV: 7 }),
  knRush: def({ id: 'knRush', startup: 6, active: 24, recovery: 20, damage: 4, reach: 1.3, radius: 0.6, effect: 'hitstun', hitstun: 10, push: 1, multiHit: 5, moveSpeed: 4, moveUntil: 'active' }),

  // 체인 (파이터) — 사슬추. 제일 넓고 길게 훑지만 느리다. 여럿을 한 번에 건다.
  ch1: def({ id: 'ch1', startup: 9, active: 4, recovery: 16, damage: 7, reach: 2.0, radius: 0.75, effect: 'hitstun', hitstun: 16, push: 2, arcDeg: 150 }),
  ch2: def({ id: 'ch2', startup: 10, active: 4, recovery: 18, damage: 8, reach: 2.1, radius: 0.8, effect: 'hitstun', hitstun: 18, push: 2.5, arcDeg: 160 }),
  ch3: def({ id: 'ch3', startup: 13, active: 5, recovery: 22, damage: 11, reach: 2.15, radius: 0.85, effect: 'hitstun', hitstun: 20, push: 3, arcDeg: 170 }),
  chSpin: def({ id: 'chSpin', startup: 16, active: 6, recovery: 28, damage: 15, reach: 2.2, radius: 0.9, effect: 'launch', launchH: 7, launchV: 6, arcDeg: 360 }),
  chWhirl: def({ id: 'chWhirl', startup: 10, active: 30, recovery: 24, damage: 6, reach: 2.2, radius: 0.9, effect: 'hitstun', hitstun: 12, push: 2, arcDeg: 360, multiHit: 6, pierce: true }),

  // 클로 (그래플러) — 갈고리 손톱. 짧고 아주 빠르며, 기술로 멀리 있는 사람을 끌어온다(음수 push).
  cl1: def({ id: 'cl1', startup: 5, active: 2, recovery: 10, damage: 6, reach: 1.2, radius: 0.5, effect: 'hitstun', hitstun: 12, push: 1 }),
  cl2: def({ id: 'cl2', startup: 5, active: 2, recovery: 11, damage: 6, reach: 1.2, radius: 0.5, effect: 'hitstun', hitstun: 13, push: 1.2 }),
  clRip: def({ id: 'clRip', startup: 8, active: 3, recovery: 16, damage: 10, reach: 1.3, radius: 0.6, effect: 'hitstun', hitstun: 17, push: 2 }),
  clRend: def({ id: 'clRend', startup: 12, active: 4, recovery: 22, damage: 14, reach: 1.35, radius: 0.65, effect: 'launch', launchH: 5, launchV: 7 }),
  clHook: def({ id: 'clHook', startup: 8, active: 4, recovery: 22, damage: 8, reach: 3.4, radius: 0.5, effect: 'hitstun', hitstun: 26, push: -7, arcDeg: 50 }),

  // 앵커 (그래플러) — 닻. 제일 무겁고 느리다. 발동 내내 슈퍼아머라 맞으면서 휘두른다.
  an1: def({ id: 'an1', startup: 12, active: 5, recovery: 22, damage: 12, reach: 1.6, radius: 0.8, effect: 'hitstun', hitstun: 20, push: 3 }),
  an2: def({ id: 'an2', startup: 14, active: 5, recovery: 26, damage: 14, reach: 1.7, radius: 0.85, effect: 'hitstun', hitstun: 22, push: 3.5 }),
  anCrush: def({ id: 'anCrush', startup: 16, active: 5, recovery: 28, damage: 16, reach: 1.7, radius: 0.9, effect: 'launch', launchH: 5, launchV: 8, superArmor: true }),
  anQuake: def({ id: 'anQuake', startup: 20, active: 6, recovery: 34, damage: 17, reach: 2.0, radius: 1.1, effect: 'launch', launchH: 4, launchV: 9, arcDeg: 360, superArmor: true }),
  anDrop: def({ id: 'anDrop', startup: 14, active: 6, recovery: 26, damage: 18, reach: 1.8, radius: 1.0, effect: 'launch', launchH: 3, launchV: 10, arcDeg: 200, superArmor: true, guardBreak: true }),

  // 대거 (스피드스타) — 단검 두 자루. 4단까지 이어지는 제일 빠른 사슬, 한 대는 제일 약하다.
  dg1: def({ id: 'dg1', startup: 4, active: 2, recovery: 9, damage: 5, reach: 1.15, radius: 0.45, effect: 'hitstun', hitstun: 11, push: 1 }),
  dg2: def({ id: 'dg2', startup: 4, active: 2, recovery: 10, damage: 5, reach: 1.2, radius: 0.45, effect: 'hitstun', hitstun: 12, push: 1 }),
  dg3: def({ id: 'dg3', startup: 5, active: 2, recovery: 11, damage: 6, reach: 1.25, radius: 0.5, effect: 'hitstun', hitstun: 13, push: 1.5 }),
  dgFinish: def({ id: 'dgFinish', startup: 10, active: 3, recovery: 20, damage: 13, reach: 1.35, radius: 0.6, effect: 'launch', launchH: 6, launchV: 6 }),
  dgBlink: def({ id: 'dgBlink', startup: 5, active: 10, recovery: 18, damage: 14, reach: 1.2, radius: 0.6, effect: 'hitstun', hitstun: 20, push: 2, moveSpeed: 16, moveUntil: 'active', pierce: true }),

  // 차크람 (스피드스타) — 던지는 원반. 더블탭보다 느리고 무겁게 날아가지만 관통한다.
  ckThrow: def({ id: 'ckThrow', startup: 7, active: 1, recovery: 20, damage: 4, reach: 0, radius: 0, effect: 'hitstun', hitstun: 12, push: 1.5 }),
  ckHeavy: def({ id: 'ckHeavy', startup: 11, active: 1, recovery: 28, damage: 6, reach: 0, radius: 0, effect: 'hitstun', hitstun: 16, push: 2 }),
  ckSpin: def({ id: 'ckSpin', startup: 9, active: 1, recovery: 26, damage: 5, reach: 0, radius: 0, effect: 'hitstun', hitstun: 14, push: 2 }),

  // 해머 (헤비) — 대형 망치. 느리지만 가드를 부수고 크게 띄운다.
  hm1: def({ id: 'hm1', startup: 11, active: 5, recovery: 20, damage: 11, reach: 1.55, radius: 0.8, effect: 'hitstun', hitstun: 20, push: 3 }),
  hm2: def({ id: 'hm2', startup: 13, active: 5, recovery: 24, damage: 13, reach: 1.6, radius: 0.85, effect: 'hitstun', hitstun: 22, push: 3.5 }),
  hmDrop: def({ id: 'hmDrop', startup: 17, active: 5, recovery: 30, damage: 17, reach: 1.7, radius: 0.9, effect: 'launch', launchH: 5, launchV: 9, guardBreak: true }),
  hmQuake: def({ id: 'hmQuake', startup: 21, active: 6, recovery: 34, damage: 20, reach: 1.9, radius: 1.1, effect: 'launch', launchH: 6, launchV: 8, arcDeg: 200, guardBreak: true }),
  hmShock: def({ id: 'hmShock', startup: 15, active: 6, recovery: 30, damage: 16, reach: 2.6, radius: 1.2, effect: 'launch', launchH: 5, launchV: 8, arcDeg: 360, guardBreak: true }),

  // 캐논 (헤비) — 어깨포. 느리고 탄이 적지만 한 발이 반경으로 터진다.
  cn1: def({ id: 'cn1', startup: 12, active: 1, recovery: 32, damage: 8, reach: 0, radius: 0, effect: 'hitstun', hitstun: 18, push: 3 }),
  cnHeavy: def({ id: 'cnHeavy', startup: 18, active: 1, recovery: 40, damage: 12, reach: 0, radius: 0, effect: 'launch', launchH: 6, launchV: 7 }),
  cnBarrage: def({ id: 'cnBarrage', startup: 14, active: 1, recovery: 32, damage: 7, reach: 0, radius: 0, effect: 'hitstun', hitstun: 16, push: 2.5 }),

  // 스태프 (마셜) — 장봉. 리치가 길고 3단으로 이어지며 기술은 봉을 짚고 도는 발차기.
  st1: def({ id: 'st1', startup: 7, active: 3, recovery: 14, damage: 7, reach: 1.9, radius: 0.55, effect: 'hitstun', hitstun: 14, push: 1.5 }),
  st2: def({ id: 'st2', startup: 8, active: 3, recovery: 15, damage: 8, reach: 1.95, radius: 0.6, effect: 'hitstun', hitstun: 16, push: 2, arcDeg: 130 }),
  st3: def({ id: 'st3', startup: 9, active: 4, recovery: 17, damage: 9, reach: 2.0, radius: 0.6, effect: 'hitstun', hitstun: 18, push: 2 }),
  stSweep: def({ id: 'stSweep', startup: 13, active: 5, recovery: 24, damage: 15, reach: 2.05, radius: 0.8, effect: 'launch', launchH: 6, launchV: 7, arcDeg: 180 }),
  stVault: def({ id: 'stVault', startup: 10, active: 8, recovery: 22, damage: 14, reach: 1.9, radius: 0.8, effect: 'launch', launchH: 7, launchV: 7, arcDeg: 360, moveSpeed: 7, moveUntil: 'active' }),

  // 넌척 (마셜) — 쌍절곤. 다단으로 몰아치고 기술은 제자리 회전 연타.
  nc1: def({ id: 'nc1', startup: 5, active: 2, recovery: 11, damage: 6, reach: 1.35, radius: 0.5, effect: 'hitstun', hitstun: 12, push: 1.2 }),
  nc2: def({ id: 'nc2', startup: 6, active: 2, recovery: 12, damage: 6, reach: 1.4, radius: 0.55, effect: 'hitstun', hitstun: 13, push: 1.5 }),
  nc3: def({ id: 'nc3', startup: 7, active: 3, recovery: 14, damage: 8, reach: 1.45, radius: 0.55, effect: 'hitstun', hitstun: 15, push: 2 }),
  ncFinish: def({ id: 'ncFinish', startup: 12, active: 4, recovery: 22, damage: 14, reach: 1.5, radius: 0.65, effect: 'launch', launchH: 6, launchV: 7 }),
  ncStorm: def({ id: 'ncStorm', startup: 8, active: 26, recovery: 22, damage: 6, reach: 1.6, radius: 0.75, effect: 'hitstun', hitstun: 11, push: 1.5, arcDeg: 200, multiHit: 5 }),
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
  // 차크람: 더블탭보다 느리게 날지만 반경이 크다
  ckThrow: { speed: 17, range: 12, radius: 0.34, fanCount: 1, fanDeg: 0, every: 0 },
  ckHeavy: { speed: 17, range: 12, radius: 0.4, fanCount: 2, fanDeg: 12, every: 0 },
  ckSpin: { speed: 15, range: 10, radius: 0.38, fanCount: 5, fanDeg: 80, every: 0 },
  // 캐논: 제일 느리고 제일 큰 탄
  cn1: { speed: 13, range: 15, radius: 0.55, fanCount: 1, fanDeg: 0, every: 0 },
  cnHeavy: { speed: 12, range: 16, radius: 0.7, fanCount: 1, fanDeg: 0, every: 0 },
  cnBarrage: { speed: 13, range: 13, radius: 0.55, fanCount: 3, fanDeg: 22, every: 0 },
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
