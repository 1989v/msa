# Architecture review — round 1

Verdict: **REVISE**. The streamed world and pure progression/village split are feasible; no architecture blocker. Scope reviewed: world residency, collision boundaries, shared rendering data, compatibility.

## Seed discovery and evidence
Read spec and key decisions, root AGENTS.md, agent-behavior standard, ADR-0096, world/render/sim modules and main map code. Relevant hns architecture checklist and seed protocol applied. No `docs/checks/` or `.claude/rules/` directory exists; HNS_KB_PATH is not configured. Existing game is a standalone vanilla module application; backend service layering does not require introducing adapters into this renderer.

## Findings

1. **Check: interface information hiding / cross-module boundary.** SR-1.4 promises local collision work (`spec.md:18`), but `key-decisions.md:12` does not define whether `querySolids` returns cuboids whose extents overlap the query or only centers, nor valid radius bounds. A wide platform can cross an owner chunk while its center is outside the query (`windwake/world.mjs:64`, sky island); omitting it breaks support and cover. Specify AABB overlap semantics, stable deduplication by ID, bounded supported radii and cross-boundary coverage. Retained global SOLIDS must mean the original authored solids only, not the growing world. Query callers should not know procedural chunk internals.

2. **Check: shared schema ownership.** SR-4.3–5 requires crop stages and synchronized night rendering (`spec.md:37`), but the renderer contract calls clock a “fraction” while village clock units and crop growth units are unspecified (`context/key-decisions.md:14`, `:23`). Fix one clock unit/range and one daylight calculation; define plot growth range/stages, structure building IDs and hp/maxHp, resource node material/yield fields, and all regular enemy type/boss family IDs before parallel implementation. State missing village/adventure fields must render legacy fixtures as daylight. Rendering must not mutate clocks or use simulation RNG (`context/key-decisions.md:7`).

## Passed

- ADR-0096 records the structural change; world remains beneath simulation/rendering and village/progression do not import simulation.
- Deletion test: progression validation/rewards are shared by UI, simulation and persistence; village action/time/raid rules serve the same multiple consumers. These modules hide substantive complexity rather than pass calls through.
- CPU ≤96 and GPU ≤64 chunk ceilings and active enemies ≤64 create meaningful bounded seams (`context/key-decisions.md:12`, `spec.md:19`).
- Original IDs/exports and separate `adventure.finalDefeated` allow summit chapter compatibility without conflating the frontier capstone (`context/key-decisions.md:29`).

## Required resolution
Record the collision and state schema contracts above in key decisions, then proceed. No human permission is required to resolve these routine implementation details.
