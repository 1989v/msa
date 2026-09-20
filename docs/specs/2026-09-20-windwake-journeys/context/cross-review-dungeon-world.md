<!-- source: windwake/dungeons.mjs -->
<!-- source: windwake/world.mjs -->
<!-- source: windwake/render.mjs -->
<!-- source: windwake/tests/dungeons.test.mjs -->
<!-- source: windwake/tests/world.test.mjs -->
<!-- source: windwake/tests/dungeon-routes.mjs -->

# Independent dungeon/world implementation review

Verdict: **SHIP** after the independently verified camera obstruction correction below. Reviewer is the settlement/life implementation owner; this review covers other authors' dungeon, world and renderer modules only. No runtime changes were made by this reviewer. No unresolved blocking findings remain in this scope.

## Resolved blocking finding

**Camera enters a dungeon wall from a legal player position.** `render.mjs:updateCamera` applies `Math.max(0.8, r - 0.3)` after finding an obstruction. That minimum can place the final eye beyond the obstruction. Reproduction: enter `dungeon-sunfields`, stand in the entry room at `(8.9, 0, 0)`, and use camera `{yaw: -Math.PI/2, pitch: .35, distance: 8}`. The renderer produces eye `(9.651497840881348, 1.5243182182312012, 0)`, inside `dungeon-sunfields:entry:east:0` (wall x extent 9.5–10.5, y extent 0–8). The player position is outside the wall and reachable normally. This breaks the scene collision/camera contract when approaching a wall or gate. Reported directly to the world/render owner and primary integrator.

Resolution: the renderer owner replaced the coarse samples and hard minimum with a segment test against expanded authoritative AABBs. The envelope includes near-plane clearance; final shake participates in the same collision ray, and obstructed camera-target interpolation resets to the player anchor. Independently rerunning the original case gives eye `(9.300951957702637, 1.3963589668273926, 0)`, safely outside the east wall. A separate reviewer probe passed **138 legal wall/closed-door camera cases** across all four dungeons, three pitch angles and shake on/off, with no eye inside solids, no collapsed camera and no eye beneath the floor. The owner regression additionally checks all four actual near-plane corners at a wall, corner, closed door and low ceiling for twelve shake frames. The initial door test fixture was corrected because it stood inside a corridor wall; the corrected fixture approaches the door along its thin axis.

## Evidence that passed

- `node --test --test-reporter=spec windwake/tests/dungeons.test.mjs windwake/tests/world.test.mjs`: **25 tests, 25 pass, 0 fail**. Includes real chamber connectivity, sealed doors, shared render/collision geometry, physical two-step ascent, retryable runes/relays/blocks, reward receipts, invalid saves, town roads/clearings, 24 renderer scene transitions, CPU/GPU limits and complete buffer disposal.
- After the camera correction, `node --test --test-reporter=spec windwake/tests/world.test.mjs`: **13 tests, 13 pass, 0 fail**, including the new eye/near-plane collision regression. No dungeon/world domain code changed after the earlier 25-test and natural-route checks.
- `node windwake/tests/dungeon-routes.mjs`: **DUNGEON NATURAL ROUTES PASS**. All four routes walk from a fresh world spawn to the physical entrance, visit every authored chamber and optional treasure, solve mechanisms through E/Q, make two base jumps, defeat normal guardians and the boss, receive one relic and use the physical final exit. No coordinate writes, grants, deleted enemies or fall shortcuts are used by the controller.
- Independent replay probe captured **17 real save points** from those routes: guard kills, optional treasure, completed pressure seals and first clears. Each was passed through `exportSave` / `loadSave`, verified at the authored safe entry, then replayed with the same normal-input controller. Result: **INDEPENDENT RELOAD ROUTES PASS 17**. Opened gates persist, all runs return outdoors with zero falls and one unique dungeon relic, optional treasure remains claimed, and replaying completed saves grants no additional XP.
- Layout inspection confirms four distinct room arrangements and mechanic combinations, required puzzle/guardian dependencies represented in corridor doors, optional branches, fixed authored geometry within the local bounds, and immutable runtime catalogs. Missing or capped actors do not satisfy guardian requirements.
- Renderer inspection confirms active dungeon geometry replaces outdoor chunks, water and backdrop; closed doors consume the same current facts as collision. Town NPC rendering has an independent 12-actor cap. Terrain clearings and approach-road tests preserve traversable three-metre routes.

Actual shader appearance and browser interaction are being verified by the primary integrator. Mock GL allocation checks are not visual evidence.
