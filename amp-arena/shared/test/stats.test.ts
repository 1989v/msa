// 스탯 배분이 명단을 타고 시뮬에 들어간다 (2026-09-12 진행). 방장은 클라이언트가 보낸 값을 sanitizeStatDelta 로 다시 검사한다.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { sanitizeStatDelta, applyStatDelta, statsForStyle, MAX_STAT_ALLOC, MAX_STAT_POINTS } from '../src/index.ts';

describe('sanitizeStatDelta', () => {
  it('정수 0~5, 총합 29 를 넘는 것은 뒤 스탯부터 깎는다, 이상한 값은 0', () => {
    expect(sanitizeStatDelta({ hp: 2, atk: 9, def: -1, jmp: 1.7, spd: 'x', tec: 3 })).toEqual({ hp: 2, atk: MAX_STAT_ALLOC, jmp: 2, tec: 3 });
    expect(sanitizeStatDelta(null)).toEqual({});
    expect(sanitizeStatDelta({ hp: 5, atk: 5, def: 5, jmp: 5, spd: 5, tec: 5, extra: 5 })).toEqual({ hp: 5, atk: 5, def: 5, jmp: 5, spd: 5, tec: 4 }); // 30 → 29
    expect(Object.values(sanitizeStatDelta({ hp: 5, atk: 5, def: 5, jmp: 5, spd: 5, tec: 5 })).reduce((a, b) => a + b, 0)).toBe(MAX_STAT_POINTS);
  });
  it('applyStatDelta 는 직업 기본치 위에 더한다', () => {
    const base = statsForStyle('heavy'); // hp 5
    expect(applyStatDelta(base, { hp: 2, spd: 1 })).toEqual({ ...base, hp: 7, spd: base.spd + 1 });
  });
});

describe('World.addPlayer 스탯 배분', () => {
  it('체력 +2 면 최대 체력이 20 오르고, 배분이 없으면 전과 같다', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 60, seed: 1 });
    const a = w.addPlayer(0, 'A', 0, 'none', false, 'fighter', { hp: 2, atk: 1 });
    const b = w.addPlayer(1, 'B', 0, 'none', false, 'fighter');
    expect(a.maxHp).toBe(C.hpFromStat(3 + 2));
    expect(a.stats.atk).toBe(4);
    expect(b.maxHp).toBe(C.hpFromStat(3));
  });
  it('클라이언트가 보낸 과한 값은 상한으로 잘린다', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 60, seed: 1 });
    const a = w.addPlayer(0, 'A', 0, 'none', false, 'fighter', { hp: 99 } as never);
    expect(a.stats.hp).toBe(3 + MAX_STAT_ALLOC);
  });
});
