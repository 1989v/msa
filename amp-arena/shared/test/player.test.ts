import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, BTN_JUMP, BTN_GUARD, BTN_DASH, BTN_SPECIAL, type Input } from '../src/input.ts';
import { MOVES, totalTicks, chainTick } from '../src/moves.ts';
import { encodePlayer, encodeSnapshot, applySnapshot, decodePlayer } from '../src/snapshot.ts';

const inp = (mx = 0, mz = 0, btn = 0, seq = 0): Input => ({ seq, mx, mz, btn });

function world(mode: 'ffa_dm' | 'ffa_survival' | 'team_dm' = 'ffa_dm', map: 'colosseum' | 'skydock' = 'colosseum') {
  const w = new World({ mapId: map, modeId: mode, seconds: 180, seed: 7 });
  const a = w.addPlayer(0, 'A', 0, 'none', false);
  const b = w.addPlayer(1, 'B', 1, 'none', false);
  // 카운트다운 건너뛰기
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  expect(w.phase).toBe('play');
  return { w, a, b };
}

function place(w: World, id: number, x: number, z: number, yaw = 0) {
  const p = w.players[id]!;
  p.pos.x = x; p.pos.z = z; p.pos.y = 0; p.yaw = yaw; p.vel.x = p.vel.y = p.vel.z = 0; p.grounded = true;
}

/** n틱 동안 같은 입력을 준다 (버튼 엣지는 첫 틱에만 생기도록 이후 btn 유지) */
function run(w: World, id: number, input: Input, n: number, other: Input = inp()) {
  const ev = [];
  for (let i = 0; i < n; i++) {
    const inputs: Input[] = [];
    inputs[id] = input;
    inputs[1 - id] = other;
    ev.push(...w.step(inputs));
  }
  return ev;
}

describe('이동·점프', () => {
  it('걷기는 틱당 WALK_SPEED×DT 만큼 간다', () => {
    const { w } = world();
    place(w, 0, 0, 0); place(w, 1, 10, 10);
    run(w, 0, inp(0, 1), 60);
    expect(w.players[0]!.pos.z).toBeCloseTo(C.WALK_SPEED, 1);
    expect(w.players[0]!.state).toBe('walk');
  });
  it('대시는 RUN_SPEED, 상태는 run', () => {
    const { w } = world();
    place(w, 0, 0, 0); place(w, 1, 10, 10);
    run(w, 0, inp(1, 0, BTN_DASH), 30);
    expect(w.players[0]!.state).toBe('run');
    expect(w.players[0]!.pos.x).toBeCloseTo(C.RUN_SPEED * 0.5, 1);
  });
  it('점프 최고점은 약 1.8m 이고 착지 후 land → idle', () => {
    const { w } = world();
    place(w, 0, 0, 0); place(w, 1, 10, 10);
    let maxY = 0;
    run(w, 0, inp(0, 0, BTN_JUMP), 1);
    for (let i = 0; i < 120; i++) { w.step([inp(), inp()]); maxY = Math.max(maxY, w.players[0]!.pos.y); }
    expect(maxY).toBeGreaterThan(1.6);
    expect(maxY).toBeLessThan(2.0);
    expect(w.players[0]!.grounded).toBe(true);
    expect(w.players[0]!.state).toBe('idle');
  });
  it('원형 벽 밖으로 나가지 못한다', () => {
    const { w } = world();
    place(w, 0, 18, 0); place(w, 1, -10, 0);
    run(w, 0, inp(1, 0, BTN_DASH), 120);
    expect(Math.hypot(w.players[0]!.pos.x, w.players[0]!.pos.z)).toBeLessThanOrEqual(20 - C.PLAYER_RADIUS + 1e-6);
  });
  it('단상(1.5m)은 걸어서 오르지 못하고 점프로 오른다', () => {
    const { w } = world();
    w.items = []; // 길목의 상자(9m 링)는 이제 막히므로 치운다
    place(w, 0, 0, 8.5, 0); place(w, 1, -10, -10);
    run(w, 0, inp(0, 1), 60);
    expect(w.players[0]!.pos.y).toBe(0);
    expect(w.players[0]!.pos.z).toBeLessThan(10 - C.PLAYER_RADIUS + 0.01);
    run(w, 0, inp(0, 1, BTN_JUMP), 1);
    run(w, 0, inp(0, 1), 90);
    expect(w.players[0]!.pos.y).toBeCloseTo(1.5, 5);
  });
});

