// 진행: 레벨 곡선·보상·스탯 분배 상한·상점·형태 맞추기. 저장·동기화는 E2E(tools/e2e-progress.mjs)가 본다.
import { describe, it, expect } from 'vitest';
import { levelFor, xpForLevel, levelProgress, matchRewards, applyMatch, allocate, buy, wear, sanitizeProgress, emptyProgress, statPoints, freePoints, SHOP, MAX_LEVEL } from '../src/platform/progress.ts';
import { MAX_STAT_ALLOC, type RankEntry } from '@amp/shared';

const me = (o: Partial<RankEntry> = {}): RankEntry => ({ id: 0, name: '가디', team: 0, kos: 2, deaths: 1, dmg: 130, alive: true, hp: 60, rank: 1, win: true, ...o });

describe('레벨', () => {
  it('Lv2 120 · Lv3 360 · Lv4 720, 상한 30', () => {
    expect(levelFor(0)).toBe(1); expect(levelFor(119)).toBe(1); expect(levelFor(120)).toBe(2); expect(levelFor(360)).toBe(3); expect(levelFor(719)).toBe(3); expect(levelFor(720)).toBe(4);
    expect(levelFor(1e9)).toBe(MAX_LEVEL);
    expect(xpForLevel(10)).toBe(5400);
    expect(levelProgress(500)).toEqual({ level: 3, cur: 140, need: 360 });
    expect(levelProgress(1e9).need).toBe(0);
  });
});

describe('보상', () => {
  it('경험치 = 점수(온라인 ×1.5), 골드 = 점수/10 + 승리 20 + 온라인 10', () => {
    expect(matchRewards(me(), false)).toEqual({ score: 380, xp: 380, gold: 58 });
    expect(matchRewards(me(), true)).toEqual({ score: 380, xp: 570, gold: 68 });
    expect(matchRewards(me({ win: false, kos: 0, dmg: 40 }), false)).toEqual({ score: 40, xp: 40, gold: 4 });
  });
  it('applyMatch 가 누적하고 레벨업을 알린다', () => {
    const r = applyMatch(emptyProgress(), me(), false);
    expect(r.from).toBe(1); expect(r.to).toBe(3); // 380 xp → Lv3
    expect(r.p.matches).toBe(1); expect(r.p.kos).toBe(2); expect(r.p.wins).toBe(1); expect(r.p.gold).toBe(58);
  });
});

describe('스탯 분배', () => {
  it('레벨 − 1 포인트, 스탯당 최대 5, 남은 포인트가 없으면 못 넣는다', () => {
    let p = { ...emptyProgress(), xp: xpForLevel(4) }; // Lv4 → 3 포인트
    expect(statPoints(p)).toBe(3);
    p = allocate(p, 'hp', 1)!; p = allocate(p, 'hp', 1)!; p = allocate(p, 'atk', 1)!;
    expect(freePoints(p)).toBe(0);
    expect(allocate(p, 'def', 1)).toBeNull();
    expect(allocate(p, 'hp', -1)!.alloc.hp).toBe(1);
    expect(allocate({ ...p, alloc: { hp: MAX_STAT_ALLOC }, xp: 1e9 }, 'hp', 1)).toBeNull();
    expect(allocate(p, 'atk', -1)!.alloc.atk).toBe(0);
    expect(allocate({ ...p, alloc: {} }, 'atk', -1)).toBeNull();
  });
});

describe('상점', () => {
  it('골드가 있어야 사고, 산 것만 입는다', () => {
    let p = { ...emptyProgress(), gold: 200 };
    const item = SHOP.find((s) => s.kind === 'shirt')!;
    expect(buy(p, 'hair:0').ok).toBe(false); // 250 필요
    const r = buy(p, item.id); expect(r.ok).toBe(true); p = r.p;
    expect(p.gold).toBe(50); expect(p.owned).toEqual([item.id]);
    expect(buy(p, item.id).ok).toBe(false); // 이미 있다
    expect(wear(p, 'shirt', item.idx)!.skin.shirt).toBe(item.idx);
    expect(wear(p, 'hair', 0)).toBeNull();
    expect(wear(p, 'shirt', -1)!.skin.shirt).toBe(-1);
  });
});

describe('sanitizeProgress', () => {
  it('깨진 값·초과 포인트·안 산 스킨을 걸러 낸다', () => {
    const p = sanitizeProgress({ xp: 500, gold: -5, alloc: { hp: 9, atk: 2, tec: 'x' }, owned: ['shirt:8', 'nope'], skin: { shirt: 9, hair: 2, band: -1 } });
    expect(p.gold).toBe(0);
    expect(p.owned).toEqual(['shirt:8']);
    expect(p.skin.hair).toBe(-1); // 안 샀다
    expect(p.skin.shirt).toBe(-1); // shirt:9 는 안 샀다
    expect(statPoints(p)).toBe(2); // Lv3
    expect((p.alloc.hp ?? 0) + (p.alloc.atk ?? 0)).toBeLessThanOrEqual(2);
    expect(p.alloc.hp).toBeLessThanOrEqual(MAX_STAT_ALLOC);
    expect(sanitizeProgress(null)).toEqual(emptyProgress());
    expect(sanitizeProgress({ skin: { shirt: 3 } }).skin.shirt).toBe(3); // 자리 색(0~7)은 무료
  });
});
