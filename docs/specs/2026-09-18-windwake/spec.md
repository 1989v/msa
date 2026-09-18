<!-- source: windwake/world.mjs, windwake/sim.mjs, windwake/render.mjs, windwake/main.mjs, windwake/audio.mjs, windwake/input.mjs -->
# WINDWAKE — 바람의 잔향

## Goal
A complete, original, freely explorable third-person browser action adventure, built from zero with vanilla ES modules, CSS, Canvas WebGL and Web Audio. Play through three nonlinear sanctuary challenges, earn traversal/combat upgrades, ascend the released wind column, defeat the summit guardian, then continue exploring. No engine, build step, network dependency, copied assets, or Higgsfield.

## User Stories
- As an explorer I choose between recognizable regions and discover caches, camps, ruins, a grotto and a high summit; elevation is physical rather than cosmetic.
- As a fighter I read telegraphs, dodge or parry, chain three directional sword attacks, and combine an airborne strike with a resonance pulse.
- As a problem solver I move a stone onto a plate, interpret a rune-order clue, and climb broken platforms to activate a high beacon.
- As a returning player I continue a validated local save and recover at a camp after death.

## Specific Requirements
### SR-1 Space and traversal
1. A connected approximately 240 by 240 metre landscape has meadow, woodland, quarry, lake/ravine, grotto and elevated ruins. Paths connect regions; stepping stones and ramps provide alternative crossings.
2. Player position is x/y/z, y is elevation; gravity, jump ascent/apex/descent/landing, coyote time, buffered jumps, aerial steering, ground slope and solid obstacle collisions are simulated at fixed 60Hz.
3. WASD movement is camera-relative; Shift sprints, Space jumps and toggles earned gliding; right-drag or arrow keys orbit, wheel zooms. Camera follows and adjusts for terrain/obstacles. Touch controls offer movement, orbit and core actions.
4. Falls/water return to a safe point with feedback and a health cost; never softlock progression. Escape/tab visibility suspends gameplay and clears held inputs.

### SR-2 Combat
1. Mouse/J three-hit sword combo has startup, active and recovery windows, input buffering, directional and vertical hit checks, knockback and distinct finisher.
2. Bindings: Shift sprint, K dodge, Q resonance pulse, F parry, E interact, H heal, M map, Escape pause. Each is described in game; dodge costs stamina and has a finite invulnerability window.
3. A pulse consumes energy, damages/staggers foes and pushes the puzzle stone; air attacks create a landing shock. Energy returns over time and on combat success.
4. Melee, ranged and armored charger enemies use explicit idle/chase/telegraph/attack/recover/hit/dead states. Attacks respect vertical separation and geometry; shield enemies reward pulse/parry/flanking.
5. Boss has at least two phases, distinguishable ring/slam/ranged attacks, safe recovery and a real defeat ending. The objective and entrance become available after all three sigils.
6. Hits trigger procedural sound, short render hit-stop, visible trails, particle bursts, flash, knockback, health bars and optional reduced screen shake. Effects and entity collections are bounded.

### SR-3 Discovery, puzzles, reward
1. Three independently solvable sanctuaries, all reachable/solvable using only the starting jump, stamina and pulse: quarry pressure plate with moveable resonant stone; woodland rune sequence deduced from an in-world riddle with retry; elevated ruin reached by actual platform traversal. Interacting with the quarry plinth resets a lost stone; incorrect rune input resets only the sequence. No consumable is required to retry.
2. The first sigil grants a sail for gliding, subsequent sigils improve stamina and resonance; three sigils activate the central updraft to the boss.
3. Optional caches give crystals or health flasks; defeated enemies drop crystals. Camp upgrades spend crystals on health/power; rewards are idempotent.
4. Interact prompts, journal/map, landmark markers and contextual guidance communicate goals without requiring a manual. Camp restores resources and is a checkpoint; fast travel is limited to discovered camps outside combat.
5. Death offers respawn at camp and preserves earned progression while resetting transient enemies, projectiles and unsolved puzzles; lethal fall penalties use that same death path. Boss retries remain available. Victory displays completion statistics; dismissing the ending resumes free roam and a completed save reloads into free roam. Local saves preserve earned progression and do not serialize transient combat states; invalid data is rejected safely.
6. Sigils are a unique set of recognized IDs. Each unique sigil grants its reward tier once; duplicate acquisition grants nothing. Sail unlock and derived stats are consistent with validated progress, boss access requires all three, and contradictory saves are rejected or normalized to these invariants.

### SR-4 Execution and verification
1. Direct static serving works: `python3 -m http.server 8787 --directory windwake`. No build system and no remote runtime assets.
2. `window.WINDWAKE` exposes reset(seed), step(frames,input), state(), teleport(), spawnEnemy(), grant(), snapshot/restore and manual/live mode. Simulation uses seeded randomness, fixed time and plain serializable data; reset plus same inputs yields the same state.
3. Node tests verify physics, collision, combat state machines, combo/dodge/parry, AI, progression, retries, saving and determinism. Test-only conveniences do not count as evidence of player-path completion.
4. Real Chrome checks keyboard/mouse and trusted touch input (movement/orbit/actions/cancellation), screenshots, rendering, console errors, pause/background with held input, restart/save, a normal full progression path and frame metrics. Fresh-game player-input routes reach and solve each sanctuary first without teleport/grant. Maintain an observed issue/fix/retest record, with at least two play-and-improve cycles.
5. Target stable 60fps at desktop 1280x800; measure achieved performance, avoid claiming portable guarantees. Cap pixel ratio/draw distance, cache static geometry and bound particles.

## Visual Design
Painterly low-poly islands and hills: muted jade landscape, warm limestone ruins, amber signal fires and pale teal wind. A small caped wanderer with visible sword is always legible. The scene fills the screen; restrained parchment/ink HUD shows health, stamina, sigils and current discovery. UI typography/spacing derives from root DESIGN.md; named local palette tokens are documented in windwake/DESIGN.md. No external fonts/images.

## Existing Code to Leverage
No existing game source or assets. Only repository conventions and existing browser verification tools are used. Standalone source directory `windwake/`; no catalog, backend or database change. The user's subsequent deployment request authorizes publishing runtime copies through the existing games submodule and portal-fe image.

## Out of Scope
Multiplayer, accounts, external models/assets, infinite terrain, cinematic voice acting, a AAA content volume. Scope decisions preserve all requested core play loops.

## Open Questions
None. The user authorized autonomous design, implementation, playtesting and improvement, then explicitly requested deployment on 2026-09-19.

## Local Gameplay Terms
Sanctuary: a region's physical challenge. Sigil: unique durable proof of solving that sanctuary. Resonance: the Q pulse that damages enemies and moves the quarry stone. Sail/glider: the same first-sigil aerial ability. Checkpoint: discovered camp used for rest and respawn. Crystal: collectible currency for permanent camp upgrades.
