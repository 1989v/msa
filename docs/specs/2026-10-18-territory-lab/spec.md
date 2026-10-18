<!-- source: portal-fe/public/games/territory-lab/engine.mjs -->
# 영역 / Territory — playable local sample

Approved scope: build a new sample before deciding the final online implementation. Existing games and the catalog stay outside this change. Risk L3: gameplay is covered by the user's explicit bounded sample request.

## Final product intent (preserved, not implemented or proven)

- A shared real-time territory world, open to joining at any time.
- Fill the world with bots while fewer than 30 people participate; bots yield as people join.
- No planned player cap. Capacity, networking, fairness and performance need a separate design and measurements; unlimited scale is not claimed.
- Huge world with random valid spawns; territory ownership and human competition drive play.
- Customize nickname, territory color/pattern and a plain text territory sign. Signs may eventually support a cosmetic advertising idea.
- Offline land retention, final death/respawn policy, advertising content policy and monetization, world persistence/partitioning, joining fairness and network scaling remain open decisions.

## Sample acceptance

- Self-contained static HTML/CSS/ES modules at `/games/territory-lab/`; no network dependency or build required.
- Truthful local label: one human slot and 29 AI. No online claims, API, backend or advertising integration.
- Finite 720×720-cell world; camera follows the human. Circular player markers (self ring/name), transparent upper-right top-ten ranking, paged five at a time every six active seconds with name, area and approximate player coordinates, area, position and world minimap.
- Every participant starts with 49 cells and moves at most one cell per 1000/12ms (12 cells/s). The human moves only while a keyboard direction or touch direction button is held; release stops in place without clearing the exposed trail. Opposite input to the last travelled direction stops movement, including after release; a fresh spawn may choose any first direction. No speed/area upgrades. Spawn patches cannot overlap land, trails or living heads.
- Leave owned land to create an exposed trail; reconnect to owned land to claim the trail and every region disconnected from the world boundary by owned land plus the closing trail (four-neighbor flood fill).
- Cut an opponent's exposed trail to eliminate its owner. Self-crossing, crossing the world boundary, head collisions and head swaps eliminate. Death clears that player's land and trail. Simultaneous conflicting capture cells become neutral.
- AI prioritizes reachable enemy exposed trails within 12 movement steps, avoids its own trail and uses expansion plans when no nearby cut is reachable. Solid territory is not an attack target.
- AI submits direction changes through the same movement API and uses the same collision/capture rules. AI deaths are replenished to 29 when free spawn space exists; exhaustion never causes overlap. Human respawn is explicit.
- Keyboard WASD/arrows and mobile directional buttons (most recently held direction wins, release restores any earlier hold; blur, hidden tabs, pause and pointer cancellation clear input); local pause, help and world reset. Help, cosmetic editing, focus loss and hidden tabs pause play.
- Presentation keeps the 720×720 logical grid but uses 10px desktop / 8px mobile display cells, contiguous territory surfaces with perimeter-only borders, sparse world-anchored patterns and continuous round trails. No per-cell background grid. Ranking has no backdrop, passes pointer input through, freezes page timing while paused and resets with the world.
- Nickname (16), sign (24), six colors and three patterns. Cosmetic values alone persist in guarded localStorage. Text uses DOM text/canvas text, never HTML. World state is ephemeral.

## Verification boundary

Pure-engine Node tests cover capture, deaths, simultaneous collisions/capture, spawn exhaustion, equal stats and a sustained seeded simulation. Syntax, scoped lint and HTTP module delivery are checked separately. Browser rendering, mobile interaction, canvas performance and accessibility require explicit computer-use approval and are not inferred from Node checks.

## Approved world/customization iteration

Default world is 720×720 (518,400 cells), with unchanged 10px desktop / 8px mobile display cells, 49-cell start and shared 12 cells/s movement. Minimap terrain and area recounts are invalidated by terrain mutations, rather than movement-only ticks; capture remains a full-world flood fill and browser performance is unmeasured.

Cosmetic preferences add solid/dashed ownership boundaries and built-in flag/star/leaf symbols. **간판 배치** pauses the match; click/tap an owned empty cell or choose **현재 위치에 배치**. Completed/cancelled placement remains paused until **계속하기**. Escape cancels. Up to three signs per human, each with a world anchor, owner and at most 24 plain-text characters; list controls apply the current text/symbol or delete an existing sign. No moving duplicate signage. Offscreen signs are culled and labels bounded to 168×19px. A lost anchor deletes the sign, without transferring it; death and world reset remove signs. Only cosmetic preferences persist, never world anchors. No remote assets, uploads or link actions.

## Approved fullscreen/speed iteration

All participants now move at 12 cells/s (1.5× the prior 8), with shared 1000/12ms ticks and unchanged held-input/reverse restrictions. The battlefield fills the dynamic viewport edge-to-edge without requesting native browser fullscreen. HUD, TOP10, status and touch direction controls float above the canvas; the logical720×720 world and10px/8px display cells remain.

**맵 보기** explicitly opens a bottom-right translucent, pointer-transparent minimap; **맵 닫기** closes it. Its terrain canvas has transparent empty space, softly opaque territory/markers and a viewport outline. Initial load and world reset close it; toggle text, `aria-expanded` and `aria-controls` stay synchronized. Hidden maps skip terrain/player redraw.

**꾸미기 · 설정** opens a scrollable collapsed-by-default drawer and pauses play. Closing never resumes play; close it and choose **계속하기**. Starting sign placement closes the drawer while leaving **현재 위치에 배치** and **배치 취소** in a separate field overlay. Completion/cancel stays paused. Small-screen and short-landscape CSS separates lower-left touch keys, lower-right map and upper-right standings; visual/input verification still needs explicit approval.
