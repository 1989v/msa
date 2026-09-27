<!-- source: windwake/world.mjs -->
# Decisions

- 2026-09-27: Explicit user request authorizes this L3 gameplay work and prior same-game release scope. Keep no-stagger basics. Separate ownership: world/terrain; simulation/combat; renderer/camera/animation and integration. Preserve unrelated dirty files and staged deletion.
- Existing spatial chunking and instance separation (ADR-0096/0097) remain. Preserve legacy authored terrain and critical routes; relief belongs to traversable surrounding landforms, not arbitrary spikes across town floors.
- Use published camera collision/occlusion conventions, without claiming knowledge of Zelda source code. Shader foliage visibility must be restricted to intervening vegetation.
