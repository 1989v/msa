# Territory sample tasks

- [x] Read root design/agent standards and preserve final product intent separately from sample assumptions.
- [x] Implement standalone engine: spawn, uniform movement, trail death, flood fill, simultaneous collisions, AI replenishment.
- [x] Build responsive arcade field, camera, minimap, ranking and keyboard/touch controls.
- [x] Add safe cosmetics, guarded local persistence, pause/help/reset/respawn.
- [x] Verify nine engine cases, including 1,800 ticks of seeded invariants.
- [x] Complete focused independent review (SHIP), scoped static checks and HTTP delivery check (all 200).
- [x] Commit only new sample/spec files and their games submodule pointer, preserving unrelated staged work.
- [x] Address held-input and AI trail-attack feedback; circular markers and 360×360 world with proportional minimap.
- [x] Verify 18 engine/input tests (including 1,800 seeded ticks), syntax and scoped ESLint; independent review SHIP.
- [x] Reproduce and prevent reverse-after-stop trail death; preserve self-crossing and enemy attacks.
- [x] Merge territory rendering, remove per-cell seams/grid, add round connected trails and transparent paged TOP 10 with approximate coordinates.
- [x] Verify 25 engine/input/geometry/paging cases, nine MJS syntax checks and scoped lint (zero errors).
- [ ] Browser visual/input review — requires separate explicit user approval; outside current non-UI evidence.

Final online build is a separate future task: persistent shared world, always-open joining, bot replacement by people, load measurements, retention/death decisions and advertising policy.

- [x] Expand default world to 720×720; preserve camera/movement and cache minimap/area work on terrain revisions.
- [x] Add solid/dashed boundaries and built-in symbol signs anchored to owned cells, max 3, with paused placement/current-position/cancel, edit/remove and ownership-loss cleanup.
- [x] Verify 33 engine/input/cosmetic/geometry/paging tests, including seeded 720 simulation. Static checks and fresh review recorded in progress.

- [x] Increase shared movement to12cells/s; fill viewport with floating HUD and collapsed settings.
- [x] Default/reset minimap closed; accessible map toggle and transparent bottom-right click-through overlay.
- [x] Keep drawer/placement paused and placement controls reachable; non-UI shell regression plus33existing cases.
