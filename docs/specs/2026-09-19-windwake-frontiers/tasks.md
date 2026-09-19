# WINDWAKE Frontiers tasks

## Group1 — World and streaming
Dependencies: contracts. Phase: foundations. Required skills: hns:implement-tasks.
- [ ] Deterministic64× terrain,8 outer regions, waypoints/boss/resource/trial sites and local collision queries.
- [ ] Bounded lazy renderer/cache, biome scenery, village/skills/new actor rendering.
- [ ] Replace camera OBSTACLES/PLATFORMS scans with local queries; preserve cross-chunk AABB collision support; handle600second clock and frozen life render schema.
- [ ] Verify: `node --test windwake/tests/world.test.mjs`; central routes and resident-chunk stress follow integration.

## Group2 — Progression and life
Dependencies: contracts/world definitions. Phase: domain. Required skills: hns:implement-tasks.
- [ ]15+ skill nodes, XP/prerequisites/equipping/modifiers.
- [ ] Village placement/economy,4 crops, gathering, day/night, defendable raids and recovery.
- [ ] Freeze context/life-contract.md content IDs, crop growth, structure HP/positions, modifiers and raid hooks before consumers implement.
- [ ] Verify: `node --test windwake/tests/life.test.mjs`, including seed recovery/removal, active-wave persistence and durable retry/malformed input.

## Group3 — Combat and integration
Dependencies:1/2 contracts. Phase: simulation. Required skills: hns:implement-tasks.
- [ ]12 regular enemy behaviors, regional boss families, bounded active set and persistent defeats.
- [ ]4 abilities, regional rewards/waypoints, v1→v2 saves and late capstone.
- [ ] Replace SOLIDS consumers in horizontalMove,verticalMove,lineClear,updateBlocks,projectiles and player movement/knockback with querySolids; reconcile all encounter/raid actor paths within64 cap.
- [ ] Verify: `node --test windwake/tests/sim.test.mjs windwake/tests/combat.test.mjs windwake/tests/frontiers.test.mjs`.

## Group4 — Playable interface
Dependencies:1–3. Phase: interface. Required skills: hns:implement-tasks.
- [ ] Skill tree/equipping, village management/build placement, crops, regional atlas/journal, day/raid feedback and touch controls.
- [ ] Visual/audio feedback, onboarding and pause/input safety.
- [ ] Replace mapBase/drawMap fixed±120/240 constants with WORLD.size; map sampling must not allocate collision or GPU chunks.
- [ ] Verify: `node windwake/tests/frontier-browser.mjs`, actual input/menu/screenshots and repeated improvements.

## Group5 — Journey and release
Dependencies:1–4. Phase: verification. Required skills: hns:verify,hns:validate.
- [ ] Verify: `node windwake/tests/frontier-routes.mjs`; natural exploration/economy/skill/boss/defense routes, bounded residency stress and measured performance.
- [ ] Gate: same-seed chunk output equals after reversed query order and eviction/rebuild; cross-boundary solid returned once from either side. Three multi-region out/return render circuits assert CPU≤96/GPU≤64/enemies≤64 at every sample.
- [ ] Gate: v1 fixture preserves all sigils/chests/upgrades/currency/guardian completion; v2 active-wave reload preserves survivor IDs/HP and reward marker, post-victory reload cannot pay again; death has same invariant. Queued raid allows home travel; active blocks it.
- [ ] Fresh-context implementation review, fix findings, rerun impacted checks, sync docs.
- [ ] Scoped commit, isolated deployment, public source/hash/Chrome verification.
