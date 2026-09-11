// 스냅샷: 월드 단위 상태(w)까지 왕복해야 방장 승계가 같은 자리에서 이어진다. 소수 셋째 자리 반올림은 예측 오차 문턱 아래다.
import { describe, it, expect } from 'vitest';
import { World, encodeSnapshot, applySnapshot, botInput, newBotMemory, ACCESSORY_IDS, STYLE_IDS, MAX_PLAYERS, type Input } from '../src/index.ts';

function busyWorld(seed: number): World {
  const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 120, seed });
  const mems = [] as ReturnType<typeof newBotMemory>[];
  for (let i = 0; i < MAX_PLAYERS; i++) { w.addPlayer(i, `p${i}`, 0, ACCESSORY_IDS[i % ACCESSORY_IDS.length], true, STYLE_IDS[i % STYLE_IDS.length]); mems[i] = newBotMemory(w.rng); }
  for (let t = 0; t < 600; t++) {
    const inputs: (Input | undefined)[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) inputs[i] = botInput(w, w.players[i]!, mems[i]);
    w.step(inputs);
  }
  return w;
}

describe('snapshot', () => {
  it('월드 단위 상태(다음 id·상자 타이머)가 실려 다른 월드에 그대로 복원된다', () => {
    const a = busyWorld(9);
    const snap = encodeSnapshot(a);
    expect(snap.w).toBeDefined();
    expect(snap.w!.length).toBe(2 + a.crateTimers.length);
    const b = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 120, seed: 1 });
    for (let i = 0; i < MAX_PLAYERS; i++) b.addPlayer(i, `p${i}`, 0, ACCESSORY_IDS[i % ACCESSORY_IDS.length], true, STYLE_IDS[i % STYLE_IDS.length]);
    applySnapshot(b, snap);
    expect(b.tick).toBe(a.tick);
    expect(b.nextProjId).toBe(a.nextProjId);
    expect(b.nextItemId).toBe(a.nextItemId);
    expect(b.crateTimers).toEqual(a.crateTimers);
    expect(b.items.length).toBe(a.items.length);
    for (let i = 0; i < MAX_PLAYERS; i++) {
      expect(Math.abs(b.players[i]!.pos.x - a.players[i]!.pos.x)).toBeLessThan(0.001);
      expect(b.players[i]!.hp).toBe(a.players[i]!.hp);
      expect(b.players[i]!.state).toBe(a.players[i]!.state);
    }
  });

  it('숫자는 소수 셋째 자리까지만 실린다 (릴레이 4KB 상한 대비)', () => {
    const snap = encodeSnapshot(busyWorld(3));
    const text = JSON.stringify(snap);
    expect(/\d\.\d{4,}/.test(text)).toBe(false);
    expect(text.length).toBeLessThan(3000);
  });
});
