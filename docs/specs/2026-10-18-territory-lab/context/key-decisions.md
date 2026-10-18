# Key decisions — 2026-10-18

- 2026-10-18 approved final public name: Korean **영역 전쟁**, English **zone-war**. Apply to the final online client's page title, entry branding and accessible battlefield name. Preserve `/games/territory/`, API/WebSocket contracts and comparison sample names; naming does not require an internal path migration.

- Decision: separate static playable sample, human + local AI. Reason: user wants to experience a sample before the final online build. Impact: only new territory-lab game/spec directories.
- Decision: sample uses finite 240×240 map, 49-cell starts, 8 cells/s, self-cross/boundary/head death and land clearing on death. Reason: concrete reversible rules for the local experiment, not final online policy.
- Decision: collisions resolve from pre-move state, head swaps eliminate both, concurrent capture claims conflict to neutral. Reason: remove insertion-order advantages for humans or AI.
- Decision: use pure engine + browser canvas shell. Reason: self-contained public asset, meaningful Node verification and no new dependencies.
- Decision: preserve huge open-joining world, bot fill below 30 and no planned player cap as future intent; scaling remains unproven. Offline retention and ads remain open.

- 2026-10-18 feedback: human movement is held input only; stopping preserves position and trail, with stationary heads remaining vulnerable. Existing automatic movement was caused by down-only UI events plus unconditional engine movement.
- 2026-10-18 feedback: AI attacks nearby exposed enemy trails using a bounded 12-step path search, avoiding its own exposed trail. Previous rectangular plans had no trail awareness. Same speed, collision and capture APIs remain in force.
- 2026-10-18 feedback: circular player markers replace arrows. World expands to 360×360 (2.25× area), with existing camera cell size and proportional minimap; parent chose world scale while awaiting optional clarification.

- 2026-10-18 follow-up: stopping retains the last travelled heading; opposite held input stops, even after release/repress. Before the first actual movement a human can choose any direction. Self-crossing and exposed-trail vulnerability remain unchanged.
- 2026-10-18 approved visual scope: keep the 360×360 logical map; reduce display cells to 10px desktop / 8px mobile, remove the per-cell grid, merge owner surfaces, draw perimeter/hole borders, use sparse continuous patterns and round connected trails. Canvas redraw follows requestAnimationFrame at display cadence; movement remains eight discrete cells/s, with no animation interpolation or measured browser-performance claim.
- 2026-10-18 approved standings: fully transparent upper-right in-field TOP 10, pages 1–5/6–10 every six active seconds; name, area and approximate current player XY, with self marker/weight and click-through overlay. Remove duplicate side ranking. Page timing freezes on pause and resets with world; no slide animation.

- 2026-10-18 approved next iteration: default world 720×720, display10px/8px and mechanics unchanged. Add selectable solid/dashed boundaries and max3 anchored plain-text/built-in-symbol signs. Placement/editor pauses; completion/cancel does not resume automatically. Lost anchor/death/reset deletes decorations. Only preferences persist. No online/backend/upload/ads scope. Terrain revision avoids movement-only minimap redraw/area scans; full capture scan remains bounded local implementation.

- 2026-10-18 approved fullscreen/speed feedback: shared12cells/s (1000/12ms),1.5× prior speed, with held input/reversal unchanged. Battlefield fills viewport without native fullscreen; compact floating HUD and closed settings drawer. Map starts/reset closed and toggles a translucent click-through lower-right overlay. Settings open pauses; close never auto resumes. Placement closes settings and retains separate current-position/cancel actions. No UI tools authorized.

- 2026-10-18 approved safe-reverse/compact-HUD feedback: shared16cells/s (62.5ms). Reverse is legal iff current and target cells are owned, validated against actual travel direction and again on tick. Rapid initial inputs can choose any direction. Personal upper-left stats become smaller/collapsible independently of pause/settings/help; thin26px chevrons use44px targets with accessible names/state. Stats reset expanded and map reset closed. TOP10/full-viewport geometry remain unchanged. No UI tooling within this implementation.
