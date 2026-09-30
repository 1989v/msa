<!-- source: windwake/world.mjs -->
# Decisions
- 2026-09-30: User approved next work after roadmap recommendation1/2. Implement four regional corridors and two optional ruins; retain deferred loading/device tasks.
- Extend ADR0096/0097; static surfaces, new timed puzzle within existing local-scene domain. No new backend/dependencies. Existing source and distribution paths retained.
- Skills request parallel independent work/review; shared-tree file ownership because tool lacks isolated-agent worktree option. Never revert other sessions' staged/dirty work.
- Preserve legacy PRNG snapshot/reserved predicates and originalHeightfield. New corridors/POIs post-filter only. Existing relic-coast/autumn remain quest sourced; new relic-tide/canopy independently proof sourced.

- Visual play review: Crossroads ruins use open bright sky; canopy guard rails follow ramp grades in <=3m collision/render segments and .95m room rails, exposing neighboring levels. Classic and natural cave lighting stays unchanged.
- Preserve unrelated staged changes with path-scoped commit; publish via clean existing release worktree. Full runtime manifest now21 files including ruins.mjs.
