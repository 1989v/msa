# Spec — Pixel Office View

**Date**: 2026-04-11
**Scope**: `agent-viewer/front/src/office/` (new module)
**Depends on**: `requirements.md` (same folder)

## 1. Architecture Overview

새 디렉토리 `front/src/office/`에 Canvas 기반 렌더러를 캡슐화한다.
React는 `<OfficeView>` 컨테이너만 소유하고, 내부는 순수 TS 게임 모듈이 담당한다.

```
front/src/
├── App.tsx                       # viewMode === 'office' 분기 추가
├── components/
│   ├── Sidebar/Sidebar.tsx       # Office 버튼 추가
│   └── OfficeView/               # [NEW]
│       ├── OfficeView.tsx        # 컨테이너 (canvas mount, resize, click 핸들러)
│       └── OfficeView.module.css
├── office/                       # [NEW] — 순수 TS 게임 모듈
│   ├── types.ts                  # Tile, Character, World, Direction, ...
│   ├── constants.ts              # TILE_SIZE, COLORS, TIMINGS, ...
│   ├── layout/
│   │   ├── buildLayout.ts        # Team → zones, desks, seats 배치
│   │   └── tileMap.ts            # 2D 타일 배열 조작 헬퍼
│   ├── engine/
│   │   ├── world.ts              # World 상태 생성/업데이트
│   │   ├── gameLoop.ts           # rAF 루프, dt 전달
│   │   ├── pathfinding.ts        # BFS
│   │   ├── characters.ts         # 상태머신 tick
│   │   └── mapAgentState.ts      # 스토어 → Character 상태 매핑
│   ├── render/
│   │   ├── renderer.ts           # draw world → canvas
│   │   ├── sprites.ts            # 캐릭터 픽셀 데이터
│   │   ├── tiles.ts              # 타일·카펫 그리기
│   │   ├── furniture.ts          # desk/chair/sofa/ceo 그리기
│   │   └── bubbles.ts            # 말풍선 렌더
│   └── index.ts                  # 퍼블릭 API
├── hooks/
│   └── useKeyboardShortcuts.ts   # '4' 키 추가
├── store/useAppStore.ts          # ViewMode 타입에 'office' 추가는 types/index.ts에서 처리
└── types/index.ts                # ViewMode = 'session'|'team'|'task'|'office'
```

## 2. Types (office/types.ts)

```ts
export const TILE_SIZE = 16           // logical px
export const RENDER_SCALE = 2         // 16 → 32 rendered

export type Direction = 0 | 1 | 2 | 3 // DOWN LEFT RIGHT UP

export const TileType = {
  VOID:      0,  // empty (no floor)
  FLOOR:     1,
  CARPET_A:  2,  // team-colored carpet tile
  CARPET_B:  3,
  WALL:      4,
  BREAK:     5,  // break zone tile
  CEO:       6,  // CEO room tile
} as const
export type TileType = (typeof TileType)[keyof typeof TileType]

export interface Seat {
  uid: string
  col: number
  row: number
  facing: Direction
  deskUid: string
  teamId: string
}

export interface Furniture {
  uid: string
  type: 'desk' | 'chair' | 'sofa' | 'plant' | 'whiteboard' | 'vendingMachine' | 'ceoDesk'
  col: number
  row: number
  w: number                    // tile footprint
  h: number
  color?: string               // team tint
  facing?: Direction
}

export const CharState = {
  IDLE:    'idle',      // seated, no activity
  TYPE:    'type',      // seated, typing animation (working)
  READ:    'read',      // seated, reading animation
  WALK:    'walk',      // moving along path
  WANDER:  'wander',    // resting, strolling
  WAITING: 'waiting',   // seated + ❓ bubble
  QUEUED:  'queued',    // in CEO line
} as const
export type CharState = (typeof CharState)[keyof typeof CharState]

export interface Character {
  agentId: string              // maps to Agent.id
  spriteType: string           // maps to PixelSprite type (warrior/mage/...)
  teamId: string
  teamColor: string

  // position (pixel)
  x: number
  y: number
  tileCol: number
  tileRow: number

  // movement
  state: CharState
  dir: Direction
  path: Array<{ col: number; row: number }>
  moveProgress: number         // 0..1 between tiles
  moveSpeed: number            // tiles/sec

  // animation
  frame: number
  frameTimer: number
  wanderTimer: number          // seconds until next wander decision

  // assignment
  seatId: string | null

  // visual
  bubble: 'waiting' | 'permission' | null
  isSubagent: boolean
  parentAgentId: string | null
  spawnTimer: number           // for matrix-spawn fade-in, counts down 0..1

  // for name tag / hover
  name: string
  role: string
}

export interface World {
  cols: number
  rows: number
  tiles: TileType[]            // length cols*rows
  furniture: Furniture[]
  seats: Seat[]
  breakTiles: Array<{ col: number; row: number }>
  ceoQueueTiles: Array<{ col: number; row: number }>
  characters: Map<string, Character>
}
```

