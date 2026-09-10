import type { MoveId } from './moves.ts';

export type AccessoryId = 'none' | 'greatsword' | 'spear' | 'pistols' | 'shield' | 'rocket';

export interface AccessoryDef {
  id: AccessoryId;
  name: string;
  combo: MoveId[];           // 기본 공격 사슬
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
  none:       { id: 'none', name: '맨손', combo: ['jab', 'straight', 'roundhouse'], special: 'uppercut', specialCooldownSec: 3, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  greatsword: { id: 'greatsword', name: '브레이커', combo: ['gs1', 'gs2'], special: 'gsSlam', specialCooldownSec: 6, speedMult: 0.9, canGrab: false, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  spear:      { id: 'spear', name: '스파이크', combo: ['sp1', 'sp2', 'sp3'], special: 'spCharge', specialCooldownSec: 5, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  pistols:    { id: 'pistols', name: '더블탭', combo: ['gunShot'], special: 'gunRoll', specialCooldownSec: 6, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: true, ammo: 12, reloadTicks: 90, airDashes: 0 },
  shield:     { id: 'shield', name: '월', combo: ['shieldBash'], special: 'shieldCharge', specialCooldownSec: 5, speedMult: 1, canGrab: true, guardAngleDeg: 150, guardCrushImmune: true, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 0 },
  rocket:     { id: 'rocket', name: '부스터', combo: ['rk1', 'rk2', 'rk3'], special: 'rocketPunch', specialCooldownSec: 5, speedMult: 1, canGrab: true, guardAngleDeg: 180, guardCrushImmune: false, ranged: false, ammo: 0, reloadTicks: 0, airDashes: 1 },
};

export const ACCESSORY_IDS: AccessoryId[] = ['none', 'greatsword', 'spear', 'pistols', 'shield', 'rocket'];
