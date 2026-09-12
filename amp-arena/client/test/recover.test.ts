// 승계 재전송: ack 뒤의 입력만, 최근 32개를 16개씩 — 새 방장의 입력 메시지 상한(16)·큐 상한(30)에 맞춘다.
import { describe, it, expect } from 'vitest';
import { resendChunks, RESEND_MAX, RESEND_CHUNK } from '../src/net/recover.ts';
import { Authority, latencyTicksFor } from '../src/net/authority.ts';
import { INTERP_TICKS, LAG_COMP_MAX_TICKS, ACCESSORY_IDS, STYLE_IDS, type MatchConfig, type Input } from '@amp/shared';

const mk = (n: number, from = 1): Input[] => Array.from({ length: n }, (_, i) => ({ seq: from + i, mx: 0, mz: 1, btn: 0 }));

describe('resendChunks', () => {
  it('ack 이하는 버리고 나머지를 16개씩 묶는다', () => {
    const chunks = resendChunks(mk(40), 10);
    expect(chunks.length).toBe(2);
    expect(chunks.flat().length).toBe(30);
    expect(chunks[0][0].seq).toBe(11);
    expect(chunks[1][chunks[1].length - 1].seq).toBe(40);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(RESEND_CHUNK);
  });
  it('밀린 게 많으면 최근 32개만 보낸다', () => {
    const chunks = resendChunks(mk(180), 0);
    expect(chunks.flat().length).toBe(RESEND_MAX);
    expect(chunks.flat()[0].seq).toBe(180 - RESEND_MAX + 1);
  });
  it('보낼 게 없으면 빈 배열', () => { expect(resendChunks(mk(5), 5)).toEqual([]); });
});

function config(): MatchConfig {
  const roster = [] as MatchConfig['roster'];
  for (let i = 0; i < 3; i++) roster.push({ id: i, name: `p${i}`, team: 0, acc: ACCESSORY_IDS[0], style: STYLE_IDS[0], bot: i === 2 });
  return { epoch: 1, host: 0, map: 'colosseum', mode: 'ffa_dm', seconds: 120, seed: 7, roster };
}

describe('새 방장이 재전송 입력을 받는다', () => {
  it('묶음마다 16개까지 큐에 들어가고 ack 이하 seq 는 걸러진다', () => {
    const a = new Authority({ cfg: config(), gone: [] }, () => {});
    (a as unknown as { lastSeq: number[] }).lastSeq[1] = 10;
    for (const c of resendChunks(mk(40), 10)) a.input(1, c);
    const q = (a as unknown as { queues: Input[][] }).queues[1];
    expect(q.length).toBe(30);
    expect(q[0].seq).toBe(11);
    expect(q[q.length - 1].seq).toBe(40);
    a.tick(); // 밀린 입력은 한 틱에 둘씩 소화한다
    expect(q.length).toBe(28);
  });
});

describe('latencyTicksFor', () => {
  it('왕복 지연 + 보간 지연, 상한은 기록 길이', () => {
    expect(latencyTicksFor(0)).toBe(0);
    expect(latencyTicksFor(100)).toBe(6 + INTERP_TICKS);
    expect(latencyTicksFor(5000)).toBe(LAG_COMP_MAX_TICKS);
  });
  it('setLatency 는 사람 좌석에만 붙고 이탈하면 0 으로 돌아간다', () => {
    const a = new Authority({ cfg: config(), gone: [] }, () => {});
    a.setLatency(1, 100);
    a.setLatency(2, 100); // 봇
    expect(a.world.latency[1]).toBe(6 + INTERP_TICKS);
    expect(a.world.latency[2] ?? 0).toBe(0);
    a.left(1);
    expect(a.world.latency[1]).toBe(0);
  });
});
