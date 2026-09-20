<!-- source: windwake/sim.mjs -->
<!-- source: windwake/render.mjs -->

# ADR-0097: WINDWAKE settlements and local dungeon scenes

Date:2026-09-20. Status: accepted. Supersedes no existing ADR; extends ADR-0096.

## Context
The streamed64× outdoor area has sparse authored content. Genuine dungeons need independent floors, walls and progression; placing geometry below a single outdoor heightfield produces collision/camera/recovery bugs.

## Decision
Keep the standalone vanilla runtime and streamed overworld. Add eight settlements around existing waypoints and four bounded local dungeon scenes. A pure dungeon domain owns immutable geometry and validated progression; simulation and renderer consume the same spatial context. Only one dungeon is active. A separate bounded settlement domain handles NPC quests and equipable relics. Version3 saves migrate old progress and restore valid scene progress at safe entries.

## Consequences
All spatial consumers, camera, actor spawning, save/respawn and travel must explicitly distinguish world and dungeon. Field actors and home defense are suspended during dungeon scenes. Tests must exercise transitions and real paths, not only reset fixtures. Runtime remains static-hostable; publish added modules explicitly. The world remains64× in area; content counts are reported separately and never equated to playtime.
