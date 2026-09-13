// 스타일(직업) — 맨손 기본 공격·기술·스탯·움직임·외형이 갈린다. 악세서리를 들면 공격은 악세서리 것이 되고 패시브는 남는다.
import type { MoveId } from './moves.ts';
import type { AccessoryId } from './accessories.ts';
import type { Stats } from './player.ts';

export type StyleId = 'fighter' | 'grappler' | 'speedster' | 'heavy' | 'martial';
export type HairKind = 'spiky' | 'buzz' | 'pony' | 'flat' | 'mohawk';

export interface StyleLook { hair: HairKind; hairColor: string; torso: number; head: number }

export interface StyleDef {
  id: StyleId;
  name: string;
  desc: string;
  combo: MoveId[];            // 맨손 약공(Z) 사슬
  heavy: MoveId[];            // 맨손 강공(X) 사슬 — 마지막 타가 피니시
  special: MoveId;            // 맨손일 때 V
  specialCooldownSec: number;
  stats: Partial<Stats>;      // 기본 3 에서의 증감
  speedMult: number;
  grabRange: number;          // 잡기 성립 중심 거리
  throwDamage: number;
  airDashes: number;
  // 이 직업이 들 수 있는 악세서리 — **[맨손, 전용 하나] 딱 둘**이다 (2026-09-13 소감: 직업과 무관한 무기가 섞여 보였다).
  // 무기 하나가 직업 하나에만 붙어야 「그 직업의 무기」로 읽히고, KO 드랍도 아무나 주워 가지 않는다.
  // 게이트는 shared/test/accexclusive.test.ts. 여기 배열을 늘리면 그 검사가 먼저 막는다.
  accessories: AccessoryId[];
  look: StyleLook;
}

export const STYLES: Record<StyleId, StyleDef> = {
  fighter: {
    id: 'fighter', name: '파이터', desc: '약공 잽·스트레이트·로킥, 강공 돌려차기·헤이메이커. V 어퍼컷. 고르게 균형 잡힌 기본형.',
    combo: ['jab', 'straight', 'kick1'], heavy: ['roundhouse', 'haymaker'], special: 'uppercut', specialCooldownSec: 3,
    stats: {}, speedMult: 1, grabRange: 1.0, throwDamage: 15, airDashes: 0,
    accessories: ['none', 'rocket'],
    look: { hair: 'spiky', hairColor: '#2b2f4a', torso: 1, head: 1 },
  },
  grappler: {
    id: 'grappler', name: '그래플러', desc: '약공 훅·훅·박치기, 강공 바디슬램(슈퍼아머)·래리어트. V 대시 잡기. 잡기 범위 1.3m·던지기 22.',
    combo: ['hook', 'hook2', 'headbutt'], heavy: ['bodySlam', 'lariat'], special: 'dashGrab', specialCooldownSec: 5,
    stats: { hp: 1, def: 1, spd: -1 }, speedMult: 0.95, grabRange: 1.3, throwDamage: 22, airDashes: 0,
    accessories: ['none', 'shield'],
    look: { hair: 'buzz', hairColor: '#5a3a22', torso: 1.14, head: 1.02 },
  },
  speedster: {
    id: 'speedster', name: '스피드스타', desc: '약공 3단 속공, 강공 발차기·도끼차기. V 회전 발차기(다단). 이동 +15%, 공중 대시 1회. 방어 −1.',
    combo: ['quick1', 'quick2', 'quick3'], heavy: ['quick4', 'axeKick'], special: 'spinKick', specialCooldownSec: 4,
    stats: { spd: 2, jmp: 1, def: -1 }, speedMult: 1.15, grabRange: 1.0, throwDamage: 12, airDashes: 1,
    accessories: ['none', 'pistols'],
    look: { hair: 'pony', hairColor: '#e8c65a', torso: 0.92, head: 0.98 },
  },
  heavy: {
    id: 'heavy', name: '헤비', desc: '약공 해머 2단, 강공 강타 2단(슈퍼아머). V 지진(반지름 2.6m 다운). 체력 +2·방어 +1, 이동 −10%.',
    combo: ['hammer1', 'hammer2'], heavy: ['heavy1', 'heavy2'], special: 'quake', specialCooldownSec: 7,
    stats: { hp: 2, def: 1, spd: -2 }, speedMult: 0.9, grabRange: 1.1, throwDamage: 18, airDashes: 0,
    accessories: ['none', 'greatsword'],
    look: { hair: 'flat', hairColor: '#3a3f55', torso: 1.22, head: 1.06 },
  },
  martial: {
    id: 'martial', name: '마셜', desc: '약공 발차기·발차기·무릎, 강공 상단차기·도끼차기(리치 1.6~1.8m). V 비연각. 점프 +2, 근력 +1.',
    combo: ['kick1', 'kick2', 'kneeStrike'], heavy: ['kick3', 'axeKick'], special: 'flyingKick', specialCooldownSec: 5,
    stats: { jmp: 2, atk: 1, hp: -1 }, speedMult: 1.05, grabRange: 1.0, throwDamage: 14, airDashes: 0,
    accessories: ['none', 'spear'],
    look: { hair: 'mohawk', hairColor: '#d8452e', torso: 0.98, head: 1 },
  },
};

export const STYLE_IDS: StyleId[] = ['fighter', 'grappler', 'speedster', 'heavy', 'martial'];

/**
 * 봇 장비: 직업을 무작위로 고르고 그 직업의 전용 악세서리를 3에 2 확률로 든다.
 * 균등하게 뽑으면 전용이 하나뿐이라 **절반이 맨손**이 되어 판에 무기가 잘 안 보인다
 * (전용 전환 전에는 선택지가 3~4개라 맨손이 3할이었다).
 */
export function randomLoadout(rng: () => number): { style: StyleId; acc: AccessoryId } {
  const style = STYLE_IDS[Math.min(STYLE_IDS.length - 1, Math.floor(rng() * STYLE_IDS.length))]!;
  const accs = STYLES[style].accessories;
  const acc = rng() < 2 / 3 ? accs[accs.length - 1]! : 'none';
  return { style, acc };
}

/** 직업이 들 수 없는 악세서리는 맨손으로 — 권위(월드)와 화면이 같은 규칙을 쓴다 */
export function allowedAccessory(style: StyleId, acc: AccessoryId): AccessoryId {
  return STYLES[style].accessories.includes(acc) ? acc : 'none';
}

export function statsForStyle(style: StyleId, base = 3): Stats {
  const d = STYLES[style].stats;
  const c = (k: keyof Stats) => Math.max(1, Math.min(5, base + (d[k] ?? 0)));
  return { hp: c('hp'), atk: c('atk'), def: c('def'), jmp: c('jmp'), spd: c('spd'), tec: c('tec') };
}
