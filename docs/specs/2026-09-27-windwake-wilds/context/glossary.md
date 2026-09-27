<!-- source: windwake/world.mjs -->
# Game-local terms

WINDWAKE is an isolated static game, outside the commerce bounded-context map.

- Encounter: stable world placement describing one creature or a related group.
- Actor: currently instantiated enemy simulated in the active scene; at most 64.
- Biome: region with its own relief, vegetation, enemy choices and destinations.
- Protected hub/route: authored safe settlement/arrival/critical path with placement exclusions and slope constraints.
- Terrain seed/version: reproducible generator inputs; changing the version requires save/placement compatibility decisions.
