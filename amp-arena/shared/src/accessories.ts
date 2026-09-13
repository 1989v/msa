import type { MoveId } from './moves.ts';

export type AccessoryId =
  | 'none'
  | 'greatsword' | 'spear' | 'pistols' | 'shield' | 'rocket'
  // 2026-09-13: 직업당 3종이 되도록 열 가지를 더했다 (아래 ACCESSORY_IDS 순서는 스냅샷 인덱스라 뒤에만 붙인다)
  | 'knuckle' | 'chain' | 'claw' | 'anchor' | 'dagger' | 'chakram' | 'hammer' | 'cannon' | 'staff' | 'nunchaku';

export interface AccessoryDef {
  id: AccessoryId;
  name: string;
  combo: MoveId[];           // 약공(Z) 사슬
  heavy: MoveId[];           // 강공(X) 사슬 — 마지막 타가 약공 사슬에서 이어지는 피니시
  special: MoveId;           // V 기술
  specialCooldownSec: number;
  speedMult: number;
  canGrab: boolean;
  guardAngleDeg: number;
  guardCrushImmune: boolean;
  ranged: boolean;
  ammo: number;              // 0 이면 탄창 없음
  reloadTicks: number;
  airDashes: number;
}

export const ACCESSORIES: Record<AccessoryId, AccessoryDef> = {
  none:       { id: 'none', name: '맨손', combo: ['jab', 'straight', 'roundhouse'], heavy: ['roundhouse', 'haymaker'], special: 'uppercut', specialCooldownSec: 3, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  greatsword: { id: 'greatsword', name: '브레이커', combo: ['gs1', 'gsSweep'], heavy: ['gs2', 'gsOverhead'], special: 'gsSlam', specialCooldownSec: 6, speedMult: 0.9, canGrab: false, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  spear:      { id: 'spear', name: '스파이크', combo: ['sp1', 'sp2'], heavy: ['sp3', 'spSweep'], special: 'spCharge', specialCooldownSec: 5, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  pistols:    { id: 'pistols', name: '더블탭', combo: ['gunShot'], heavy: ['gunBurst'], special: 'gunRoll', specialCooldownSec: 6, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: true, ammo: 12, reloadTicks: 90, airDashes: 0 },
  shield:     { id: 'shield', name: '월', combo: ['shieldBash', 'shieldJab'], heavy: ['shieldSlam'], special: 'shieldCharge', specialCooldownSec: 5, speedMult: 1, canGrab: true, guardAngleDeg: 150, guardCrushImmune: true, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  rocket:     { id: 'rocket', name: '부스터', combo: ['rk1', 'rk2'], heavy: ['rk3', 'rkHeavy'], special: 'rocketPunch', specialCooldownSec: 5, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 1 },
  // ── 직업당 3종 (2026-09-13). 같은 직업 안에서 **서로 다른 것을 하도록** 갈랐다:
  //    파이터 = 발사(부스터) / 압박(너클) / 범위(체인) · 그래플러 = 방어(월) / 끌어오기(클로) / 완력(앵커)
  //    스피드스타 = 원거리(더블탭) / 초고속(대거) / 관통 투척(차크람) · 헤비 = 대검 / 가드깨기(해머) / 포격(캐논)
  //    마셜 = 창 / 장봉(스태프) / 다단(넌척)
  knuckle:    { id: 'knuckle', name: '너클', combo: ['kn1', 'kn2'], heavy: ['knHook', 'knSmash'], special: 'knRush', specialCooldownSec: 4, speedMult: 1.05, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  chain:      { id: 'chain', name: '체인', combo: ['ch1', 'ch2'], heavy: ['ch3', 'chSpin'], special: 'chWhirl', specialCooldownSec: 6, speedMult: 0.95, canGrab: false, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  claw:       { id: 'claw', name: '클로', combo: ['cl1', 'cl2'], heavy: ['clRip', 'clRend'], special: 'clHook', specialCooldownSec: 5, speedMult: 1.05, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  anchor:     { id: 'anchor', name: '앵커', combo: ['an1', 'an2'], heavy: ['anCrush', 'anQuake'], special: 'anDrop', specialCooldownSec: 7, speedMult: 0.85, canGrab: false, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  dagger:     { id: 'dagger', name: '대거', combo: ['dg1', 'dg2', 'dg3'], heavy: ['dgFinish'], special: 'dgBlink', specialCooldownSec: 4, speedMult: 1.08, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 1 },
  chakram:    { id: 'chakram', name: '차크람', combo: ['ckThrow'], heavy: ['ckHeavy'], special: 'ckSpin', specialCooldownSec: 6, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: true, ammo: 7, reloadTicks: 90, airDashes: 0 },
  hammer:     { id: 'hammer', name: '해머', combo: ['hm1', 'hm2'], heavy: ['hmDrop', 'hmQuake'], special: 'hmShock', specialCooldownSec: 7, speedMult: 0.85, canGrab: false, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  cannon:     { id: 'cannon', name: '캐논', combo: ['cn1'], heavy: ['cnHeavy'], special: 'cnBarrage', specialCooldownSec: 8, speedMult: 0.9, canGrab: false, guardAngleDeg: 180, guardCrushImmune: false, ranged: true, ammo: 5, reloadTicks: 140, airDashes: 0 },
  staff:      { id: 'staff', name: '스태프', combo: ['st1', 'st2', 'st3'], heavy: ['stSweep'], special: 'stVault', specialCooldownSec: 5, speedMult: 1.02, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  nunchaku:   { id: 'nunchaku', name: '넌척', combo: ['nc1', 'nc2', 'nc3'], heavy: ['ncFinish'], special: 'ncStorm', specialCooldownSec: 5, speedMult: 1.05, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
};

// **뒤에만 붙인다** — 스냅샷이 이 배열의 인덱스로 악세서리를 싣는다 (snapshot.ts).
export const ACCESSORY_IDS: AccessoryId[] = [
  'none', 'greatsword', 'spear', 'pistols', 'shield', 'rocket',
  'knuckle', 'chain', 'claw', 'anchor', 'dagger', 'chakram', 'hammer', 'cannon', 'staff', 'nunchaku',
];