## 3. Layout Generation (office/layout/buildLayout.ts)

### Algorithm
1. 전체 캔버스를 `cols=40, rows=24` 타일로 고정 (640×384 logical → 1280×768 rendered).
2. 상단 3행: CEO Room (`CEO` tiles) + CEO desk 1개 + queue path(8 tiles).
3. 하단 3행: Break Zone (`BREAK` tiles) + sofa×2 + plant×4 + vending machine×1.
4. 가운데 영역(y=3..20): 팀별 구역 배치.
   - 팀 개수 N으로 가로·세로 grid (N≤6이면 3×2, N≤9이면 3×3, 그 외 4×3).
   - 각 구역은 `CARPET_A`/`CARPET_B` 체크무늬로 바닥 구분 + `team.color` 20% 오버레이.
   - 구역 내부에 `ceil(teamAgents.length / 2)` 개의 desk를 2열로 배치.
   - 각 desk 앞(row+1) 타일이 seat가 되고, `facing = UP` (desk를 바라봄).
5. 벽(`WALL`)은 캔버스 테두리 + CEO/Break zone 경계.

### Helpers
```ts
buildDefaultLayout(teams: Team[], agents: Agent[]): World
assignSeats(world: World, agents: Agent[]): Map<string, string>  // agentId → seatId
```

## 4. Game Loop (office/engine/gameLoop.ts)

```ts
export function startGameLoop(world: World, render: (w: World) => void) {
  let last = performance.now()
  let rafId = 0
  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05) // clamp 50ms
    last = now
    updateWorld(world, dt)
    render(world)
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}
```

`updateWorld(world, dt)`:
1. 각 Character에 대해 `tickCharacter(c, dt, world)` 호출
2. `spawnTimer` 감소 (sub-agent fade-in)

## 5. Character State Machine (office/engine/characters.ts)

### Transitions (driven by external `desiredState`)
외부에서 매 프레임 `mapAgentState()` 결과로 `c.desiredState`를 설정. tick 내부에서:

| current \ desired | idle    | type      | waiting | queued  | subagent |
|-------------------|---------|-----------|---------|---------|----------|
| `walk` → target   | →`idle` (at seat) | →`type` (at seat) | →`waiting` | →`queued` (at queue tile) | same |
| at seat, idle     | maybe wander after `wanderTimer` | start TYPE animation | show bubble | start walking to queue | |
| at seat, type     | stop animation, revert to idle | continue | show bubble, keep seated | walk out | |
| wander            | continue wander, return to seat after N steps | **walk back to seat** (forced) | walk to seat, show bubble | walk to queue | |
| queued            | stay in line | keep queued (higher priority wins) | keep queued | keep queued | |

### Wander behavior
- `idle`이 seat에 있고 `wanderTimer <= 0`이면 30% 확률로 `breakTiles` 중 랜덤 하나를 target으로
  `findPath` 호출 후 `WANDER` 상태로 전환.
- `WANDER` 도착 후 2~5초 대기 → 다음 breakTile 또는 seat 중 랜덤 선택.
- `desiredState !== idle`로 변경되면 즉시 seat로 복귀.

### Animation frame update
- `frameTimer += dt`; 0.25초마다 `frame = (frame + 1) % 2` (2프레임 애니메이션)
- `TYPE` 상태일 때는 0.15초 간격 (빠른 타이핑)

## 6. Pathfinding (office/engine/pathfinding.ts)

