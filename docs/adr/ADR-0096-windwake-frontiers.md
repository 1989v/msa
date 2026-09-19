<!-- source: windwake/world.mjs, windwake/render.mjs, windwake/sim.mjs, windwake/progression.mjs, windwake/village.mjs -->
# ADR-0096 — WINDWAKE streamed world and pure life/progression modules

Status: Accepted for implementation (2026-09-19; user-authorized expansion).

## Context
The existing standalone WebGL game eagerly builds a240×240m world and updates a small complete enemy list. A64× area expansion with farming/defense cannot keep whole-world geometry and active AI resident. Existing platform architecture remains unchanged.

## Decision
Use seeded spatial chunks with bounded CPU/GPU caches and local collision queries. Keep only nearby transient actors active; persist defeated encounter IDs and durable progression separately. Extract pure progression and village modules below simulation/UI, retain vanilla modules and existing procedural renderer. The UI never owns economic validation or world mutation rules.

Version2 saves migrate version1, bound input data and persist village clocks/raid markers. Simulation time drives crops and invasions; offline time is harmless. Distant raids queue visibly until the player returns. Keep original central gameplay as the first chapter and add regional progression.

## Consequences
Memory/work per frame is tied to the active neighborhood, not total area. Chunk transitions and unload/reload persistence require stress tests. Data-rich content is easier to add, at the cost of explicit module contracts and save migration. No new backend, framework, DB, hosting mode or external asset service is introduced.
