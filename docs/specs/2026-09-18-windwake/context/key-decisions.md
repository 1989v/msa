# Decisions

## 2026-09-18 — Standalone original adventure
- Decision: create `windwake/` from zero. Existing dirty work and game submodule remain untouched.
- Reason: the user explicitly excludes existing games/assets and requests no build system.
- Impact: self-contained static web game and this spec folder only. No platform structure changes; platform ADR is not required.

## Simulation and view boundary
- `world.mjs`: shared immutable level definitions, heightAt(x,z), terrainColor(x,z), obstacles/platforms, props, landmarks and spawn definitions.
- `sim.mjs`: pure createGame(seed), stepGame(state,input), snapshot/save helpers. Does not depend on browser, renderer, wall time or audio.
- `render.mjs`: custom WebGL renderer draws supplied state; `audio.mjs`: synth reacts to semantic events; `main.mjs`: input/UI/RAF/save adapters.
- Height is Y. Heading 0 faces +Z; sin(yaw) is X and cos(yaw) is Z. Camera yaw 0 sits behind at negative Z; forward input is +Z. All angles radians. All units metres/seconds.
- Fixed dt=1/60. Input axes moveX(right), moveZ(forward), cameraYaw; actions are Boolean rising-edge buttons in simulation.
- Held actions are edge-detected against `state.previousInput`, included in snapshots. `step(N,input)` repeats the same held input for N fixed ticks, so an action fires once until released. The browser retains a queued press across zero-tick render frames and consumes it only on the first simulation tick; additional RAF substeps cannot repeat that press. Blur/pause clears adapter input and simulation edge history.
- State: frame,time,seed,rng,mode('playing'|'dead'|'won'),player,enemies,projectiles,items,blocks,progress,events,effects,metrics,puzzle.
- player: x,y,z,vx,vy,vz,yaw,hp,maxHp,stamina,maxStamina,energy,maxEnergy,grounded,airState,gliding,action,actionTime,combo,attackTimer,dodgeTimer,parryTimer,invulnerable,skillCooldown,crystals,flasks,checkpoint.
- enemies: id,type('stalker'|'ranger'|'charger'|'boss'),x,y,z,yaw,hp,maxHp,state,timer,hitFlash,homeX,homeZ. Effects: type,x,y,z,age,life,yaw,power; events: type,text?,x?,y?,z?.
- progress: sigils array ('quarry','forest','ruins'), discovered array, chests array, upgrades{health,power}, glider boolean, bossDefeated boolean. Puzzle: runeStep,plateCharge. Blocks have x,y,z,w,h,d,vx,vz.
- World export: WORLD {size:120, spawn:{x,z},waterLevel:-3}, REGIONS[], LANDMARKS[] {id,name,x,y?,z,kind,description}, PLATFORMS[]/OBSTACLES[] {id,x,y,z,w,h,d,kind}, PROPS[] {type,x,y,z,scale,yaw}, ENEMY_SPAWNS[]. Cuboids x/y/z are bottom-center, w/h/d full extents.
- Renderer API: `new Renderer(canvas)`; `resize()`, `render(state,camera,dt)`, `project(x,y,z)`, `dispose()`, `stats`. Camera {yaw,pitch,distance,shake,reducedMotion}; renderer owns smoothing/collision. project returns {x,y,visible} CSS pixels.
- Audio API: `new AudioSystem()`; `unlock()`, `setMuted(bool)`, `update(state,dt)`, `play(event)`, `dispose()`. Both audio and renderer consume but never mutate simulation. Main drains events after each live step.

## Authorization
The comprehensive user request explicitly authorizes game design and implementation and repeated fixes. hns approval/interview gates are already satisfied by that instruction; no redundant permission request. Review and verification remain required.

## 2026-09-19 — Measured play improvements
- Added an intermediate ruin step after testing showed a 3.73m rise exceeded the 2.24m jump apex.
- Wall motion now skips zero-delta axes and uses epsilon contact; the previous overlap rounding could eject a character to a wall end.
- All melee damage branches, including plunge and charge, test static cover. Separate regression proves the wall/trunk cases.
- The initial boss could be defeated by repeated pulse stagger without using defense. Increased health to740 and require3 pulse impacts for stagger; parry keeps its immediate opening. Full route now includes successful parries.
- Third sigil increases resonance damage by12; source data and saves derive glider/stamina from unique sigils.
- Browser verification uses an owned temporary Chrome profile via the repository script. macOS CDP must omit nativeVirtualKeyCode; Windows values in that field stalled input, not the game loop.
