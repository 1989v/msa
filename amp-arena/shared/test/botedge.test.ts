// 봇 절벽 인식 (2026-09-13): 봇이 스스로 걸어 떨어져 죽는 것은 상대가 없어도 일어나는 자멸이다.
// 밸런스 계측을 통째로 오염시켰다 — 스카이독에서 죽음의 82%, 전체의 36% 가 「아무도 안 때렸는데 떨어짐」이었고,
// 자멸 1·2위(스피드스타·쌍권총)가 그대로 「KO 비가 낮아 약하다」고 찍혔다. 무기가 약한 게 아니라 봇이 떨어진 것이다.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import { botInput, newBotMemory } from '../src/bot.ts';
import { MAX_PLAYERS } from '../src/constants.ts';
import { randomLoadout, makeRng } from '../src/index.ts';

/** 판당 「무주공산 낙사」(cause fall + 가해자 없음) 수를 센다 */
function selfFallsPerMatch(mapId: string, matches: number, seconds = 60): number {
  let falls = 0;
  for (let m = 0; m < matches; m++) {
    const seed = 4200 + m * 7919;
    const w = new World({ mapId: mapId as never, modeId: 'ffa_dm', seconds, seed });
    const rng = makeRng(seed ^ 0x5bd1e995);
    const mems = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const { style, acc } = randomLoadout(rng);
      w.addPlayer(i, `봇${i}`, 0, acc, true, style);
      mems[i] = newBotMemory(w.rng);
    }
    let done = false;
    for (let t = 0; t < (seconds + 10) * 60 && !done; t++) {
      const inputs = [];
      for (let i = 0; i < MAX_PLAYERS; i++) inputs[i] = botInput(w, w.players[i]!, mems[i]);
      for (const e of w.step(inputs)) {
        if (e.t === 'end') done = true;
        else if (e.t === 'ko' && e.cause === 'fall' && e.a < 0) falls++;
      }
    }
  }
  return falls / matches;
}

describe('봇 절벽 인식', () => {
  it('낭떠러지 맵(스카이독)에서 스스로 떨어져 죽지 않는다', () => {
    // 고치기 전 실측: 판당 18.7 (60초 8인). 전투로 밀려 떨어지는 것은 가해자가 있어 여기 안 센다.
    expect(selfFallsPerMatch('skydock', 8)).toBeLessThan(3);
  });

  it('옥상·얼음 호수도 자멸이 드물다', () => {
    expect(selfFallsPerMatch('rooftop', 6)).toBeLessThan(3);
    expect(selfFallsPerMatch('icelake', 6)).toBeLessThan(3);
  });

  it('벽이 있는 콜로세움은 원래 떨어질 데가 없다 (대조군)', () => {
    expect(selfFallsPerMatch('colosseum', 4)).toBe(0);
  });
});
