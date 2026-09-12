// 아이템·오브젝트 — 기획서 §8. 상자(파괴·들기·던지기) · 하트(회복) · 폭탄(줍고 3초 뒤 폭발) · 드럼통(맞거나 던져지면 터진다).
import type { AccessoryId } from './accessories.ts';

export type ItemKind = 'crate' | 'heart' | 'bomb' | 'barrel' | 'acc';
export const ITEM_KINDS: ItemKind[] = ['crate', 'heart', 'bomb', 'barrel', 'acc']; // 스냅샷이 인덱스를 싣는다 — 뒤에만 붙인다

export interface Item {
  id: number;
  kind: ItemKind;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  hp: number;          // 상자·드럼통 내구도. 0 이하 = 없어진 것 (stepItems 가 마지막에 걸러 낸다)
  heldBy: number;      // 든 플레이어 id, 없으면 -1
  fuse: number;        // 폭탄: 남은 틱, 비활성 -1
  airborne: boolean;   // 던져져/떨어지는 중
  thrownBy: number;    // 던진 플레이어 (착지 시 파괴·피해 주체)
  spot: number;        // 상자·드럼통 자리 번호 (재생성용), 드랍은 -1
  lastHitBy: number;
  lastHitTick: number;
  acc: AccessoryId;    // 'acc'(떨어진 악세서리)만 쓴다 — KO 된 사람이 들고 있던 것. 나머지는 'none'
}

export const CRATE_HP = 10;            // 잽 2방
// 드럼통 (2026-09-12 「건물 내부·오브젝트」): 잽 3방 또는 던져서 터뜨린다. 폭탄보다 세고 옆 드럼통을 연쇄로 터뜨린다.
export const BARREL_HP = 15;
export const BARREL_RADIUS = 3.0;
export const BARREL_DAMAGE = 25;
export const BARREL_RESPAWN_TICKS = 2700; // 45초
export const BARREL_PUSH_SPEED = 2.4;     // 걸어서 밀면 이 속도로 미끄러진다 (m/s)
export const BARREL_FRICTION = 0.9;       // 틱마다 속도에 곱한다 — 약 0.7초 안에 선다
// 떨어진 악세서리 (2026-09-12 「KO 시 악세서리 드랍」): KO 된 사람이 들고 있던 것이 그 자리에 떨어지고, 25초 안에 줍지 않으면 사라진다
export const ACC_DESPAWN_TICKS = 1500;
export const CRATE_RESPAWN_TICKS = 1800; // 30초
export const CRATE_THROW_DAMAGE = 8;
export const CRATE_BREAK_RADIUS = 1.3;
export const BOMB_FUSE_TICKS = 180;    // 3초
export const BOMB_RADIUS = 3.2;      // 2026-09-12 소감: 2.5 는 좁아 보였다
export const BOMB_DAMAGE = 20;
export const HEART_HEAL = 30;
export const PICKUP_RANGE = 1.3;
export const THROW_ITEM_VEL_H = 9;
export const THROW_ITEM_VEL_V = 3.5;
export const DROP_HEART = 0.3;
export const DROP_BOMB = 0.2; // 하트 뒤 누적 0.5 까지

export function createItem(id: number, kind: ItemKind, x: number, y: number, z: number, spot = -1): Item {
  return { id, kind, x, y, z, vx: 0, vy: 0, vz: 0, hp: kind === 'crate' ? CRATE_HP : kind === 'barrel' ? BARREL_HP : 1, heldBy: -1, fuse: -1, airborne: false, thrownBy: -1, spot, lastHitBy: -1, lastHitTick: -1000, acc: 'none' };
}
