<!-- source: windwake/world.mjs -->
<!-- source: windwake/dungeons.mjs -->
<!-- source: windwake/village.mjs -->
# Task Breakdown: 산길과 삶
Total Task Groups: 5. User implementation/deployment authorization explicit.

## 1. Outdoor geography and settlements
Dependencies: none. Phase: domain/world. Required Skills: hns:implement-tasks.
- [x] Focused sharedheight/grade/preservation/connectedroute tests.
- [x] world.mjs + pure geography catalog: summit/valley loops, two cave entrances, distinctive town layouts and decoration metadata. Preserve legacy reservation identity.
- [x] Verify `node --test windwake/tests/terrain.test.mjs windwake/tests/world.test.mjs windwake/tests/geography.test.mjs` plus new ordinary route.
Acceptance: SR1 and SR5 spatial contracts; same shared surface, reachable routes.

## 2. Tactical combat
Dependencies: none. Phase: combat. Required Skills: hns:implement-tasks.
- [x] Focused pack/caster/bossgeometry/lockedtell deterministic tests.
- [x] combat.mjs attack geometry and tactics; publish clear hook/render contract to root. Root owns sim.mjs integration.
- [x] Verify `node --test windwake/tests/combat.test.mjs windwake/tests/basic-attacks.test.mjs windwake/tests/wilds-combat.test.mjs windwake/tests/tactics.test.mjs`.
Acceptance: SR3, basic attacks unchanged control boundary, readable matching threats.

## 3. Life and defense
Dependencies: none (uses stable cave IDs cave-canyon/cave-mistwood; root integrates post-proof normalization). Phase: life. Required Skills: hns:implement-tasks.
- [x] Focused adversarial recipe/resident/raid/save tests.
- [x] village.mjs, settlements.mjs, frontier-ui.mjs, journey-ui.mjs: produce, kitchen/workshop, recipes, resident invitations/jobs, raid tactics and UI. Return renderer and sim normalization APIs.
- [x] Verify `node --test windwake/tests/life.test.mjs windwake/tests/journey.test.mjs windwake/tests/community.test.mjs`.
Acceptance: SR4 and SR5 dialogs; no partial transaction, one slot per cottage, bounded simulation-time work.

## 4. Caves and presentation integration
Dependencies:1–3 contracts (root can implement cave catalog independently). Phase: integration. Required Skills:hns:implement-tasks.
- [x] Focused sharedslopes/cavegeometry/progression/restore/route tests.
- [x] Natural cave catalog, dungeons.mjs shared slopes and completion. sim.mjs hooks/proof normalization/exploration rewards. render.mjs cave shells/townprops/residents/attack geometry. main UI/map and publish module manifest.
- [x] Verify `node --test windwake/tests/caves.test.mjs windwake/tests/presentation.test.mjs` and new connected cave/life route.
Acceptance: SR2; visible and traversable content with actual rewards.

## 5. Integrated play, review, delivery
Dependencies:1–4. Phase: verification/release. Required Skills:hns:validate.
- [x] `node --test windwake/tests/*.test.mjs`; old core/frontier/town/dungeon and new paths.
- [x] Chrome actual input + visual captures, new outdoor/cave/life loop, console; no deferred hardware/cold-load project.
- [x] Fresh independent review + verdict, corrections, retest, documentation.
- [ ] Scoped commit, existing deployment, exact public modules and critical playable paths.
Acceptance: SR6; evidence before completion; unrelated changes preserved.
