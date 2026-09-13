// 방 규칙 (2026-09-13 소감): 아이템전/노템전 · 악세전/맨손전 · 스탯 적용/없음.
// **방장이 정하면 그 판 전원에게 강제된다** — 특히 스탯은 오래 한 사람이 더 세지는 것을 끄는 스위치라
// 게스트가 대기실에서 뭘 골랐든 명단 단계에서 잘려야 한다.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import { buildRoster } from '../../client/src/net/roster.ts';
import type { Pick, RoomSettings } from '../src/protocol.ts';

const rules = (o: Partial<RoomSettings> = {}): RoomSettings => ({ map: 'colosseum', mode: 'ffa_dm', seconds: 180, fillBots: true, ...o });
const pick = (o: Partial<Pick> = {}): Pick => ({ name: '나', acc: 'greatsword', style: 'heavy', team: -1, stats: { hp: 2, atk: 2 }, ...o });
const seats = [{ name: '나', pick: pick() }, null, null, null, null, null, null, null];

describe('방 규칙', () => {
  it('노템전이면 상자·드럼통이 아예 안 놓인다', () => {
    const on = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 3 });
    expect(on.items.length).toBeGreaterThan(0);
    const off = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 3, items: false });
    expect(off.items).toHaveLength(0);
  });

  it('노템전은 판이 흘러도 상자가 다시 생기지 않는다', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 3, items: false });
    w.addPlayer(0, 'A', 0, 'none', false);
    for (let i = 0; i < 60 * 40; i++) w.step([]);
    expect(w.items).toHaveLength(0);
  });

  it('맨손전이면 사람도 봇도 악세서리를 못 든다', () => {
    const { roster } = buildRoster([0], seats, rules({ accs: false }), 9);
    expect(roster.every((r) => r.acc === 'none')).toBe(true);
    expect(roster.filter((r) => r.bot).length).toBeGreaterThan(0); // 봇도 검사에 포함됐다
  });

  it('악세전이면 고른 것이 그대로 간다', () => {
    const { roster } = buildRoster([0], seats, rules({ accs: true }), 9);
    expect(roster.find((r) => r.id === 0)!.acc).toBe('greatsword');
  });

  it('스탯 없음이면 진행으로 올린 스탯이 명단에서 빠진다', () => {
    const { roster } = buildRoster([0], seats, rules({ stats: false }), 9);
    expect(roster.find((r) => r.id === 0)!.stats).toBeUndefined();
  });

  it('스탯 적용이면 올린 스탯이 실린다', () => {
    const { roster } = buildRoster([0], seats, rules({ stats: true }), 9);
    expect(roster.find((r) => r.id === 0)!.stats).toEqual({ hp: 2, atk: 2 });
  });

  it('규칙을 안 적으면 셋 다 켜진 것으로 친다 — 옛 방 설정이 그대로 돈다', () => {
    const { roster } = buildRoster([0], seats, rules(), 9);
    const me = roster.find((r) => r.id === 0)!;
    expect(me.acc).toBe('greatsword');
    expect(me.stats).toEqual({ hp: 2, atk: 2 });
    expect(new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 3 }).items.length).toBeGreaterThan(0);
  });

  it('스탯 없음은 실제로 능력치를 기본값으로 만든다 — 명단만이 아니라 월드에서', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 3 });
    const { roster } = buildRoster([0], seats, rules({ stats: false }), 9);
    const me = roster.find((r) => r.id === 0)!;
    const p = w.addPlayer(me.id, me.name, 0, me.acc, false, me.style, me.stats);
    const plain = w.addPlayer(1, '기본', 0, 'none', false, 'heavy');
    expect(p.maxHp).toBe(plain.maxHp); // 체력 스탯을 올려 두었어도 같다
  });
});
