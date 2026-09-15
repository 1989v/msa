# `window.__forge` — 결정론적 스텝 API 계약

게임이 이 객체를 노출해야 검증기(`forge/play.mjs`·`forge/gate.mjs`)가 게임을 **실제 입력으로** 조작하고
값을 읽는다. **이 API 가 없으면 검증도 완성 판정도 없다.** 첫 실행 가능 시점에 가장 먼저 붙인다.

설계 원칙: 검증기는 게임의 주장을 믿지 않고 **게임이 내놓은 값**을 본다. 그래서 대부분의 메서드는
"상태를 읽는 것"이고, 조작은 실제 `KeyboardEvent`/`TouchEvent` 로 들어온다. 이 API 로 입력을
주입하는 메서드는 없다.

## 필수 메서드

| 메서드 | 동작 | 검증기가 어디에 쓰나 |
|---|---|---|
| `version` | 숫자 `1` | 계약 판별 |
| `reset(seed)` | 게임 전체를 타이틀로 초기화. **같은 seed 면 같은 난수열** (시드 RNG 필수, `Math.random` 금지) | 죽은 입력 감사 (같은 seed 로 두 번 돌려 비교) |
| `begin()` | 타이틀 → 1스테이지 플레이 즉시 진입 (메뉴·컷신 건너뜀). 플레이어 만피 | 모든 시나리오의 출발 |
| `warp(stageId)` | 해당 스테이지 시작 상태로 즉시 이동. 플레이어 만피 | 스테이지 샘플링·보스 촬영 |
| `pause()` | **시뮬레이션만** 정지. 렌더는 계속 (스크린샷 가능) | 가속 봇 |
| `step(n=1)` | pause 상태에서 고정 dt(1/60s) 로 시뮬레이션 n 번 전진 후 1회 렌더. 그 사이 들어온 실제 키/터치 상태를 소비한다 | 봇·죽은 입력 감사·히트 시퀀스 |
| `resume()` | 실시간 루프로 복귀 | fps 측정 |
| `state()` | 아래 스냅샷. **JSON 직렬화 가능**해야 한다 | 거의 전부 |
| `probe()` | `{ canvas:{ w, h, cssW, cssH }, player:{ x, y, w, h } }` — 캔버스 픽셀 좌표의 화면상 플레이어 박스 | 모바일 CSS px 판정 |
| `controls()` | 아래 조작 선언. **현재 뷰포트 기준 CSS px**. 리사이즈 후 다시 부르면 새 좌표 | 죽은 입력 감사(키·터치) |
| `content()` | 아래 콘텐츠 선언 | 규모 하한·샘플링 |
| `spawn(enemyType, opts?)` | 적 1기 생성. `opts.near===true` 면 **플레이어 공격 사거리 안, 바라보는 방향**에 | 적 종 촬영·타격 확인 |
| `audio()` | `{ sfx:[이름…], music:[이름…] }` — 합성/재생 가능한 소리의 선언 | 소리 축(선언) — 실제 재생 수는 드라이버가 센다 |
| `feel()` | `{ hitstopMs, shakePx, telegraphMs }` — 타격 정지·흔들림·적 공격 예고 시간 | 게임필 축(자기 보고, 사람이 히트 시퀀스 스크린샷으로 확인) |
| `canvas()` | 메인 캔버스 요소. 없으면 `document.querySelector('canvas')` 를 쓴다 | 축소본 비교 |

## `state()` 스냅샷

```js
{
  scene: 'title' | 'play' | 'paused' | 'gameover' | 'clear' | 'cutscene' | 'menu',
  stage: { id: 'S1', index: 0, cleared: false },
  player: { x, y, hp, hpMax, facing: 1 | -1, action: 'idle' | 'run' | 'attack1' | ... },
  enemies: [ { type: 'grunt', x, y, hp, hpMax } ],
  progress: { stagesCleared: 0, kills: 0 },
  score: 0,
  simTime: 12.35            // 시뮬레이션 초 (step 이 전진시키는 시계)
}
```

