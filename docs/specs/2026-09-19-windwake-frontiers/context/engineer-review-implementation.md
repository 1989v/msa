# Implementation review — round 1

Verdict: **REVISE**. Expansion is feasible with bounded streaming; the migration inventory and acceptance boundaries need explicit tasks.

## Seed discovery
Read spec, key decisions, ADR-0096, root AGENTS.md, agent-behavior and local DESIGN.md; inspected world/render/sim/main. Applied hns implementation checklist and seed protocol. Review is read-only except this report and the architecture report; no tests were claimed or modified.

## Findings

1. **Check: referenced code / resource limits.** SR-1.4 (`spec.md:18`) cannot be implemented by changing WORLD.size alone. `windwake/render.mjs:298` currently tessellates the entire area, and `:332` uploads every chunk. At unchanged 2.5m sampling, a 1920m square creates 1,179,648 ground triangles and 4,096 current 30m chunks. Replace constructor eager build with local 60m chunks, prioritize the player's immediate tile, build at most a documented count per frame, dispose GPU buffers on eviction, and report resident bytes/triangles rather than a lifetime cumulative staticTriangles value. Stress travel across all region centers and teleports; assert CPU≤96, GPU≤64 and zero stale chunk buffers after dispose.

2. **Check: compatibility / complete migration.** SR-1.4 and retained combat cover (`spec.md:18`, `:26`) require migrating every collision consumer. Current global SOLIDS access exists in horizontal/vertical movement (`windwake/sim.mjs:33`, `:50`), line-of-sight (`:67`), projectiles (`:260`), and player/block collision (`:320`). Camera independently scans OBSTACLES and PLATFORMS at every ray step (`windwake/render.mjs:479`). Create local queries for each, including a segment-covering query for line of sight/camera and correct dynamic block/village solids. Keep static original exports for legacy tests. The map also hardcodes 240px-to-240m mapping (`windwake/main.mjs:151`, `:159`); sample pure height/color at a fixed raster resolution using WORLD.size so opening it never populates chunk caches.

3. **Check: measurable traversability.** SR-1.3 requires walkable destinations (`spec.md:17`), but no route fixtures or acceptable grade are specified. Existing movement rejects terrain steeper than roughly 1.15 rise/run and steps above 0.48m (`windwake/sim.mjs:46`). Author connected clear trails and waypoint arrival pads, keep procedural trunks/rocks outside them, and test a base-character physical route from center to each of eight waypoint/boss approaches. An independent terrain/obstacle connectivity check may supplement this, but teleport fixtures cannot prove reachability. Include village clearing and chunk borders in route checks. Preserve the central puzzle geometry and landmark heights while blending outer terrain.

## Passed / limitations

- Required world/render/main modules exist; progression/village are explicitly new, owned files.
- Save version2 migration, pure dt clocks, deterministic chunk seeds and durable defeat/raid markers are specified.
- A bounded water plane/backdrop is compatible with area expansion; neither needs whole-world tessellation.
- Single-thread browser execution avoids shared-memory races; deterministic generation must still survive eviction/reload and arbitrary query order.
- This is a feasibility review, not evidence of achieved frame rate or completed traversal.

## Required resolution
Add the complete caller inventory and concrete streaming/route tests to implementation tasks, plus the schema decisions from the paired architecture review. Then proceed with the agreed ownership.
