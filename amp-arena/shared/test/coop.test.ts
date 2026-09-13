// 협동 시나리오 (2026-09-13 소감 「친구와 한편으로 즐기는 봇 상대 시나리오」):
// 사람은 전부 레드, 봇은 전부 블루. 봇을 다 눕히면 더 센 물결이 오고, 정해진 물결을 막으면 사람 승.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import { MODES } from '../src/modes.ts';
import * as C from '../src/constants.ts';
import { buildRoster } from '../../client/src/net/roster.ts';
import type { RoomSettings } from '../src/protocol.ts';

function coopWorld(bots = 2) {
  const w = new World({ mapId: 'colosseum', modeId: 'coop', seconds: 600, seed: 5 });
  const me = w.addPlayer(0, '나', 0, 'none', false);
  const b: ReturnType<World['addPlayer']>[] = [];
  for (let i = 0; i < bots; i++) b.push(w.addPlayer(1 + i, `봇${i}`, 1, 'none', true));
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  return { w, me, b };
}
/** 그 사람을 완전히 눕힌다 (목숨을 다 쓸 때까지) */
function wipe(w: World, p: ReturnType<World['addPlayer']>) {
  for (let i = 0; i < 20 && p.alive; i++) { p.hp = 1; w.kill(p, 'hit', null); for (let t = 0; t < 200 && p.state === 'dead' && p.alive; t++) w.step([]); }
}

describe('협동 시나리오', () => {
  it('봇은 물결마다 목숨 하나, 사람은 시나리오 전체에 mode.lives', () => {
    const { me, b } = coopWorld(1);
    expect(b[0]!.lives).toBe(1);
    expect(me.lives).toBe(MODES.coop.lives);
  });

  it('봇을 다 눕히면 다음 물결이 오고 더 세진다 — 판은 안 끝난다', () => {
    const { w, b } = coopWorld(2);
    const hpBefore = b[0]!.maxHp;
    for (const x of b) wipe(w, x);
    w.step([]);
    expect(w.wave).toBe(2);
    expect(w.phase).toBe('play');          // 팀이 전멸해도 협동은 안 끝난다
    expect(b.every((x) => x!.alive)).toBe(true);
    expect(b[0]!.maxHp).toBeGreaterThan(hpBefore);
    expect(b[0]!.hp).toBe(b[0]!.maxHp);    // 꽉 채워 나온다
  });

  it('물결을 다 막으면 사람 승으로 끝난다', () => {
    const { w, b } = coopWorld(1);
    for (let round = 0; round < MODES.coop.waves!; round++) { wipe(w, b[0]!); w.step([]); }
    expect(w.phase).toBe('ended');
    expect(w.score[0]).toBeGreaterThan(w.score[1]);
    expect(w.ranking.find((r) => r.id === 0)!.win).toBe(true);
  });

  it('사람이 목숨을 다 쓰면 봇 승으로 끝난다', () => {
    const { w, me } = coopWorld(2);
    wipe(w, me);
    w.step([]);
    expect(w.phase).toBe('ended');
    expect(w.score[1]).toBeGreaterThan(w.score[0]);
    expect(w.ranking.find((r) => r.id === 0)!.win).toBe(false);
  });

  it('명단은 사람을 레드, 봇을 블루로 못 박는다 — 친구와 한편이 된다', () => {
    const seats = [{ name: 'A', pick: null }, { name: 'B', pick: null }, null, null, null, null, null, null];
    const settings: RoomSettings = { map: 'colosseum', mode: 'coop', seconds: 600, fillBots: true };
    const { roster } = buildRoster([0, 1], seats, settings, 3);
    expect(roster.filter((r) => !r.bot).every((r) => r.team === 0)).toBe(true);
    expect(roster.filter((r) => r.bot).every((r) => r.team === 1)).toBe(true);
    expect(roster.filter((r) => r.bot).length).toBe(6);
  });

  it('다른 모드는 물결이 없다 — 팀이 전멸하면 그대로 끝난다', () => {
    expect(MODES.team_dm.waves).toBeUndefined();
    expect(MODES.ffa_dm.waves).toBeUndefined();
  });
});
