# Test-strategy spec review

Verdict: **REVISE**. Two concrete planning fixes; neither requires a new user decision.

Seed discovery covered `spec.md`, adjacent contracts/tasks/planning documents, existing `windwake/tests/`, save/runtime integration and relevant repository test standards. Existing vanilla-JavaScript `node:test` tests are the applicable module pattern; Kotlin framework instructions do not imply adding a Kotlin toolchain. Pure state tests, simulation routes, actual Chrome input tests and deployed-byte checks are correctly separated.

## TS-1 — The scale assertion is weaker than the requirement

- Check: acceptance-criterion derivation.
- Evidence: `spec.md:15` requires ±960m and exactly64× the original area. `planning/test-quality.md:5` only proposes ≥50×.
- Fix: assert `WORLD.size === 960` and `(2 * WORLD.size) ** 2 / 240 ** 2 === 64`. Also assert authored counts independently:8 outer regions/waypoints/boss encounters,24 additional points of interest. Area alone cannot establish usable destinations.

## TS-2 — Add executable acceptance cases for the new persistence/streaming boundaries

- Check: negative/edge cases, acceptance mapping and test data strategy.
- Evidence: `planning/test-quality.md:5`–`8` lists broad topics but no measurable workload or persistence checkpoints. `spec.md:18`–`20`, `spec.md:43`–`50` introduce query-order-independent streaming, capped live residency and resumable raids. Existing `windwake/tests/browser.mjs:77` advances routes with `{render:false}`, so those routes cannot prove GPU residency or rendering performance. Existing `windwake/sim.mjs:358`–`374` only restores the v1 adventure and reconstructs transient actors; it supplies no existing raid-resume oracle.
- Fix: add the following cases and report the relevant measured assertions:
  1. **Pure world:** same chunk/query results after different query orders and cache eviction; local collision queries agree with a finite reference set at chunk boundaries. Fixed-seed inputs replay deterministically after a streamed out-and-back journey.
  2. **Rendered stress fixture:** at least three complete multi-region out-and-return cycles, with actual renders at each sample. Assert CPU≤96 chunks, GPU≤64 resident chunks, enemies≤64, bounded effects/projectiles, finite positions and stable buffer counts. Open/close the map during travel to catch accidental whole-world residency. Report frame measurements separately from accelerated/manual steps.
  3. **Save integration:** migrate representative fresh, partial and completed v1 saves; preserve sigils, chests, upgrades, crystals, discovered camps and guardian victory. Roundtrip v2 skill/tree/waypoint/boss/build/crop state. Include NaN/Infinity, unknown/duplicate IDs, oversized arrays/maps, illegal coordinates and contradictory skill/raid state, then advance the loaded game to prove normalized state is playable.
  4. **Raid integration:** save/reload during queued warning, active wave, between waves, immediately after victory and after failure. Confirm resumable enemy/wave state or a documented safe deterministic reconstruction, at most one reward, no next-day scheduling while unresolved, no remote village damage and a resource-free recovery path. Repeat harvest and first-clear reward requests across reload to verify idempotence.
  5. **Gameplay evidence:** retain the existing adapter restriction (`windwake/tests/routes.mjs:3`–`5`). Natural village/skill/regional-boss/defense routes begin fresh and use legal movement/actions without position, inventory, XP, timer or invulnerability injection. Label seeded/teleported stress and combat fixtures explicitly. Add trusted Chrome UI input coverage for new actions; simulation API routes alone prove rules, not control usability.
  6. **Release:** update both publishing and deployed-runtime allowlists for new modules; the existing deployed checker hardcodes eight files (`windwake/tests/deployed.mjs:20`). Public Chrome verification should exercise at least one expanded-world/village action in addition to the retained central journey.

No tests were executed for this read-only spec review. Re-review only the changed verification plan; retain existing combat/physics regression assertions and the original guardian `mode='won'` chapter milestone.
