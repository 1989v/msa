# T02A · Pure movement core

Headless simulation only. No character, controls UI, playable build, or deployment is supplied by this packet.

## API

`createTerrain([{ positions, indices }, ...])` accepts flat numeric arrays or typed arrays of indexed triangles in world coordinates. `heightAt(x, z)` returns the highest intersecting triangle height, or `null` outside the surface. It copies triangle data on creation and rejects malformed/nonfinite geometry. Include this game's **first** `continuous meadow` and `walkable-looking…` path meshes. The path sits 0.075 above the analytic surface. Exclude decorative cliffs and distant islands until traversal supports them.

This is an adapter over the actual mesh, not a second terrain generator: T01B uses a jagged 160-segment boundary and 20 radial rings. Reading its triangles preserves both its faceted height and boundary. Analytic `topHeight()` and ellipse bounds alone would drift from the rendered mesh. No Three.js or DOM dependency exists in either core module. Only tests use the existing T01B Three tooling to generate its actual geometry.

```js
const terrain = createTerrain([meadow, path].map(mesh => ({
  positions: mesh.geometry.attributes.position.array,
  indices: mesh.geometry.index.array,
})));
const simulation = createSimulation({ terrain, checkpoint: { x: 0, z: 35 }, progress: {}, waterHeight: -18 });
const frame = simulation.advance(frameSeconds, {
  x: 0, z: -1, yaw: cameraYawRadians, sprint: false, jumpPressed: false,
});
```

The current T01B meadow/path vertices are already world coordinates with identity transforms. If integration transforms these meshes, transform/copy their vertices into world coordinates before creating the adapter.

- `advance(dt, input = {})`: seconds, fixed 120 Hz. At most 0.25 seconds / 30 ticks accepted per call; excess is reported as `droppedTime`. Returns snapshot plus `steps`, interpolation `alpha`, and `droppedTime`. No backlog spiral. Frame subdivision is deterministic for equivalent tick-boundary inputs and no discarded time. Input changes apply to pending fixed ticks; callers needing exact replay must schedule commands by tick.
- Input `x/z`: finite [-1, 1], x right and negative z forward at yaw 0; yaw rotates about +Y. Diagonals normalize while analog magnitude is preserved. `sprint` is a boolean hold. `jumpPressed` is a boolean **press pulse**, not a held key; a pulse on a zero-tick frame remains buffered. Fields default to neutral each call. Invalid input/dt throws before mutation.
- `snapshot()`: detached `position` (feet), `velocity`, `grounded`, `mode` (`idle/walking/running/rising/falling`), `sprinting`, `stamina`, `checkpoint`, opaque `progress`, `respawns`, and integer `tick`. Compare successive snapshots for landing and respawn transitions. This is renderer state, not a persistence schema.
- `clearInput()`: clears pending jump/input and fractional elapsed time. On blur/menu, call this and stop advancing until explicit resume. Neutral next-frame input stops horizontal velocity on its next physics tick; no browser lifecycle is implemented here.
- `setCheckpoint({x,z})`: validates terrain, water clearance and a 0.4-unit cross footprint; changes only the respawn destination. Caller supplies approved safe-point locations. Spawn/respawn use terrain-derived y. It does not identify quest checkpoints or save to storage.
- `setProgress(value)`: clones opaque structured-cloneable progress. Snapshots also clone it. Falling preserves it. Save version/schema validation belongs to T07.

Prototype tuning is exported as `MOVEMENT`: walk 3.2, sprint 6 units/s; jump 7 units/s; gravity 20; 100 stamina, sprint cost 24/s, ground recovery 28/s; jump buffer 0.12s, coyote 0.1s; maximum ground-following step 0.5. Grounded movement into an upward ledge exceeding that step is rejected at the previous x/z, keeping feet on the previous ground. Exhaustion releases sprint until the player releases the sprint intent, preventing automatic speed oscillation. Air control currently uses walk speed. At feet y <= `waterHeight` the simulation restores the safe point and stamina and clears input. The finite constructor option defaults to **-18**, matching this scene's water plane; integration should pass the rendered water height explicitly if it changes. Units and tuning remain subject to playtesting.

## Next hookup and limits

T02B should read snapshots to animate the original character and place its feet at `position`. Render interpolation can use the previous/current snapshots and `alpha`; reset interpolation when `respawns` changes. Do not invent a placeholder model to label this playable. T02 input integration must produce press edges, clear input and pause on focus loss, and wire camera yaw consistently.

Only ground and water contact exist. This is a point-foot heightfield controller, not a capsule solver. Shrine terraces, stairs, trees, rocks, vertical cliff faces and camera collisions are not included; T02 integration must add these before claiming wall/prop collision or an island walkthrough. No glide, wind current, moving platforms, combat, quest implementation, storage or touch controls. The terrain adapter scans triangles with bounding-box rejection; mobile performance requires measurement during integration.

Verify from repository root:

```sh
node --test docs/specs/2026-09-10-skybound/implementation/t02a/tests/movement.test.mjs
```
