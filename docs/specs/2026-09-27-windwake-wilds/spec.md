<!-- source: windwake/world.mjs -->
<!-- source: windwake/sim.mjs -->
<!-- source: windwake/render.mjs -->

# WINDWAKE Wilds — terrain, encounters and combat readability

## Goal
Implement the user's five explicit corrections: populated exploration, visibly distinct chained basic attacks, camera occlusion handling, meaningful combat resistance, and traversable varied terrain. Publish a reusable terrain-generation standard informed by the linked video and primary technical references. Existing same-game deployment authorization remains applicable.

## User Stories
As a traveller I encounter readable threats and choose routes through hills and valleys. As a fighter I chain different strikes but must react to surviving enemy attacks. As a player I can see my character through foreground foliage without the camera entering solid walls. As another game author I can reuse a documented deterministic terrain pipeline and its validation criteria.

## Specific Requirements
### SR-1 Encounter density
- Increase valid outer-world encounters materially (target at least 2× sampled baseline outside protected hubs), with biome-appropriate small mixed groups and encounters near routes, without spawning in towns, village, deep water, props, steep unsupported slopes, boss arenas or dungeon entrances.
- Keep stable IDs, deterministic generation, persistent defeat state and total active actor cap <=64. Prioritize nearby encounters without starving bosses, dungeon enemies or raids. Avoid spawning immediately on the player, and preserve safe arrival/rest space.
- Record sampled baseline/new counts and actual encountered threats on an ordinary traversed route; raw whole-world totals alone are insufficient.
- Preserve the X/Z/type meaning of existing `wild-<chunk>-0/1` slots; use separately seeded/namespaced new slots, never reuse defeated legacy IDs for a different creature. Bound authored+generated durable IDs below 16,384 and validate full-population plus >4,096-defeat save round trips. A restored defeat remains defeated even if terrain now suppresses its spawn.
- At 64 actors, a requested arena/raid/trial must have capacity by bounded ambient admission or safe distant-ambient eviction. Never evict an engaged enemy silently. Test boss approach, raid start and dungeon return under saturation.

### SR-2 Basic combo
- Keep three attack stages with buffered discrete input and optional held attack chaining. Give them distinct pose/trail trajectories: horizontal cut, rising/backhand cut, committed overhead finisher. Pose and hit timing derive from one deterministic attack timeline.
- Preserve no basic stagger/knockback/hit-stop from the previous correction. Preserve range, cover/height checks, single damage application per stage, dodge cancel and release/timeout recovery.
- Enemy resistance and player commitment make infinite attack-only trading inferior to timed defense; no unavoidable instant attacks or forced mandatory parry. Dodge/spacing remain viable.

### SR-3 Camera
- Retain swept near-plane/solid/terrain collision. Thin foliage may fade/dither locally between camera and character; never make distant foliage, actors, walls, or the whole world transparent.
- Fast obstruction correction and damped outward recovery must avoid oscillation and clipping, including camera rotation and dungeon transitions. Canopy geometry must be included in visibility treatment, not just trunk colliders.
- Follow published common game-camera techniques; distinguish verified sources from assumptions about proprietary Zelda internals.

### SR-4 Challenge
- Increase ordinary enemies' ability to survive and retaliate, differentiate timings and pressure, preserve readable telegraphs and defensive counterplay. Protect introductory accessibility and avoid a blanket HP multiplier as the only change.
- Deterministic representative attack-only versus dodge/parry encounters must show a measurable defensive advantage. Update existing test expectations only for intentional balance changes, never erase collision/progression assertions.
- Compare at least one ordinary melee and one two-enemy mixed encounter with the same seed, normal enemy HP, player 100 HP/no upgrades/no healing, starting distance 3–6 m and 45 simulated second limit. Defensive controller must finish alive; attack-only must either die or lose at least 25 more HP. Preserve telegraphs of at least 0.45 seconds for ordinary attacks; dodge/spacing can substitute for parry.

### SR-5 Terrain and reusable standard
- Seeded coherent multi-octave noise with large landforms, ridges/valleys and limited fine detail. Biomes should differ in relief, with visible climb/descent away from protected settlements, roads and boss arenas.
- Preserve authored starting area, safe critical route gradients, town floors, entrances and boss access. Terrain render sampling, collision, spawns, camera and restored player positions must agree within documented tolerance; negative coordinates/chunk edges remain seamless.
- Standardize seed/version, coordinates/units, frequency/amplitude/octaves, landform masks, traversability and safe zones, mesh/collision contract, placement, streaming/performance and quantitative gates. Clearly separate a heightfield from caves/overhangs needing separate geometry. Include reusable implementation and tests where appropriate; no game engine or new external dependency.
- Document exactly what was accessible from the video; do not invent a transcript or call it verified viewing if unavailable. Link primary references and user video.
- Use the same globally aligned 3 m triangles for outer-world rendering and collision, with <=0.02 m interior height error, seam error <=0.001 m and negative-coordinate tests. Legacy authored core may retain its analytic function only with measured <=0.12 m mesh discrepancy; do not disturb existing puzzle floors. Critical route grade <=0.8, safe hubs remain level. At least six of eight sampled biome windows must show >=18 m relief over a 180 m window outside protected pads, with one tested ordinary climb/descent route gaining >=15 m.
- Camera solid penetration tolerance <=0.01 m; outward recovery reaches >=95% of requested unobstructed distance within 1 second, while inward correction occurs in the current frame. Foliage cutout is restricted to the camera–target segment and a <=1.5 m target corridor; behind-target vegetation is unaffected. Verify shader output in real Chrome, not only numerical helpers.

### SR-6 Adopt useful Skybound handoff lessons
The user supplied `docs/plans/2026-09-27-skybound-rebuild-handoff.md` and its ZIP as reference, not a request to resume that discarded project. Adopt shared rendered/collision triangles, actual connected traversal rather than teleported completion, multiple route choices (walk/climb slopes/jump/glide), distinct articulated attack poses, and honest measured quality claims. Add a near-landing jump-buffer regression: an airborne jump just before contact must not accidentally consume the buffer as a new glide. Retain explicit folding of an already-open glider. Do not import its engine/dependencies, unpublished source or unverified physics-assembly claims.

## Existing Code to Leverage
`world.mjs`: seeded chunks, spatial queries, trails and reserved hubs. `sim.mjs`/`combat.mjs`: deterministic fixed step and state-based enemies. `render.mjs`: procedural mesh batches and camera sweep. `tests/*routes.mjs`: complete ordinary-input journeys. `publish.mjs`: explicit runtime manifest.

## Verification
Focused deterministic terrain/encounter/combat/camera tests, full existing suite, original/frontier/dungeon/town routes, actual Chrome trusted inputs, forest orbit and combo screenshots, terrain climb/descent playthrough, console errors, CPU/GPU/actor limits and frame timings. Fresh-context independent review before release. Verify public runtime hashes and repeat new behaviors after deployment. Preserve unrelated user changes and hooks.

## Out of Scope
AAA art, imported game assets, copying proprietary implementation, multiplayer, voxel caves, engine/framework migration, unrelated platform changes. Existing ADR-0096/0097 boundaries remain; this deepens the existing simulation/render pipeline rather than introducing a new service or storage schema.

## Open Questions
No blocking design questions: the user explicitly delegated these gameplay decisions. Video transcript accessibility is a research limitation to record, not permission to fabricate evidence.