- `enemies` 는 **살아 있는 적**만. 보스도 여기에 (type 이 `content().bosses[].id` 중 하나).
- 플레이어가 죽으면 `player.hp <= 0` 이거나 `scene === 'gameover'`. 둘 중 하나면 죽은 것으로 본다.
- 스테이지를 깨면 `progress.stagesCleared` 가 오르고 `stage.cleared === true`.

## `controls()`

```js
{
  keyboard: [ { code: 'ArrowLeft', action: 'left' }, { code: 'KeyZ', action: 'attack' }, ... ],
  touch: {
    stick:   { x, y, r },                       // 가상 스틱 중심·반지름 (없으면 생략)
    dpad:    [ { action: 'left', x, y, r }, … ], // 방향 버튼 (스틱 대신)
    buttons: [ { action: 'attack', x, y, r }, … ] // 행동 버튼
  }
}
```

- `code` 는 `KeyboardEvent.code`. 드라이버는 이 코드를 **실제 `Input.dispatchKeyEvent`** 로 보낸다.
- 터치 좌표는 **CSS px, 뷰포트 기준**. 화면이 세로/가로로 바뀌면 값도 바뀐다.
- 여기 선언한 모든 입력은 **플레이어 상태를 바꿔야 한다** — 같은 seed 에서 입력 없이 15 스텝 간 결과와
  입력 있이 15 스텝 간 결과의 `player` 가 같으면 죽은 입력이다.

## `content()`

```js
{
  stages:     [ { id: 'S1', name: '성문' }, … ],       // warp 가 전부 갈 수 있어야 한다
  enemyTypes: [ 'grunt', 'archer', … ],                 // spawn 이 전부 만들 수 있어야 한다
  bosses:     [ { id: 'warden', stage: 'S5', phases: 2 } ],
  skills:     [ 'slash', 'uppercut', … ],
  items:      [ … ],
  secrets:    3
}
```

선언은 곧 검사 대상이다 — 선언만 하고 warp/spawn 이 못 만들면 그 축은 FAIL 이다.

## 입력 처리 규칙 (계약의 일부)

- `keydown`/`keyup`·터치 이벤트는 **입력 상태만 기록**한다. 판정(공격 발동 등)은 `step` 안에서 한다.
  이벤트 핸들러에서 직접 판정하면 120Hz 화면에서 edge-trigger 입력이 유실된다(실측 사고).
- 게임 루프는 `requestAnimationFrame` + 고정 dt 누산기. `step(n)` 은 그 누산기를 직접 n 번 돌린다.
- `Math.random` 을 쓰지 않는다. `reset(seed)` 가 시드를 넣는 RNG 하나를 **시뮬레이션의** 모든 난수가 쓴다.
  렌더(흔들림·파티클 지터·배경음 변주)는 그 RNG 를 소비하면 안 된다 — 렌더 횟수는 벽시계에 달려 있어 같은 seed 로 다른 판이 된다. 시각용 RNG 를 따로 둔다.
- `alert`/`prompt`/`confirm` 을 쓰지 않는다 — 검증기가 멈추고, 샌드박스 iframe 에서는 조용히 죽는다.

## 최소 구현 골격

```js
window.__forge = {
  version: 1,
  reset: (seed) => game.reset(seed),
  begin: () => game.begin(),
  warp: (id) => game.warp(id),
  pause: () => { loop.paused = true; },
  step: (n = 1) => { for (let i = 0; i < n; i++) game.update(1 / 60); game.render(); },
  resume: () => { loop.paused = false; },
  state: () => game.snapshot(),
  probe: () => ({ canvas: { w: cv.width, h: cv.height, cssW: cv.clientWidth, cssH: cv.clientHeight }, player: game.playerScreenBox() }),
  controls: () => input.describe(),
  content: () => CONTENT,
  spawn: (type, opts) => game.spawn(type, opts),
  audio: () => ({ sfx: Object.keys(SFX), music: Object.keys(MUSIC) }),
  feel: () => ({ hitstopMs: 60, shakePx: 4, telegraphMs: 350 }),
  canvas: () => cv,
};
```
