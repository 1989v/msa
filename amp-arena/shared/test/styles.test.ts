import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, BTN_SPECIAL, type Input } from '../src/input.ts';
import { MOVES } from '../src/moves.ts';
import { STYLES, STYLE_IDS, statsForStyle, type StyleId } from '../src/styles.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });

function setup(styleA: StyleId, styleB: StyleId = 'fighter', dist = 1.2) {
  const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 9 });
  const a = w.addPlayer(0, 'A', 0, 'none', false, styleA);
  const b = w.addPlayer(1, 'B', 1, 'none', false, styleB);
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  a.pos.x = 0; a.pos.z = 0; a.yaw = 0; b.pos.x = 0; b.pos.z = dist; b.yaw = Math.PI;
  return { w, a, b };
}
const run = (w: World, ia: Input, ib: Input, n: number) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([ia, ib])); return ev; };
/** 격틱 연타로 콤보 사슬 이름을 모은다 */
function chainOf(w: World, a: { move: string | null }, n: number, ib: Input = inp()) {
  const seen: string[] = [];
  for (let i = 0; i < n; i++) { w.step([inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0), ib]); if (a.move && seen[seen.length - 1] !== a.move) seen.push(a.move); }
  return seen;
}

describe('스타일', () => {
  it('5종 모두 스탯이 1~5 안이고 체력 공식이 맞다', () => {
    for (const id of STYLE_IDS) {
      const s = statsForStyle(id);
      for (const v of Object.values(s)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(5); }
      const { a } = setup(id);
      expect(a.maxHp).toBe(70 + 10 * s.hp);
    }
  });
  it('파이터: 약공 잽·스트레이트·로킥, 어퍼컷', () => {
    const { w, a, b } = setup('fighter');
    expect(chainOf(w, a, 90).slice(0, 3)).toEqual(['jab', 'straight', 'kick1']);
    expect(b.hp).toBeLessThan(b.maxHp);
    const s2 = setup('fighter');
    run(s2.w, inp(0, 0, BTN_SPECIAL), inp(), 1);
    expect(s2.a.move).toBe('uppercut');
  });
  it('그래플러: 약공 훅·훅·박치기, 대시 잡기는 3m 밖 상대를 붙잡는다, 던지기 22', () => {
    const { w, a, b } = setup('grappler', 'fighter', 1.6);
    expect(chainOf(w, a, 110).slice(0, 3)).toEqual(['hook', 'hook2', 'headbutt']);
    const s2 = setup('grappler', 'fighter', 3.5);
    run(s2.w, inp(0, 0, BTN_SPECIAL), inp(), 1);
    expect(s2.a.state).toBe('grabTry');
    expect(s2.a.move).toBe('dashGrab');
    for (let i = 0; i < 40 && s2.a.state === 'grabTry'; i++) s2.w.step([inp(), inp()]);
    expect(s2.a.state).toBe('grabbing');
    expect(s2.b.state).toBe('held');
    run(s2.w, inp(0, 0, BTN_ATTACK), inp(), 1);
    run(s2.w, inp(), inp(), C.THROW_RELEASE_TICK);
    expect(s2.b.hp).toBe(s2.b.maxHp - STYLES.grappler.throwDamage);
  });
  it('그래플러 바디슬램은 발동 중 잽에 끊기지 않는다 (슈퍼아머)', () => {
    const { w, a, b } = setup('grappler', 'fighter', 1.6);
    a.comboIdx = 1; a.move = 'bodySlam'; a.state = 'attack'; a.t = 0; a.hitMask = 0;
    // b 가 즉시 잽 — a 의 발동 12틱 안에 맞는다
    for (let i = 0; i < MOVES.jab.startup + 1; i++) w.step([inp(), inp(0, 0, i === 0 ? BTN_ATTACK : 0)]);
    expect(a.hp).toBe(a.maxHp - Math.floor(6 * C.defMult(4) + 1e-6)); // 방어 4 → 잽 6 이 5 데미지
    expect(a.state).toBe('attack');
    expect(a.move).toBe('bodySlam');
  });
  it('스피드스타: 약공 3단, 이동 +15%, 회전 발차기는 여러 번 때린다', () => {
    const { w, a, b } = setup('speedster', 'fighter', 1.2);
    expect(chainOf(w, a, 80).slice(0, 3)).toEqual(['quick1', 'quick2', 'quick3']);
    const s2 = setup('speedster', 'fighter', 12);
    run(s2.w, inp(0, 1), inp(), 60);
    expect(s2.a.pos.z).toBeGreaterThan(C.WALK_SPEED * 1.1);
    const s3 = setup('speedster', 'fighter', 1.0);
    s3.b.pos.z = 1.1; s3.b.state = 'guard'; // 가드는 잡기 대상이라 살짝 떨어뜨림
    s3.b.state = 'idle'; s3.b.pos.x = 0.9; s3.b.pos.z = 0.9;
    let hits = 0;
    for (let i = 0; i < 45; i++) for (const e of s3.w.step([inp(0, 0, i === 0 ? BTN_SPECIAL : 0), inp()])) if (e.t === 'hit' && e.v === 1 && e.kind === 'hit') hits++;
    expect(s3.a.move === 'spinKick' || hits > 0).toBe(true);
    expect(hits).toBeGreaterThanOrEqual(2);
  });
  it('헤비: 약공 해머 2단, 지진은 반지름 2.6m 를 전부 띄운다, 이동 −10%', () => {
    const { w, a, b } = setup('heavy', 'fighter', 1.4);
    expect(chainOf(w, a, 90).slice(0, 2)).toEqual(['hammer1', 'hammer2']);
    const s2 = setup('heavy', 'fighter', 2.2);
    const c = s2.w.addPlayer(2, 'C', 1, 'none', false); c.pos.x = -2; c.pos.z = 0; c.yaw = 0;
    run(s2.w, inp(0, 0, BTN_SPECIAL), inp(), 1);
    for (let i = 0; i < 50; i++) s2.w.step([inp(), inp(), inp()]);
    expect(s2.b.hp).toBe(s2.b.maxHp - 18);
    expect(c.hp).toBe(c.maxHp - 18);
    const s3 = setup('heavy', 'fighter', 12);
    run(s3.w, inp(0, 1), inp(), 60);
    expect(s3.a.pos.z).toBeLessThan(C.WALK_SPEED * 0.95);
  });
  it('마셜: 발차기 3단은 1.9m 에서 닿고, 비연각은 전방으로 날아가 맞힌다', () => {
    const { w, b } = setup('martial', 'fighter', 2.4);
    run(w, inp(0, 0, BTN_ATTACK), inp(), MOVES.kick1.startup + 2);
    expect(b.hp).toBe(b.maxHp - Math.floor(6 * C.atkMult(4) + 1e-6));
    const s2 = setup('martial', 'fighter', 3.5);
    run(s2.w, inp(0, 0, BTN_SPECIAL), inp(), 1);
    expect(s2.a.move).toBe('flyingKick');
    for (let i = 0; i < 40; i++) s2.w.step([inp(), inp()]);
    expect(s2.b.hp).toBeLessThan(s2.b.maxHp);
    expect(s2.a.pos.z).toBeGreaterThan(1.5);
  });
  it('악세서리를 들면 공격은 악세서리 것, 이동 패시브는 남는다', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 9 });
    const a = w.addPlayer(0, 'A', 0, 'pistols', false, 'speedster'); // 스피드스타 전용
    w.addPlayer(1, 'B', 1, 'none', false);
    for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
    a.pos.x = 0; a.pos.z = 0; a.yaw = 0; w.players[1]!.pos.x = 10; w.players[1]!.pos.z = 10;
    run(w, inp(0, 1), inp(), 60);
    expect(a.pos.z).toBeGreaterThan(C.WALK_SPEED * 1.1); // 이동 +15% 는 악세서리를 들어도 남는다
    run(w, inp(0, 0, BTN_ATTACK), inp(), 1);
    expect(a.move).toBe('gunShot'); // 공격은 악세서리 것
  });
});