describe('공격·콤보', () => {
  it('잽은 발동 6 뒤 판정, 상대 경직 20틱, 데미지 6 (밸런스 2차: 맨손 KO 비 0.41 → 잽 5→6)', () => {
    const { w, a, b } = world();
    place(w, 0, 0, 0, 0); place(w, 1, 0, 1.2, Math.PI);
    const ev = run(w, 0, inp(0, 0, BTN_ATTACK), MOVES.jab.startup + 1);
    const hit = ev.find((e) => e.t === 'hit');
    expect(hit && hit.t === 'hit' && hit.dmg).toBe(6);
    expect(b.hp).toBe(a.maxHp - 6);
    expect(b.state).toBe('hitstun');
    run(w, 0, inp(), MOVES.jab.hitstun);
    expect(b.state).toBe('idle');
  });
  it('약공 연타는 잽 → 스트레이트 → 로킥으로 이어진다 (띄우기는 강공 사슬)', () => {
    const { w, a, b } = world();
    place(w, 0, 0, 0, 0); place(w, 1, 0, 1.2, Math.PI);
    const seen: string[] = [];
    let btn = BTN_ATTACK;
    for (let i = 0; i < 70; i++) { // 3타(잽 22 + 스트레이트 25 + 로킥 24 = 71틱)까지만 — 그 뒤엔 새 사슬이 시작된다
      btn = i % 2 === 0 ? BTN_ATTACK : 0; // 격틱 연타
      w.step([inp(0, 0, btn), inp()]);
      if (a.move && seen[seen.length - 1] !== a.move) seen.push(a.move);
    }
    expect(seen.slice(0, 3)).toEqual(['jab', 'straight', 'kick1']);
    expect(['hitstun', 'idle']).toContain(b.state);
    expect(b.hp).toBe(a.maxHp - 6 - 7 - 6);
  });
  it('띄워진 상대는 착지 후 다운 → 기상 → 대기, 다운 중 무적', () => {
    const { w, a, b } = world();
    place(w, 0, 0, 0, 0); place(w, 1, 0, 1.2, Math.PI);
    a.comboIdx = 2; a.move = 'roundhouse'; a.state = 'attack'; a.t = 0;
    run(w, 0, inp(), 12);
    expect(b.state).toBe('launched');
    let downSeen = false, getupSeen = false;
    for (let i = 0; i < 200; i++) {
      w.step([inp(), inp()]);
      if (b.state === 'down') downSeen = true;
      if (b.state === 'getup') getupSeen = true;
    }
    expect(downSeen && getupSeen).toBe(true);
    expect(b.state).toBe('idle');
  });
  it('가드는 정면 타격을 막고 게이지를 데미지×4 만큼 깎는다, 0이면 기절', () => {
    const { w, a, b } = world();
    place(w, 0, 0, 0, 0); place(w, 1, 0, 1.2, Math.PI);
    const hp = b.hp;
    let guardEv = 0, breakEv = 0;
    for (let i = 0; i < 200 && b.state !== 'stun'; i++) {
      const ev = w.step([inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0), inp(0, 0, BTN_GUARD)]);
      for (const e of ev) { if (e.t === 'hit' && e.kind === 'guard') guardEv++; if (e.t === 'hit' && e.kind === 'guardBreak') breakEv++; }
    }
    expect(b.hp).toBe(hp);
    expect(guardEv).toBeGreaterThan(0);
    expect(breakEv).toBe(1);
    expect(b.state).toBe('stun');
  });
  it('뒤에서 때리면 가드를 무시한다', () => {
    const { w, a, b } = world();
    place(w, 0, 0, 0, 0); place(w, 1, 0, 1.2, 0); // b 도 +z 를 본다 = a 에게 등을 보인다
    run(w, 0, inp(0, 0, BTN_ATTACK), MOVES.jab.startup + 1, inp(0, 0, BTN_GUARD));
    expect(b.hp).toBe(b.maxHp - 6);
  });
  it('밀착 상태에서 공격 키는 잡기가 되고, 던지면 15 데미지 후 다운', () => {
    const { w, a, b } = world();
    place(w, 0, 0, 0, 0); place(w, 1, 0, 0.9, Math.PI);
    run(w, 0, inp(0, 0, BTN_ATTACK), 1);
    expect(a.state).toBe('grabTry');
    run(w, 0, inp(), MOVES.grab.startup);
    expect(a.state).toBe('grabbing');
    expect(b.state).toBe('held');
    run(w, 0, inp(0, 0, BTN_ATTACK), 1);
    expect(a.state).toBe('throw');
    run(w, 0, inp(), C.THROW_RELEASE_TICK);
    expect(b.state).toBe('thrown');
    expect(b.hp).toBe(b.maxHp - C.THROW_DAMAGE);
    for (let i = 0; i < 120 && b.state === 'thrown'; i++) w.step([inp(), inp()]);
    expect(b.state).toBe('down');
  });
  it('잡힌 쪽이 6번 연타하면 탈출한다', () => {
    const { w, a, b } = world();
    place(w, 0, 0, 0, 0); place(w, 1, 0, 0.9, Math.PI);
    run(w, 0, inp(0, 0, BTN_ATTACK), 1);
    run(w, 0, inp(), MOVES.grab.startup);
    expect(b.state).toBe('held');
    for (let i = 0; i < 14; i++) w.step([inp(), inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0)]);
    expect(b.state).not.toBe('held');
    expect(a.state).not.toBe('grabbing');
  });
  it('어퍼컷(V)은 쿨다운을 건다', () => {
    const { w, a } = world();
    place(w, 0, 0, 0); place(w, 1, 10, 10);
    run(w, 0, inp(0, 0, BTN_SPECIAL), 1);
    expect(a.state).toBe('special');
    expect(a.cooldown).toBeGreaterThan(0);
  });
  it('프레임 데이터 표와 총 틱이 일치한다', () => {
    // 2026-09-11 2차: 발동 ×1.2 · 후딜 ×1.25 (기획서 §6.2 표)
    expect(totalTicks(MOVES.jab)).toBe(6 + 3 + 13);
    expect(chainTick(MOVES.jab)).toBe(6 + 3 + 13);
    expect(totalTicks(MOVES.roundhouse)).toBe(12 + 5 + 23);
  });
});

