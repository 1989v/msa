<!-- source: windwake/world.mjs, windwake/render.mjs, windwake/sim.mjs, windwake/main.mjs, windwake/progression.mjs, windwake/village.mjs -->
# WINDWAKE: Frontiers / 바람이 머무는 마을

## Goal
Turn the initial small adventure into a broad bright open world with skill builds, varied foes, regional bosses and waypoints, farming and a player-shaped village defended at night. Map area expands64× while nearby simulation/rendering remains bounded.

## User Stories
- As an explorer I cross distinct biomes and elevations, discover travel anchors and challenges, and use acquired movement skills to explore farther.
- As a fighter I invest earned skill points, equip abilities and respond to visibly different enemy/boss patterns.
- As a villager I gather materials, place useful and decorative structures, grow crops and use harvests for the next expedition.
- As a defender I see dusk warnings, prepare towers/barriers and personally fight approaching waves without losing my entire village on failure.

## Specific Requirements
### SR-1 World and scale
1. World bounds are ±960m on X/Z:1920²/240²=64× original area. Preserve the central adventure as an accessible starting area.
2. Add8 substantial outer regions with distinct terrain/palettes, trails and landmark silhouettes. Include hills, ravines, navigable shores, elevated ruins and sheltered places; far regions contain authored points of interest rather than empty expansion.
3. At least8 outer waypoints and8 regional boss arenas plus24 discovery/resource/challenge locations provide destinations. Boss regions and waypoints are walkably connected from the center; avoid mandatory unopened-waypoint teleports.
4. Terrain/decor are seeded per chunk. Renderer loads a bounded neighborhood, prefetches and disposes distant GPU buffers. CPU geometry caches are bounded; broad-phase collision queries inspect local cells. Map thumbnails do not force whole-world geometry residency.
5. Near-player enemies are instantiated/updated within bounded capacity. Unloaded defeated enemies/bosses cannot be farmed by crossing a boundary; durable state survives saves. Active enemies≤64, bounded effects/projectiles remain.
6. Waypoints require physical discovery and deliberate activation. Travel is blocked during nearby combat or an active raid, reveals clear reason, and places the player on safe ground with motion reset. A distant queued raid explicitly permits travel home. Home remains a reachable return destination.

### SR-2 Skills and combat growth
1. Three skill branches — blade, wind, hearth — contain at least15 meaningful nodes with prerequisite edges, point costs and visible descriptions. XP from combat/discovery/challenges earns levels and points; no negative spending or duplicate node reward.
2. At least4 added usable abilities (ranged sunbolt, directional wind dash, healing bloom, ground burst) have energy/cooldown limits and distinct feedback. Equip2 active abilities; existing Q pulse remains available. Passive nodes affect actual combat, traversal or village behavior.
3. Skill tree exposes earned/available points, requirements, learned state and active slot assignment on keyboard/mouse/touch. Locked choices explain their prerequisite.
4. Existing directional combo, parry, dodge, cover/vertical checks, gliding and hit reactions remain. Enemy scaling does not erase the value of defense or introduce unavoidable damage.

### SR-3 Enemies, bosses and progression
1. At least12 regular archetypes including existing ones have differentiated behaviors: pursuit, pack leap, armor charge, hopping, ranged volley, healer/support, explosive telegraph, guarding, flying/kiting, burrow/ambush, slowing zone and heavy sweep. Distinct silhouettes/telegraphs accompany behavior.
2. Regional bosses use at least4 materially different attack-pattern families, phase changes and named health bars. Eight regional encounters give unique first-clear rewards and progression; no reskin-only claim of8 distinct AI systems.
3. Original summit guardian is the first chapter milestone; dismissing its victory allows further exploration. A later capstone requires4 regional boss victories and village advancement, has a separate completion state and retains free roam.
4. Discovery tasks/field challenges and resource rewards point back into skill/village progression. Journal tracks central, regional and home objectives with the next actionable step.

