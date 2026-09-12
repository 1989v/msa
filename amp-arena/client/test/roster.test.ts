// 매치 명단: 관전 좌석은 명단에서 빠지고, 빈 id 는 봇이 채우며, 팀전은 팀을 고르게 나눈다.
import { describe, it, expect } from 'vitest';
import { buildRoster } from '../src/net/roster.ts';
import { MAX_PLAYERS, type Pick, type RoomSettings } from '@amp/shared';

const pick = (o: Partial<Pick> = {}): Pick => ({ name: 'x', acc: 'none', style: 'fighter', team: -1, ...o });
const seat = (name: string, p: Partial<Pick> | null = {}) => ({ name, pick: p ? pick({ name, ...p }) : null });
const settings = (o: Partial<RoomSettings> = {}): RoomSettings => ({ map: 'colosseum', mode: 'ffa_dm', seconds: 120, fillBots: true, ...o });

describe('buildRoster', () => {
  it('관전 좌석은 명단에서 빠지고 spectators 에 남는다 — 그 좌석 번호에 봇이 들어가지 않는다', () => {
    const seats = [seat('알파'), seat('브라보', { spectate: true }), seat('찰리')];
    const { roster, spectators } = buildRoster([0, 1, 2], seats, settings(), 7);
    expect(spectators).toEqual([1]);
    expect(roster.some((r) => r.id === 1)).toBe(false);
    expect(roster.filter((r) => !r.bot).map((r) => r.id)).toEqual([0, 2]);
    expect(roster.length).toBe(MAX_PLAYERS - 1); // 8석 중 관전 1석은 비운다
    expect(roster.filter((r) => r.bot).length).toBe(MAX_PLAYERS - 3);
  });
  it('봇을 안 채우면 사람만 남는다', () => {
    const { roster } = buildRoster([0, 3], [seat('알파'), null, null, seat('델타')], settings({ fillBots: false }), 1);
    expect(roster.map((r) => r.id)).toEqual([0, 3]);
  });
  it('팀전은 고른 팀을 주고, 고른 사람이 없으면 적은 쪽으로 보낸다', () => {
    const seats = [seat('알파', { team: 1 }), seat('브라보', { team: 1 }), seat('찰리')];
    const { roster } = buildRoster([0, 1, 2], seats, settings({ mode: 'team_dm' }), 3);
    expect(roster.find((r) => r.id === 0)!.team).toBe(1);
    expect(roster.find((r) => r.id === 2)!.team).toBe(0);
    const t0 = roster.filter((r) => r.team === 0).length, t1 = roster.filter((r) => r.team === 1).length;
    expect(Math.abs(t0 - t1)).toBeLessThanOrEqual(1);
  });
  it('같은 시드면 봇 장비가 같다 (게스트도 cfg 로 같은 값을 받는다)', () => {
    const a = buildRoster([0], [seat('알파')], settings(), 99).roster.filter((r) => r.bot).map((r) => `${r.style}/${r.acc}`);
    const b = buildRoster([0], [seat('알파')], settings(), 99).roster.filter((r) => r.bot).map((r) => `${r.style}/${r.acc}`);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBeGreaterThan(1);
  });
});
