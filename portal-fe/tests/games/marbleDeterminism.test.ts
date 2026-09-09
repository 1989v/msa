import { describe, expect, it } from 'vitest';
import { MARBLE_SIM_FILES, gameSource, loadGame } from './loadGame';

/**
 * ADR-0092 SR-6 — 결정적 재생.
 *
 * **비교 대상은 게임이 내놓은 `order` 다.** 검사가 순위를 스스로 계산하면 게임을 지워도
 * 초록불이 난다.
 */
const NAMES = ['민수', '영희', '철수', '지훈', '수연', '태오'];

function run(seed: number, courseKey = 'pinball', names = NAMES): number[] {
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  g.Game.start({
    entries: names.map((name) => ({ name, count: 1 })),
    modeKey: 'last',
    rank: 1,
    courseKey,
    seed,
  });
  g.Game.fastForward(240);
  // 게임이 내놓은 순위다 — 검사가 계산한 값이 아니다
  return g.Game.state().order.map((m: any) => (typeof m === 'number' ? m : m.owner));
}

describe('구슬 레이스 — 결정적 재생', () => {
  it('T1 같은 입력을 두 번 돌리면 순위가 같다', () => {
    const a = run(123456);
    const b = run(123456);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it('T2 시드가 다르면 순위가 달라진다 — T1 이 항상 같은 값으로 통과하는 것을 막는다', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => run(s * 7919).join(','));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('T1 코스가 달라도 재현된다', () => {
    for (const course of ['pinball', 'cascade', 'carousel']) {
      expect(run(999, course)).toEqual(run(999, course));
    }
  });
});

describe('T3 엔진 간 동일성 — 소스 단정이 먼저다', () => {
  /**
   * **값 표만으로는 못 잰다.** 룩업을 기동 시 `Math.sin` 으로 채우면 Node(V8)에서 표와
   * 정확히 일치해 초록불이 나고 JSC 에서 갈린다 — 막으려던 바로 그 상태다.
   * 실기 대조가 범위 밖이므로 이 소스 단정이 유일한 배포 전 게이트다.
   */
  it('출하 시뮬 파일에 Math.sin/cos/tan 호출이 없다', () => {
    const simFiles = ['physics.js', 'game.js', 'parts.js', 'courses.js', 'rng.js'];
    for (const file of simFiles) {
      const src = gameSource('marble-race', file);
      expect(src, `${file} 에 엔진 표준 삼각함수가 있다`).not.toMatch(/Math\.(sin|cos|tan)\s*\(/);
    }
  });

  it('결정적 구현 자체가 엔진 함수를 안 쓴다', () => {
    const trig = gameSource('marble-race', 'trig.js');
    // 주석에는 나올 수 있으므로 호출 형태만 본다
    expect(trig).not.toMatch(/=\s*Math\.(sin|cos|tan)\s*\(/);
    expect(trig).not.toMatch(/\bMath\.(sin|cos|tan)\s*\([^)]*\)\s*[;,)]/);
  });

  it('렌더 파일은 표준 함수를 그대로 쓴다 — 결과를 안 바꾸므로 건드릴 이유가 없다', () => {
    expect(gameSource('marble-race', 'art.js')).toMatch(/Math\.cos\(/);
  });

  it('고정 각도에서 값이 유지된다', () => {
    const g = loadGame('marble-race', ['trig.js']);
    const angles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI, -Math.PI / 3, 7.5];
    for (const a of angles) {
        // 다항식 근사 오차(~1e-11) 안에서 표준 함수와 일치해야 한다.
      // 이 단정은 「식이 망가지지 않았다」를 재고, 엔진 동일성은 위 소스 단정이 잰다.
      expect(g.Trig.sin(a)).toBeCloseTo(Math.sin(a), 9);
      expect(g.Trig.cos(a)).toBeCloseTo(Math.cos(a), 9);
    }
  });

  it('시뮬 파일에 Math.random·Date.now 가 없다 — 시드 하나가 판을 정한다', () => {
    for (const file of ['physics.js', 'game.js', 'parts.js', 'courses.js']) {
      const src = gameSource('marble-race', file);
      expect(src, `${file}`).not.toMatch(/Math\.random\s*\(/);
      expect(src, `${file}`).not.toMatch(/Date\.now\s*\(/);
      expect(src, `${file}`).not.toMatch(/performance\.now\s*\(/);
    }
  });
});
