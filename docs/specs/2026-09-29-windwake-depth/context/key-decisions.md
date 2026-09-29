<!-- source: windwake/world.mjs -->
# Decisions
- 2026-09-29: User prioritizes combat/exploration/life and real mountain/valley/cave/town depth; defer cold-start and device performance work.
- Extend existing pure modules/local scenes (ADR0096/0097); two new optional cave IDs, original four dungeons unchanged. Preserve durable legacy spawn semantics and old saves.
- Existing explicit implementation/deployment authorization applies; no redundant approval interview. HNS reviews remain required. Tool does not expose isolated agent worktrees; parallel changes use disjoint file ownership in shared tree, parent handles integrations.
- Baseline:203 tests passed,0 failed. Log /private/tmp/windwake-depth-baseline.log (~7s to regenerate).
