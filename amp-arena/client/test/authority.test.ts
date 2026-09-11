// 방장 권위 시뮬: 스냅샷 10Hz·좌석별 ack·릴레이 상한·승계(마지막 스냅샷에서 이어서)·이탈 처리.
import { describe, it, expect } from 'vitest';
import { Authority } from '../src/net/authority.ts';
import { SNAPSHOT_EVERY, TICK_RATE, RELAY_MAX_CHARS, RELAY_SAFE_CHARS, ACCESSORY_IDS, STYLE_IDS, type MatchConfig, type HostMsg, type Input } from '@amp/shared';

function config(epoch = 0, host = 0, seconds = 120): MatchConfig {
  const roster = [] as MatchConfig['roster'];
  for (let i = 0; i < 8; i++) roster.push({ id: i, name: i < 2 ? `사람${i}` : `봇${i}`, team: 0, acc: ACCESSORY_IDS[i % ACCESSORY_IDS.length], style: STYLE_IDS[i % STYLE_IDS.length], bot: i >= 2 });
  return { epoch, host, map: 'colosseum', mode: 'ffa_dm', seconds, seed: 42, roster };
}

const envelope = (m: HostMsg) => JSON.stringify({ t: 'move', d: m }).length;

function run(a: Authority, ticks: number, feed?: (tick: number) => void): HostMsg[] {
  const out: HostMsg[] = [];
  (a as unknown as { out: (m: HostMsg) => void }).out = (m) => out.push(m);
  for (let t = 0; t < ticks; t++) { feed?.(t); a.tick(); }
  return out;
}

describe('Authority', () => {
  it('스냅샷은 6틱마다(10Hz) 나가고 좌석별 ack 가 그 좌석의 마지막 입력 seq 를 따라간다', () => {
    const a = new Authority({ cfg: config(), gone: [] }, () => {});
    let seq = 0;
    const msgs = run(a, 600, () => { seq++; a.input(1, [{ seq, mx: 1, mz: 0, btn: 0 } satisfies Input]); });
    const snaps = msgs.filter((m): m is Extract<HostMsg, { t: 's' }> => m.t === 's');
    expect(snaps.length).toBe(600 / SNAPSHOT_EVERY);
    const last = snaps[snaps.length - 1];
    expect(last.acks[1]).toBeGreaterThanOrEqual(seq - 2);
    expect(last.acks[0]).toBe(0);
    expect(last.snap.tick).toBe(600);
    for (const s of snaps) expect(envelope(s)).toBeLessThan(RELAY_MAX_CHARS);
  });

  it('8인 봇 난전 20초 동안 스냅샷 봉투가 릴레이 안전 상한 안에 든다', () => {
    const cfg = config();
    cfg.roster = cfg.roster.map((r) => ({ ...r, bot: r.id !== 0 }));
    const a = new Authority({ cfg, gone: [] }, () => {});
    const msgs = run(a, TICK_RATE * 20);
    const sizes = msgs.filter((m) => m.t === 's').map(envelope);
    expect(Math.max(...sizes)).toBeLessThan(RELAY_SAFE_CHARS);
    expect(a.stats.snapMax).toBeLessThan(RELAY_SAFE_CHARS);
    // 사람 좌석에 입력이 없어도 봇이 움직여 판이 진행된다
    expect(a.world.tick).toBe(TICK_RATE * 20);
  });

  it('방장 승계: 새 방장은 마지막 스냅샷의 틱·위치·상자 타이머에서 이어서 돌리고 옛 방장 좌석은 비운다', () => {
    const cfgA = config(0, 0);
    const A = new Authority({ cfg: cfgA, gone: [] }, () => {});
    let seq = 0;
    const msgsA = run(A, 400, () => { seq++; A.input(1, [{ seq, mx: 0.7, mz: 0.7, btn: 0 }]); });
    const lastSnap = [...msgsA].reverse().find((m): m is Extract<HostMsg, { t: 's' }> => m.t === 's')!;
    const resume = { snap: lastSnap.snap, acks: lastSnap.acks };
    const B = new Authority({ cfg: { ...cfgA, epoch: 1, host: 1 }, resume, gone: [0] }, () => {});
    expect(B.epoch).toBe(1);
    expect(B.world.tick).toBe(lastSnap.snap.tick);
    expect(B.world.players[0]).toBeUndefined();
    expect(B.world.crateTimers).toEqual(A.world.crateTimers);
    expect(B.world.nextItemId).toBe(A.world.nextItemId);
    const rowOf = (id: number) => lastSnap.snap.p.find((r) => r[0] === id)!;
    for (const id of [1, 2, 5]) {
      const p = B.world.players[id]!;
      expect(Math.abs(p.pos.x - rowOf(id)[1])).toBeLessThan(0.002);
      expect(Math.abs(p.pos.z - rowOf(id)[3])).toBeLessThan(0.002);
      expect(p.hp).toBe(rowOf(id)[13]);
    }
    // 새 방장의 ack 는 옛 방장이 마지막으로 반영한 seq 에서 시작해야 게스트가 입력을 두 번 재실행하지 않는다
    const msgsB = run(B, SNAPSHOT_EVERY);
    const firstB = msgsB.find((m): m is Extract<HostMsg, { t: 's' }> => m.t === 's')!;
    expect(firstB.e).toBe(1);
    expect(firstB.acks[1]).toBe(lastSnap.acks[1]);
    expect(firstB.snap.tick).toBe(lastSnap.snap.tick + SNAPSHOT_EVERY);
    expect(firstB.snap.p.some((r) => r[0] === 0)).toBe(false);
  });

  it('이탈한 좌석은 월드에서 빠지고 그 뒤 입력은 무시된다', () => {
    const a = new Authority({ cfg: config(), gone: [] }, () => {});
    run(a, 10);
    a.left(1);
    expect(a.world.players[1]).toBeUndefined();
    a.input(1, [{ seq: 99, mx: 1, mz: 0, btn: 0 }]);
    const msgs = run(a, SNAPSHOT_EVERY * 2);
    const s = msgs.find((m): m is Extract<HostMsg, { t: 's' }> => m.t === 's')!;
    expect(s.acks[1]).toBe(0);
    expect(s.snap.p.some((r) => r[0] === 1)).toBe(false);
  });

  it('입력은 신뢰 경계를 지난다 — 범위 밖 값·역순 seq 는 버린다', () => {
    const a = new Authority({ cfg: config(), gone: [] }, () => {});
    a.input(1, [{ seq: 5, mx: 3, mz: 0, btn: 999 }, { seq: 3, mx: 1, mz: 0, btn: 1 }, 'garbage', { seq: 6, mx: 'x', mz: 0, btn: 0 }]);
    const msgs = run(a, SNAPSHOT_EVERY);
    const s = msgs.find((m): m is Extract<HostMsg, { t: 's' }> => m.t === 's')!;
    expect(s.acks[1]).toBe(5); // seq 5 만 유효(정규화된 mx=1, btn 마스크) · seq 3 은 역순 · 나머지는 형식 불량
  });

  it('판이 끝나면 end 를 한 번 보내고 멈춘다', () => {
    const a = new Authority({ cfg: config(0, 0, 30), gone: [] }, () => {});
    const msgs = run(a, TICK_RATE * 40);
    const ends = msgs.filter((m) => m.t === 'end');
    expect(ends.length).toBe(1);
    expect(a.ended).toBe(true);
    const lastTick = a.world.tick;
    a.tick();
    expect(a.world.tick).toBe(lastTick);
  });
});
