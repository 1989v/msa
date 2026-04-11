# Tasks — Pixel Office View

**Date**: 2026-04-11
**Depends on**: `spec.md`

Implementation order is strict — each group depends on the previous one for manual verification.

---

## T1. Scaffold & Type Additions (foundation)

**Files**
- `front/src/types/index.ts` — `ViewMode = 'session' | 'team' | 'task' | 'office'`
- `front/src/office/types.ts` — Direction, TileType, Seat, Furniture, CharState, Character, World
- `front/src/office/constants.ts` — TILE_SIZE, RENDER_SCALE, COLORS, TIMINGS, layout dims
- `front/src/office/index.ts` — barrel

**Done when**
- `pnpm tsc --noEmit` passes
- `ViewMode` extension visible to all existing consumers (TS error surface is empty)

---

## T2. Layout Generator

**Files**
- `front/src/office/layout/tileMap.ts` — `idx(col,row)`, `setTile`, `getTile`, `isWalkable`
- `front/src/office/layout/buildLayout.ts` — `buildDefaultLayout(teams, agents) → World`
- `front/src/office/layout/buildLayout.test.ts` (if vitest available, else defer)

**Done when**
- `buildDefaultLayout` returns a World where:
  - CEO room occupies top rows, break zone bottom rows, team zones middle
  - Each team has carpet tiles + desks/seats count ≥ agents count
  - `world.seats.length >= agents.length`
  - No two furniture overlap, no furniture on WALL/VOID

---

## T3. Static Render (tiles + furniture, no characters)

**Files**
- `front/src/office/render/tiles.ts` — draw tile, draw grid lines (debug), team carpet tint
- `front/src/office/render/furniture.ts` — draw desk, chair, sofa, plant, whiteboard, vending, ceoDesk
- `front/src/office/render/renderer.ts` — `drawWorld(ctx, world)` pipeline (tiles → furniture)
- `front/src/components/OfficeView/OfficeView.tsx` — mount canvas, build world once, render once
- `front/src/components/OfficeView/OfficeView.module.css` — container styles, pixelated rendering
- `front/src/components/OfficeGrid/OfficeGrid.tsx` — add `viewMode === 'office'` branch
- `front/src/components/Sidebar/Sidebar.tsx` — add `Office` button to `VIEW_MODES`
- `front/src/hooks/useKeyboardShortcuts.ts` — add `'4'` key

**Done when**
- Browser: click `Office` button → canvas shows tiled floor, team zones, CEO desk top, break zone bottom, all furniture visible
- No game loop yet (static render)
- Other 3 views unchanged

---

## T4. Character Sprites (bake + draw)

**Files**
- `front/src/office/render/sprites.ts` — `drawCharacterPixels(ctx, x, y, palette, frame, dir)`
  - Port `PixelSprite.tsx` SVG rect layout to Canvas path commands
  - Walking: left/right foot offset by frame
  - Typing: left/right arm offset by frame
- `front/src/office/render/spriteCache.ts` — optional `OffscreenCanvas` bake of all variants

**Done when**
- Static render: each seat has a seated character facing UP (toward desk)
- Hover (no click) shows no change yet — interactivity deferred
- Characters match existing SVG style visually

---

## T5. Game Loop (tick + rAF)

**Files**
- `front/src/office/engine/world.ts` — world mutation helpers (`moveCharacter`, `setCharState`)
- `front/src/office/engine/gameLoop.ts` — `startGameLoop(world, render) → stopFn`
- `front/src/office/engine/characters.ts` — `tickCharacter(c, dt, world)` (animation frame only at first)

**Done when**
- Characters animate (2-frame idle bob) continuously at ~60fps
- `useEffect` cleanup stops the loop on unmount without leaks (DevTools Memory)

---

## T6. Pathfinding + Walking

**Files**
- `front/src/office/engine/pathfinding.ts` — BFS `findPath(world, from, to)`
- `front/src/office/engine/characters.ts` — extend tick with WALK state lerp:
  - `moveProgress += moveSpeed * dt`
  - On 1.0 → pop path head, update `tileCol/tileRow`
  - On empty path → transition to target state
