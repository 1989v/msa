<!-- source: windwake/world.mjs -->
<!-- source: windwake/dungeons.mjs -->
# Specification: WINDWAKE Crossroads

## Goal
Make travel between settlements an authored adventure, and add two spatially distinct optional ruins with durable, usable rewards. Continue the user's approved roadmap1/2; loading/device optimization remains last.

## User Stories
A traveler can follow a legible regional road between towns, notice landmarks, fight threats and earn supplies without returning to the central hub. An explorer can solve different spatial challenges in coastal and canopy ruins, equip new relics and revisit without duplicated rewards or lost saves.

## Specific Requirements
### SR1 — Four regional corridors
- Connect sunfields–dunes, coast–autumn, alpine–mistwood, canyon–lavender through existing town/waypoint safe approaches. Four corridors cover all eight existing towns; do not claim eight new towns or a larger map.
- Each has a distinct landform silhouette, at least350m of connected walking, at least18m elevation range, three named discoveries/clues across its length and a durable supply chest. Regional motifs: rolling trade ridge, coastal bluff/stream overlook, forest saddle, flower basin/rock cut.
- Roadbed slope<=.8 sampled each metre, safe dry walkable surface, exact shared render/physics height within.02m, forward/reverse ordinary movement with no fall recovery. Keep old roads and existing expedition loops traversable.
- Natural ambient encounters remain; two authored guards per corridor defend the supply cache. Cache requires their actual durable defeat proofs. New guard IDs occupy a bounded namespace, preserve actor cap64 and priority for required encounters; no respawn/reward duplication after save/reload.
- New reservations occur after legacy PRNG generation; preserve surviving old enemy/prop ID/type/XZ and never resurrect suppressed legacy IDs. Test pre-change fingerprint/subset, not an arbitrary new blessed hash.
### SR2 — Distinct optional ruins
- Add dungeon-tide at coast and dungeon-canopy at autumn, each accessible from the relevant town through a safe approach and clearly marked on map. Existing4classic dungeons+2natural caves unchanged.
- Tide ruin: bright coastal sluice architecture, branching guarded supplies, at least4connected spaces, >=6m vertical range, a timed relay traversal. Start/intermediate/finish nodes must be activated in order within a displayed limit (at least18seconds), normal walking/jumping proves success. Expiry/wrong order resets only unsolved transient circuit and can retry for free; never closes a solved gate.
- Canopy ruin: open upper terraces with >=16m vertical range, nonoverlapping XZ floors, three sequence nodes at different heights/branches; written clue gives order. Optional guarded balcony treasure; main guardian is mandatory. Basic movement/jump suffices; glider not required.
- Both require their principal puzzle and main guardian for clear/relic; optional treasure may be skipped. Both have required guards and a distinct guardian family, one optional guarded chest, entry exit and post-clear return. A clear-gated archive cache opens a reason to retrace an optional branch; can be obtained during same visit or later, not falsely claimed as revisit-only.
- Only one local scene. Shared floorSurface and bounded collider geometry; no moving floors, stacked walkable XZ layers, simulated water, seamless volumetric terrain or new engine.
### SR3 — Reward/persistence
- Two new relic IDs relic-tide and relic-canopy with separate dungeon sources. Tide: stamina+15/speed+4%; canopy: energy+10/harvest+15%. Existing8relic identities/sources/quests and two equipment slots preserved; UI denominator derives catalog size.
- Timed circuit uses an absolute simulation-frame deadline (start frame + authored limit frames). stepGame increments frame before dispatching input; finish succeeds only when current frame < deadline, fails at equality and later. Exposed remaining time is max(0,(deadline-frame)/60); expires deterministically and pauses when simulation pauses. Save/load at safe entry resets incomplete timers; completed puzzle/guard/cache facts survive. Snapshot restore preserves legitimate current timer and exact replay.
- Both loadSave and restoreSnapshot validate new corridor-cache/ruin claimed/opened facts and source-backed relic ownership. Archive opened requires authored clear prerequisites and claimed=true; snapshot validation preserves legitimate active timers, enemies, blocks and deterministic continuation rather than applying safe-entry resets. Durable claimed/opened proofs cannot be forged through incomplete authored facts; loadSave and restoreSnapshot must safely handle missing added fields. Repeated clear/open/load must not duplicate rewards. Existing version3 saves keep working.
### SR4 — Presentation and guidance
- Regional path stones/signposts, landmark silhouettes and map lines communicate routes and reward completion. Town guides/journal explain adjacent corridor and new ruins; avoid cluttering combat HUD.
- Coast/canopy render with existing named palette and distinctive structural props; no new remote assets. Timed puzzle shows remaining time, failure/retry feedback and sound. Minimap reflects actual rooms and heights.
### SR5 — Verification and delivery
- Baseline244tests. Add focused numerical, progression, adversarial saves, deterministic timer and meaningful reward tests; retain all old content tests with explicit legacy catalog scopes where total catalog grows.
- Ordinary bidirectional corridor routes, two fresh-game dungeon approaches/clears/exits with optional rewards and save/reload. At least one combined corridor→new dungeon→equip relic→return→save path. Fixtures labeled and cannot replace fresh accepted route.
- Actual Chrome keys/mouse plus deterministic routes, screenshots inspected, console checks; fix and rerun discoveries. Independent fresh review/verdict then scoped commit/publish, exact public module hashes and critical public play.

## Terms and verification mapping
Corridor cache is a world chest requiring its two authored worldDefeated facts. Circuit deadline/sequence index are transient active-scene state. Clear means all required puzzle and guard facts; archive cache requires that clear, while its opened fact is durable and exactly once. Relic ownership derives from its explicit source dungeon.

SR1: metre geometry, old identity subset, ordinary bidirectional route, cap64 saturation with required-guard admission and actual two-kill cache/reload. SR2: fresh no-glider completion, optional-treasure skip allowed/main-guardian skip denied, gate/branch geometry. SR3: deadline one tick before/at/after, pause/retry/solved immunity, both restore paths forged/missing proofs and transient replay, equipped-vs-unequipped movement/stamina/energy/harvest effects. SR4: Chrome map/minimap/guidance/countdown screenshots. SR5: full regression, combined journey and public exact artifact checks.

## Delivery rollback
Rollback restores the previous complete runtime module set, never mixed modules. Preserve/export the current Crossroads save before opening older code; old validators may discard new IDs on resave, so backward save roundtrips are explicitly unsupported. Restore the preserved save after returning to Crossroads for forward recovery. No save schema redesign is required.

## Visual Design
Use windwake/DESIGN.md palette and root UI tokens. Bright coast, autumn terraces and readable paths, architectural differences rather than generic repeated rectangular rooms.
## Existing Code to Leverage
world.mjs isolated terrain additions/post-filtering; caves.mjs floorSurface; dungeons.mjs proofs/doors/scenes; relics/settlements validation; tests frontier/dungeon route helpers and CDP harness. ADR0096/0097 continue unchanged.
## Out of Scope
Loading/hardware optimization, new town count, backend/cloud saves, Higgsfield, changing basic-hit no-control rule, replacing old objectives, general moving-platform/volumetric engine.
## Open Questions
None. Bounded implementation decisions authorized by original autonomous task and latest next-work instruction.
