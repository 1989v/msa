/**
 * 게임 JS 를 테스트에서 부르는 경로 (ADR-0092 · W1).
 *
 * 게임은 `public/games/**` 에 있어 어떤 러너에도 수집되지 않고, ESM 이 아니라 IIFE 라
 * `import` 할 심이 없다(`global.Rng = {...}`). 그래서 **가짜 window 에 파일을 순서대로
 * 올려 실행한다.**
 *
 * 이 배선이 없으면 구현자에게 열린 가장 싼 길이 **시뮬 로직을 테스트 파일에 다시 적는 것**이고,
 * 그 순간 검사는 게임을 지워도 초록불이 나는 물건이 된다. 비교 대상은 언제나
 * **게임이 내놓은 값**이어야 한다.
 *
 * 시뮬 파일은 캔버스·DOM 을 만지지 않으므로 헤드리스로 그대로 돈다.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const GAMES_ROOT = resolve(__dirname, '../../public/games');

/** 게임 하나를 격리된 컨텍스트에 올린다. 반환값이 그 게임의 전역이다 */
export function loadGame(slug: string, files: string[]): Record<string, any> {
  const sandbox: Record<string, any> = {
    Math,
    Date,
    console,
    Float64Array,
    Uint32Array,
    Int32Array,
    Array,
    Object,
    JSON,
    isFinite,
    performance: { now: () => 0 },
    /**
     * 소리는 **출력**이라 결과를 안 바꾼다 — 무음으로 세워도 재는 값(순위)에 영향이 없다.
     * 이것은 「검사가 자기 근거를 만드는 것」과 다르다: 판정 대상은 `Game.state().order` 이고
     * 그 값은 여전히 게임이 계산한다. 진짜 `audio.js` 는 AudioContext 를 요구해서 못 올린다.
     */
    Sound: { arrive() {}, clack() {}, gate() {}, result() {} },
    /**
     * 파티클도 출력이다. 세우는 근거가 소리보다 강하다 — `fx.js` 는 `Math.random` 을 쓰므로
     * 애초에 시뮬의 일부일 수 없다(시뮬은 시드 하나로만 무작위를 만든다).
     */
    FX: { burst() {}, flash() {}, ring() {}, shake() {}, spark() {} },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const file of files) {
    const path = resolve(GAMES_ROOT, slug, 'js', file);
    const code = readFileSync(path, 'utf-8');
    vm.runInContext(code, ctx, { filename: path });
  }
  return sandbox;
}

/**
 * 시뮬에 필요한 최소 집합 — 그림·소리는 안 올린다.
 *
 * `camera.js` 가 끼어 있는 이유는 `game.js` 가 화면 맞춤 계산에 그 상수를 쓰기 때문이다.
 * 그 파일은 DOM 을 만지지 않고 스스로 「그림만 바꿀 뿐 물리에 손대지 않는다」고 적고 있다 —
 * 대신 진짜 파일을 올린다. 흉내 낸 값을 넣으면 검사가 자기 근거를 만들게 된다.
 */
export const MARBLE_SIM_FILES = [
  'rng.js',
  'trig.js',
  'physics.js',
  'parts.js',
  'courses.js',
  'camera.js',
  'game.js',
];

/** 출하되는 시뮬 파일의 원문 — 소스 수준 단정용 */
export function gameSource(slug: string, file: string): string {
  return readFileSync(resolve(GAMES_ROOT, slug, 'js', file), 'utf-8');
}
