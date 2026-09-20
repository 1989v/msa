<!-- source: windwake/dungeons.mjs -->
<!-- source: windwake/tests/dungeons.test.mjs -->

# Dungeon security and test-strategy review

Verdict: **SHIP with the frozen dungeon contract applied**. Baseline `node --test windwake/tests/*.test.mjs`:120 tests,120 passed,0 failed,0 skipped (2814.626375ms). No new remote service/authentication/secret boundary is introduced.

Implementation evidence (2026-09-20): the combined suite now reports166 tests,166 passed,0 failed,0 skipped (3766.607042ms). Thirteen dungeon tests include four complete natural adventures using cloned read-only state adapters. `node windwake/tests/dungeon-routes.mjs` reports `DUNGEON NATURAL ROUTES PASS`: sunfields8532 frames/849.97m, canyon9833/1147.27m, mistwood13063/1409.47m, alpine13621/1530m. Each returns outside with its own relic, two actual base jumps, one optional guarded chest, all mandatory physical gates open, and zero falls. This is deterministic simulation evidence; root owns the separate visible Chrome gate and independent implementation review.

Findings and resolutions:

1. **Geometry isolation:** requirements3/7/8 (`spec.md:17`, `:21`) conflict with merely adding interior solids: existing `sim.mjs:50`, `:56`, `:300`, `:378` and `render.mjs:497` still use overworld floor/updraft/camera queries. Resolution: one active `expedition.active` scene, shared floor/solids/bounds/geometry exports, world-only effects disabled. Root/world own adapting all consumers.
2. **Cross-system identity/replay:** requirement4/7 needs dungeon-specific payout. `sim.mjs:95` currently routes any bossId to regional rewards and an untagged boss to the original ending. Resolution: dungeonId actor metadata, separate allowlisted progress and a first dungeon branch in dropReward; record stable required kill IDs before pruning. Existing missing-actor regression `tests/frontier-regressions.test.mjs:35` is retained as a scar.
3. **Load/death/exit safety:** `sim.mjs:419`–`:439` only persists overworld progression and returns to a camp. Resolution: v3 validates bounded dungeon facts and known ID, rebuilds authored geometry, resumes safe entry, permits retreat only at a physical exit, and gives a free puzzle/block reset.
4. **Raid coordinate collision:** `village.mjs:376` uses distance alone. Interior local coordinates must never activate or damage the home. Resolution: entry rejected during active raid; root treats any active instance as remote for raid state while preserving pause/day/crop policy.
5. **Evidence quality:** existing `tests/frontier-browser.mjs:54` uses render:false routes, which cannot establish interior camera/door correctness. Resolution: new natural routes walk from each entrance through5+chambers, actual puzzle objects/jumps/enemies/optional chest/boss/exit; Chrome additionally renders door crossings and inspects ceiling/cover/camera. Controlled domain fixtures separately cover malformed saves, cap-denied spawns, wrong-order retry, plate reset, repeat claims and transitions.

Implementation gates: retain120 baseline tests; exercise all4room graphs, pairwise-distinct layout/mechanic combinations, closed-door collision and near-object action validation; death/reload/reentry after each reward; no missing-actor completion; scene transition residue and repeated GPU release. The contract is `context/dungeon-contract.md`; implementation remains to be verified.