### SR-4 Farming and village
1. A safe starter village clearing has a home beacon and readable introduction. Provide a modest starter supply and nearby renewable gathering spots so progression cannot deadlock.
2. Place at least8 functional/decorative building types in validated village cells: crop plot, cottage, well, granary/workbench, tower, fence/gate, flowers and lantern. Placement uses materials, checks occupied/out-of-bounds cells, shows world location and supports removal/refund or repair.
3. At least4 crops have seed→watered growth stages→ripe→harvest. Simulation time drives growth deterministically; pause/offline time does not kill crops. Harvests are usable for healing, seeds/trade and upgrades. Harvest cannot duplicate rewards.
4. Structures and crops visibly appear in the3D world; village customization is saved. Village level/reputation unlocks recipes/upgrades. A home objective sequence teaches gather/build/sow/water/harvest/defend through actual actions.
5. Day/night cycle provides a bright readable daylight and soft moonlit night, visible clock and dusk warning. Prefer10-minute game days with a short defense interval; menu pauses time.

### SR-5 Defense and recovery
1. After a cottage and the first completed harvest establish the village, dusk schedules at most one raid per game day. A warning states the threatened directions and offers return guidance. Multiple waves approach the home beacon; towers attack, walls absorb/block and the player can fight/repair.
2. Outside the active village neighborhood, queued raids wait for the player's return instead of silently destroying unloaded progress. Explain this rule in UI. Do not advance an unresolved raid to another scheduled day.
3. Victory awards resources/XP/reputation once. Failure damages repairable structures and beacon without deleting learned skills, discovered waypoints, crops inventory or permanent boss victories. Provide a free recovery path; reload cannot reset a raid for duplicate rewards.
4. Raid state, crop time, build placements and day index are durable. Raid lifecycle is idle→queued→active→won/lost with unique day identity. Persist remaining active wave enemy records as well as wave number; reload/death restores the encounter without reissuing cleared-wave rewards. No real-time/offline punitive timers or required server connectivity.
5. Initial wood/stone/seeds cover a cottage and first plot. Watering is free, harvest returns a seed, gathering renews on simulation time, and destroyed home beacon can be recovered without materials; the first crop loop never requires already owning a harvest. Removing a planted plot returns its single seed and no harvest; raid failure preserves crop/seed inventory. If no seeds and no planted crops remain, the home supplies one turnip seed without material cost, so the farming loop can restart.

### SR-6 Stability, UX and delivery
1. Keep vanilla modules/WebGL/Web Audio and original procedural art. No external engine, asset service, Higgsfield or build requirement. Update static publishing file allowlist for new runtime modules.
2. Version2 saves migrate version1 progress and validate/bound all arrays, coordinates, numeric values and IDs. Keep the existing storage key or explicitly migrate it. Corrupt data falls back safely.
3. Deterministic API includes skill learning/equipping, village actions, clock/state inspection and bounded world/render metrics. Gameplay verification distinguishes controlled fixtures from natural routes.
4. Keyboard/mouse/touch controls and menus cover all new actions; avoid overflowing mobile HUD. Document controls and scope honestly, with no claim of AAA content volume or guaranteed universal60fps.
5. Execute repeated real Chrome play/observe/fix/retest cycles, stress residency across the large world, independent final review and public deployment verification. Preserve unrelated work via scoped commits and isolated latest-main deployment.

## Visual Design
Original low-poly, warm cultivated valleys, pale dunes, autumn woods, alpine blue, luminous coast. Readable golden waypoints and named bosses take broad action-RPG inspiration; no copied characters/UI/art. Village feels inhabited through cottages, crop stages, flowers, lamps and friendly daytime wildlife. Named tokens extend windwake/DESIGN.md; night remains navigable and inviting.

## Existing Code to Leverage
The original windwake/ fixed-step simulation, spatial combat, renderer primitives, audio, input buffer, Chrome harness and static deployment. Retain central terrain/challenge definitions and meaningful regression tests.

## Out of Scope
Online multiplayer/economy, copied franchises/assets, offline punitive simulation, photorealistic art, professional voiced narrative and a claim that64× area means64× authored content/playtime.

## Open Questions
None blocking; user authorizes design/implementation and existing-site update. Implementation changes to measurable targets must be recorded with evidence, not silently reduced.

## Local Gameplay Terms
Waypoint: an activated physical travel beacon. Skill point: XP-derived budget spent once on a learned node. Village cell: a validated4m placement slot. Plot: a crop-bearing structure. Game day:600 seconds of unpaused simulation, with dusk at450 seconds. Raid: a durable encounter identified by village day; queued means awaiting home return, active means currently defended. Regional victory: a unique boss first-clear flag, distinct from the central guardian and final frontier completion.