describe('사망·리스폰·낙사·매치', () => {
  it('HP 0 이면 KO 이벤트, 데스매치는 리스폰한다', () => {
    const { w, a, b } = world('ffa_dm');
    place(w, 0, 0, 0, 0); place(w, 1, 0, 1.2, Math.PI);
    b.hp = 3;
    const ev = run(w, 0, inp(0, 0, BTN_ATTACK), MOVES.jab.startup + 1);
    expect(ev.some((e) => e.t === 'ko' && e.a === 0 && e.v === 1)).toBe(true);
    expect(a.kos).toBe(1);
    expect(b.state).toBe('dead');
    let respawned = false;
    for (let i = 0; i < C.DEAD_TICKS + C.RESPAWN_WAIT_TICKS + 5; i++) for (const e of w.step([inp(), inp()])) if (e.t === 'respawn') respawned = true;
    expect(respawned).toBe(true);
    expect(b.hp).toBe(b.maxHp);
    expect(b.invuln).toBeGreaterThan(0);
  });
  it('서바이벌은 한 명 남으면 끝나고 순위가 나온다', () => {
    const { w, a, b } = world('ffa_survival');
    place(w, 0, 0, 0, 0); place(w, 1, 0, 1.2, Math.PI);
    b.hp = 3;
    const ev = run(w, 0, inp(0, 0, BTN_ATTACK), MOVES.jab.startup + 2);
    expect(w.phase).toBe('ended');
    const end = ev.find((e) => e.t === 'end');
    expect(end && end.t === 'end' && end.ranking[0].id).toBe(0);
    expect(b.alive).toBe(false);
  });
  it('스카이독에서 발판 밖으로 떨어지면 낙사 KO', () => {
    const { w, a, b } = world('ffa_dm', 'skydock');
    place(w, 0, 0, 0); place(w, 1, 5, 0);
    a.pos.x = 11.5; // 중앙 발판 동쪽 끝
    const ev = run(w, 0, inp(1, 0, BTN_DASH), 240);
    expect(ev.some((e) => e.t === 'ko' && e.v === 0 && e.cause === 'fall')).toBe(true);
    expect(a.kos).toBe(-1);
  });
  it('시간이 다 되면 끝난다', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 30, seed: 1 });
    w.addPlayer(0, 'A', 0, 'none', false); w.addPlayer(1, 'B', 0, 'none', false);
    let ended = false;
    for (let i = 0; i < C.COUNTDOWN_TICKS + 30 * C.TICK_RATE + 2 && !ended; i++) for (const e of w.step([])) if (e.t === 'end') ended = true;
    expect(ended).toBe(true);
  });
});

