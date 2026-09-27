<!-- source: windwake/world.mjs -->
<!-- source: windwake/terrain.mjs -->
<!-- source: windwake/tests/terrain.test.mjs -->

# World / terrain evidence — 2026-09-27

## Implementation and integration

- `terrain.mjs`: seeded quintic value noise, normalized fBm, smooth ridges, global 3m triangle interpolation, bounded 32,768-vertex cache. No engine/dependencies; does not allocate world chunks for atlas samples.
- `world.mjs`: unchanged original analytic puzzle core and original authored road anchor heights (final 3m inner border smoothly joins triangle collision); broad relief outside the core; flat town/entrance/waypoint/boss inner pads at 31/10/10/28m respectively, smooth outer transitions. Road center corridor 8m, blend extent 34m. Renderer diagonal remains `a,d,c` / `a,c,b`.
- `heightAt(x,z)` supplies outer rendered-triangle collision heights. Core retains analytic collision; root renderer refines core mesh to 1.5m and stitches its outer edges to coarse triangles.
- Existing `wild-<cx>-<cz>-0/1` PRNG uses original prop rejection heights and reservation semantics before new terrain safety suppression. New group PRNG is independent, IDs `wild-v2-<cx>-<cz>-<group>-<member>`. Surviving legacy IDs are checked against the before-edit full population fingerprint.
- `WORLD_GENERATION` exports version 2, 2 legacy + 9 new candidate slots per chunk, `maxDurableIds:12288`. Finite outer candidate bound is 11,264; 20 original/boss authored entries keep the world population below the bound. Active admission and durable save round trips belong to simulation integration.
- New ambient placement checks water, all four one-metre cardinal grades ≤0.72, solid clearance 1.2m, hub/arena reservations, spacing and chunk edge margins. Legacy unsafe placements are suppressed rather than moved or assigned new meaning.

## Measured results

Full population: **8,266 ambient** versus **1,896 baseline** (4.36×). **1,006** original slots remain safe; all retain exact X/Z/type. Suppressed original defeated IDs remain meaningful save entries. Current legacy fingerprint (ID, X, Z, type sorted): `f1fe30a3b1b8ff1fec64e2d134630960e2ff3b5ba586f2c4364dc0395164dcfd`.

| Biome | Baseline within 110m | New within 110m | 180m-window relief |
|---|---:|---:|---:|
| sunfields | 14 | 100 | 36.70m |
| dunes | 19 | 97 | 38.71m |
| coast | 18 | 119 | 34.79m |
| autumn | 15 | 79 | 75.42m |
| alpine | 19 | 87 | 62.50m |
| mistwood | 15 | 86 | 67.85m |
| canyon | 17 | 94 | 51.74m |
| lavender | 14 | 77 | 55.92m |

Relief measured at 6m spacing in centered ±90m windows. Tests also exclude protected inner pads; all eight still exceed 18m. Original critical trail maximum one-metre grade: **0.597205**, below 0.8. Core 1.5m mesh comparison sampled at 0.5m spacing: maximum **0.030348m** (analytic floor retained). Outer collision equals its triangles up to floating-point rounding; negative coordinates and both sides of chunk boundaries are covered.

Connected controlled climb: sunfields **(-55,-585) → (-120,-585) → (-55,-585)**. Geometric rise **18.6606m**, max sampled grade **0.4681**. Simulation used only directional movement after the explicit initial fixture placement: 1,353 frames, turnaround rise 18.5142m, returned within 0.5m, 100HP, zero falls, three living nearby threats. This is a controlled traversal regression, not a claim of walking there from the game spawn.

Separate fresh-game ordinary route: `runFrontierTrail('route-sunfields')`, **2,806 frames / 392.72m**, no position edits during traversal, **29 distinct live ambient IDs within 20m and vertical difference <6m**, peak 40 active actors, 100HP at waypoint. Baseline pre-edit static 20m-wide corridor held five ambient slots. Static baseline and actual moving-enemy encounter count are different measurements; the per-biome counts above provide the direct same-method density comparison.

## Failure discovered and fixed

Initial dense generation exposed a pre-existing mismatch: dungeon landmark reservation allowed ambient homes 11m from the entrance, while entering requires no nearby enemy within 15m. Enemies from 16–25m homes also chased into the entrance during ordinary approach. Enlarging only the ground pad could not solve this; player and entrance Y already matched exactly.

Final ambient entrance exclusion is **42m**, beyond ordinary player-to-home pursuit range. This is a separate final acceptance check, preserving original PRNG semantics. All four complete natural dungeon routes then passed, including physical entrance, connected rooms, puzzles, real guardians and return. Log: `/private/tmp/wilds-world-dungeon-route.log`, final line `DUNGEON NATURAL ROUTES PASS`.

## Verification and limits

- `node --test windwake/tests/terrain.test.mjs windwake/tests/world.test.mjs`: focused noise/mesh/pad/legacy/placement/climb/route tests plus existing world streaming, terrain route, settlement and dungeon-render tests. Final output recorded in `/private/tmp/wilds-world-tests.log`: `# tests 22`, `# pass 22`, `# fail 0`.
- `node windwake/tests/dungeon-routes.mjs`: all four natural dungeon routes pass.
- Test additions were run before implementation and failed with missing `terrain.mjs`, as expected. First implementation exposed exact-flat interpolation rounding at a town NPC; difference-form interpolation fixed it without weakening the strict equality test.
- Baseline source artifacts: `/private/tmp/windwake-wilds-baseline-world.json` (provided), `/private/tmp/windwake-legacy-spawns.json` (before-edit original full population), `/private/tmp/windwake-original-world.mjs` (before-edit world source). Regeneration costs <2 seconds, but the original data must be retained until release review completes.
- Real Chrome appearance/frame times, full combat/save saturation suite and deployment are root integration work. This world evidence does not claim those have passed.
- Reusable Korean standard: `docs/standards/game-terrain-generation.md`. It explicitly records that video metadata/description were accessible, captions were empty, and verified video viewing was unavailable. Primary references are linked separately from the user video.

Independent review found an analytic/triangle height jump of 0.0148173m at a nonvertex core edge. The final 3m inner border now smoothly blends to the shared coarse collision triangles. All four sides, sampled every 1.5m including half-cell coordinates, remain continuous within the 0.001m gate. Original puzzles and legacy PRNG sampling still use the unchanged original function.