```ts
export function findPath(
  world: World,
  from: { col: number; row: number },
  to: { col: number; row: number }
): Array<{ col: number; row: number }>
```

- BFS on walkable tiles (`FLOOR | CARPET_A | CARPET_B | BREAK | CEO`).
- 장애물: `WALL`, `VOID`, 가구 점유 타일(단, seat tile은 자신의 seat이면 통과 가능).
- 4-directional (no diagonal).
- 실패 시 빈 배열 반환.

## 7. Renderer (office/render/renderer.ts)

### Pipeline per frame
1. `ctx.imageSmoothingEnabled = false` (pixelated)
2. `ctx.clearRect` + 배경색(`#0b0f14` 진한 남색)
3. Draw tiles (bottom layer)
4. Draw furniture sorted by `row + h` (depth sort)
5. Draw characters sorted by `tileRow + (state === WALK ? moveProgress : 0)`
6. Draw bubbles (top layer)
7. Draw hover outline on hovered tile / selected character

### Character drawing
기존 `PixelSprite` SVG와 동일한 색 팔레트로 Canvas path 그리기. `drawCharacter(ctx, char, palette)`:
- 머리/몸통/팔/다리 rect들 (pixel-perfect)
- `state === WALK`이면 `frame % 2`에 따라 다리 오프셋 ±1px
- `state === TYPE`이면 팔 오프셋 ±1px

### 스프라이트 캐시 (선택)
첫 프레임에 각 `spriteType` × 4방향 × 2프레임 = 최대 80개 `OffscreenCanvas`로 bake.
`drawCharacter`는 `drawImage(cache[type][dir][frame], x, y)`.
브라우저가 `OffscreenCanvas`를 지원하지 않으면 일반 `HTMLCanvasElement`로 fallback.

## 8. Data Binding (office/engine/mapAgentState.ts)

```ts
export function syncWorldWithStore(world: World, snapshot: StoreSnapshot): void
```

**StoreSnapshot** (useAppStore에서 뽑아서 전달):
```ts
{
  agents: Agent[],
  liveSessions: LiveSession[],
  liveSubagents: LiveSubagent[],
  notifications: Notification[],
}
```

로직:
1. 새로 추가된 agent → Character 생성 + seat 할당 + `spawnTimer = 1`
2. 제거된 agent → Character 삭제
3. 각 Character의 `desiredState` 계산:
   - 해당 agent가 `notifications`에 `actionRequired: true`를 가지면 → `QUEUED`
   - 연관된 `liveSession.status === 'waiting'` → `WAITING`
   - `agent.status === 'working'` → `TYPE`
   - 그 외 → `IDLE`
4. `liveSubagents`의 각 active sub-agent를 위해 별도 Character 확보
   (`isSubagent = true`, `parentAgentId` 설정). 부모 seat 주변 타일에 스폰.
5. inactive sub-agent는 Character를 제거(페이드아웃은 spawnTimer 역방향으로 처리).

## 9. React Integration (components/OfficeView/OfficeView.tsx)

```tsx
export function OfficeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const agents = useAppStore(s => s.agents)
  const teams = useAppStore(s => s.teams)
  const liveSessions = useAppStore(s => s.liveSessions)
  const liveSubagents = useAppStore(s => s.liveSubagents)
  const notifications = useAppStore(s => s.notifications)
  const selectAgent = useAppStore(s => s.selectAgent)

  // Mount: build world + start loop
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const world = buildDefaultLayout(teams, agents)
    worldRef.current = world
    const render = (w: World) => drawWorld(ctx, w)
    const stop = startGameLoop(world, render)
    return stop
  }, [])   // build once

  // Sync store → world every render
  useEffect(() => {
    if (!worldRef.current) return
    syncWorldWithStore(worldRef.current, {
      agents, liveSessions: [...liveSessions.values()],
      liveSubagents: [...liveSubagents.values()], notifications,
    })
  }, [agents, liveSessions, liveSubagents, notifications])

  // Click handler
  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const world = worldRef.current
    if (!world) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const px = (e.clientX - rect.left) / RENDER_SCALE
    const py = (e.clientY - rect.top) / RENDER_SCALE
    const hit = pickCharacter(world, px, py)
    if (hit) selectAgent(hit.agentId)
  }

  return (
    <div className={styles.root}>
      <canvas
        ref={canvasRef}
        width={world.cols * TILE_SIZE}
        height={world.rows * TILE_SIZE}
        style={{ width: '100%', imageRendering: 'pixelated' }}
        onClick={onClick}
      />
    </div>
  )
}
```