describe('스냅샷·예측 결정성', () => {
  it('같은 입력 열은 같은 상태를 만든다 (되감기·재실행 전제)', () => {
    const mk = () => { const { w } = world(); place(w, 0, 0, 0); place(w, 1, 5, 5); return w; };
    const w1 = mk(), w2 = mk();
    const seq: Input[] = [];
    for (let i = 0; i < 90; i++) seq.push(inp(Math.sin(i / 7), Math.cos(i / 11), i % 20 === 0 ? BTN_ATTACK : i % 33 === 0 ? BTN_JUMP : 0, i));
    for (const s of seq) { w1.step([s, inp()]); w2.step([s, inp()]); }
    expect(encodePlayer(w1.players[0]!)).toEqual(encodePlayer(w2.players[0]!));
  });
  it('스냅샷 왕복 후 계속 돌려도 원본과 같다', () => {
    const { w } = world();
    place(w, 0, 0, 0); place(w, 1, 2, 2);
    for (let i = 0; i < 30; i++) w.step([inp(1, 0, BTN_DASH), inp(0, 0, BTN_ATTACK)]);
    const snap = JSON.parse(JSON.stringify(encodeSnapshot(w)));
    const w2 = new World(w.cfg);
    w2.addPlayer(0, 'A', 0, 'none', false); w2.addPlayer(1, 'B', 1, 'none', false);
    applySnapshot(w2, snap);
    for (let i = 0; i < 30; i++) { const s = [inp(0, 1, BTN_ATTACK), inp(1, 0, 0)]; w.step(s); w2.step(s); }
    expect(encodeSnapshot(w2)).toEqual(encodeSnapshot(w));
  });
  it('decodePlayer 는 encodePlayer 의 역함수다', () => {
    const { w, a } = world();
    a.hp = 42; a.state = 'guard'; a.guard = 33.3; a.vel.x = 1.5; a.grabbing = 1; a.kos = 3;
    const row = encodePlayer(a);
    const w2 = new World(w.cfg); const c = w2.addPlayer(0, 'A', 0, 'none', false);
    decodePlayer(c, row);
    expect(encodePlayer(c)).toEqual(row);
  });
});