- Temporary test command: click empty floor tile → send selected character there

**Done when**
- Click-walk demo works (even if removed later)
- Character visibly walks tile to tile, smoothly
- BFS avoids walls + furniture

---

## T7. State Machine + Wander

**Files**
- `front/src/office/engine/characters.ts`:
  - IDLE seat + `wanderTimer ≤ 0` → maybe start wander to random break tile
  - WANDER → idle at break tile 2-5s → next break or seat
  - desiredState change to TYPE/WAITING/QUEUED while wander → path back to seat first
- `front/src/office/engine/characters.test.ts` (vitest if available)

**Done when**
- Watching the canvas: seated idle characters leave, walk to break zone, wander, return
- Toggling an agent's status (dev console) forces them back to seat

---

## T8. Store Sync (data binding)

**Files**
- `front/src/office/engine/mapAgentState.ts`:
  - `syncWorldWithStore(world, snapshot)` — add/remove characters, compute `desiredState`
  - Priority: QUEUED > WAITING > TYPE > IDLE
- `front/src/components/OfficeView/OfficeView.tsx` — second `useEffect` that calls sync on store changes

**Done when**
- Changing `agent.status` in dev tools (via zustand) propagates to character
- `liveSessions` with `waiting` status trigger `WAITING` bubble
- `notifications.actionRequired` routes character to CEO queue

---

## T9. Bubbles & Visual States

**Files**
- `front/src/office/render/bubbles.ts` — `drawBubble(ctx, x, y, type)` for `waiting` (?) and `permission` (📋)
- Update `renderer.ts` pipeline: characters → bubbles (top layer)
- Hover outline: on hovered character, draw yellow 1px rect
- Selected outline: when `selectedAgentId === c.agentId`, draw cyan 2px rect

**Done when**
- Bubbles visible above correct characters
- Hover / selection outlines work

---

## T10. Click → Select Agent

**Files**
- `front/src/components/OfficeView/OfficeView.tsx`:
  - `onClick` handler: translate client coords → logical px → pick character
  - Call `selectAgent(hit.agentId)` from store
- `front/src/office/engine/pick.ts` — `pickCharacter(world, px, py) → Character | null`

**Done when**
- Clicking a character opens `ProfilePanel` (existing behavior)
- Clicking empty tile deselects (optional)

---

## T11. Sub-agent Spawn / Despawn

**Files**
- `front/src/office/engine/mapAgentState.ts` — handle `liveSubagents` create/destroy
- `front/src/office/render/effects.ts` — `drawSpawnEffect(ctx, x, y, progress)` simple matrix-like vertical bars
- `front/src/office/engine/characters.ts` — `spawnTimer` lifecycle

**Done when**
- Firing `SUBAGENT_START` ws event → sub-agent character appears beside parent
- `SUBAGENT_STOP` → fade out + removed

---

## T12. Manual QA + Polish

- 4개 뷰 토글 전환 확인
- `pnpm build` 성공
- `pnpm lint` 통과 (`eslint.config.js` 기준)
- 기존 3개 뷰 diff 없음 확인 (`git diff --stat` 한정)
- README/CLAUDE.md의 agent-viewer 섹션이 있다면 office 뷰 한 줄 추가 (없으면 skip)

**Done when**
- User walks through AC1~AC11 from requirements.md and all pass

---

## Dependency graph

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
                           ↓
                          T8 → T9 → T10 → T11 → T12
```

T9/T10/T11은 서로 병렬 가능하지만 T8 이후에만.

## Estimated effort

| Task | Effort |
|------|--------|
| T1   | 30 min |
| T2   | 2 h    |
| T3   | 3 h    |
| T4   | 2 h    |
| T5   | 1 h    |
| T6   | 2 h    |
| T7   | 2 h    |
| T8   | 2 h    |
| T9   | 1 h    |
| T10  | 1 h    |
| T11  | 2 h    |
| T12  | 1 h    |
| **Total** | **~20 h** |

단일 세션으로는 무리이며, T5 또는 T8 이후에 커밋 & 중간 확인을 권장.