OfficeGrid.tsx의 `viewMode === 'office'` 분기 또는 App.tsx에서 직접 분기 중 하나로
`<OfficeView />` 마운트. (OfficeGrid에서 분기하는 편이 기존 구조와 일관.)

## 10. Sidebar & Shortcuts

### Sidebar.tsx diff
```ts
const VIEW_MODES: { mode: ViewMode; label: string; key: string }[] = [
  { mode: 'session', label: 'Sessions', key: '1' },
  { mode: 'team',    label: 'Org Chart', key: '2' },
  { mode: 'task',    label: 'Tasks',     key: '3' },
  { mode: 'office',  label: 'Office',    key: '4' },   // NEW
]
```

Filter section에서 `viewMode === 'office'`일 때 team filter와 동일한 체크박스 리스트 재사용.

### useKeyboardShortcuts.ts diff
```ts
case '4':
  setViewMode('office')
  break
```

## 11. Sprite Palette

기존 `SPRITE_CONFIGS`를 office 모듈에서 import하여 그대로 재사용.
Canvas 그리기 함수는 `color / accentColor / skinColor` 3색을 받아
동일한 16×16 픽셀 패턴을 그린다. SVG → Canvas로 "포팅"이지 새 디자인 아님.

## 12. Performance Budget

- Agents: 최대 30
- Sub-agents: 최대 20 concurrent
- Canvas: 640×384 logical (1280×768 render) — 작음
- Target: 60fps on MacBook Air M1, degradation fallback 30fps 허용
- 스프라이트 캐시 도입 시 매 프레임 `drawImage` 50회 수준 → 충분

## 13. Error Handling

- Canvas 2D context 획득 실패 시 → fallback message "Canvas not supported"
- Path not found → 캐릭터는 현 위치 유지, 다음 tick에 재시도
- Seat 개수가 agent 수보다 적으면 → 초과 agent는 break zone에 방치 (디버그 경고)

## 14. Testing

| File                                   | Test           |
|----------------------------------------|----------------|
| `office/engine/pathfinding.test.ts`    | BFS 정확성, 장애물, 불가능 |
| `office/engine/characters.test.ts`     | 상태 전환, wander, 대기 |
| `office/engine/mapAgentState.test.ts`  | 스토어 → desired state 매핑 |
| `office/layout/buildLayout.test.ts`    | seat 수 == agent 수, zone 겹침 없음 |
| `components/OfficeView.test.tsx`       | mount, click dispatch |

Vitest는 기존 프로젝트에 없을 경우 devDependency로 추가. 없으면 최소
수동 테스트(screenshots)로 대체. → Open question.

## 15. Migration / Rollout

- Feature flag 불필요. 새 뷰는 기존 뷰와 병렬 존재.
- 기존 뷰는 변경 없음 → 회귀 리스크 낮음.
- 롤백: `OfficeView` 마운트 분기 제거 + Sidebar 버튼 제거 (2 파일 revert).

## 16. File Summary

**New files** (~15):
- `front/src/components/OfficeView/OfficeView.tsx` + css
- `front/src/office/{types,constants,index}.ts`
- `front/src/office/layout/{buildLayout,tileMap}.ts`
- `front/src/office/engine/{world,gameLoop,pathfinding,characters,mapAgentState}.ts`
- `front/src/office/render/{renderer,sprites,tiles,furniture,bubbles}.ts`

**Modified files** (3):
- `front/src/types/index.ts` — `ViewMode += 'office'`
- `front/src/components/Sidebar/Sidebar.tsx` — Office 버튼 + filter 리스트
- `front/src/components/OfficeGrid/OfficeGrid.tsx` — `'office'` 분기 → `<OfficeView />`
- `front/src/hooks/useKeyboardShortcuts.ts` — `'4'` 키

No backend / no store signature change.
