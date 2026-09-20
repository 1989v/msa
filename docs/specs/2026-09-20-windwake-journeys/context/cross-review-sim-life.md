<!-- source: windwake/sim.mjs -->
<!-- source: windwake/main.mjs -->
<!-- source: windwake/settlements.mjs -->
<!-- source: windwake/relics.mjs -->
<!-- source: windwake/village.mjs -->
<!-- source: windwake/progression.mjs -->

# Independent simulation and settlement cross-review

Verdict: **SHIP after corrections**. Reviewer authored world/render modules, but did not author the six runtime files reviewed here or their two corrections. This review excludes the reviewer's world/render implementation. No reviewed runtime files were edited by this reviewer.

## Resolved P2 — purchased expedition supplies disappear after reload

`sim.mjs:440` / `sim.mjs:445`: `exportSave()` omits the flask inventory and `loadSave()` leaves the fresh game's three flasks. The new alpine lodge service charges persistent food for three additional flasks. Purchasing at the merchant succeeds with food 6→3 and flasks 3→6, but `loadSave(exportSave(s))` retains food 3 while returning only three flasks. Thus the new paid service loses its purchased goods on an ordinary reload.

Resolution required: serialize a bounded flask count in version-three saves and restore it; missing older-save fields retain the legacy baseline. Verify an actual lodge purchase survives reload without refunding its cost, and malformed/oversized counts cannot escape the 0–6 bound. Keep any deliberate death-restock policy separate from a browser reload.

Verified correction: version-three exports now include flasks; loading clamps finite counts to 0–6 and gives missing/older saves the legacy three. The original independent reproduction now returns six flasks and food three. The new purchase/reload/malformed-count regression passes.

## Resolved P2 — dungeon movable stones do not block combat queries

`sim.mjs:39`, `sim.mjs:80`, `sim.mjs:315`, and the actor hooks near `sim.mjs:494`: player movement adds `s.blocks` to scene solids, but line of sight, projectiles, and enemy movement receive only `solidsFor()`, which omits them. Dungeon pressure-puzzle stones therefore stop the player while attacks pass through their visible solid bodies.

Controlled reproduction uses the authored sunfields stone at `(61, 0, 32)`, dimensions 1.6×1.6×1.6. Place the player at `(59.7, 0, 32)` facing east and an ordinary slime at `(62.3, 0, 32)` with a long recovery timer. Twelve normal attack ticks reduce slime HP 36→20 through the stone. This is a scene-collision inconsistency rather than a missing lock or puzzle answer check.

Resolution required: use the same movable collision geometry for actor, combat-ray and projectile queries. Exclude the current block when integrating its own movement so it cannot collide with itself. Add a regression covering the authored stone and ensure pressure puzzles still move/reset normally.

Verified correction: `solidsFor` includes nearby movable blocks; movement of the block itself excludes only its own ID. Player and enemy movement, sword visibility and projectile collision consume the unified query. The original independent sword reproduction now leaves slime HP at 36. The new stone-cover/projectile/push regression and all four natural dungeon journeys pass.

## Verified boundaries

- NPC mutations independently enforce playing mode, outdoor scene, known resident and town, actual horizontal/vertical proximity, role, proof, prerequisite stage and full cost before mutation. Repeated claims do not pay twice; relic ownership and alliance bonuses are derived and capped.
- Dungeon actor rewards branch before original sky-boss and regional-boss payouts. Outdoor actors are parked only in transient `fieldState`; durable saves normalize dungeon IDs and progression before validating quest/relic sources, then reconstruct a safe entry and authored blocks.
- Indoor village actions and clocks are guarded, fast travel rejects active instances, scene transitions clear projectiles/motion and preserve current resources, and main-loop menus pause simulation.
- `node --test windwake/tests/journey.test.mjs windwake/tests/journey-sim.test.mjs windwake/tests/life.test.mjs windwake/tests/dungeons.test.mjs`: initial baseline **77 tests, 77 pass, 0 fail**; after corrections and new regressions **79 tests, 79 pass, 0 fail**, 3674 ms. This includes all four natural dungeon journeys.

Both findings are resolved with independent reproductions and regression evidence. No remaining P1/P2 finding in the reviewed six files. Browser visual validation and world/render review remain separate responsibilities.
