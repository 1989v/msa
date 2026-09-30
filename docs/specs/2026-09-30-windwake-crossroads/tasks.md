<!-- source: windwake/world.mjs -->
<!-- source: windwake/dungeons.mjs -->
# Crossroads tasks
## Group1: regional world
Dependencies:none. Phase:world. Skills:hns:implement-tasks.
- [x] Capture baseline whole-world identities; add focused grade/geometry/route tests.
- [x] Four CORRIDORS+landmarks/guards; new ruin entrances/approaches; isolated terrain/PRNG.
- [x] Verify node --test windwake/tests/corridors.test.mjs windwake/tests/terrain.test.mjs windwake/tests/world.test.mjs windwake/tests/geography.test.mjs
Acceptance:SR1, old terrain/IDs, safe connected routes.
## Group2: optional ruins
Dependencies:entrance ID contract only. Phase:domain. Skills:hns:implement-tasks.
- [x] New ruins.mjs data and timed circuit tests; dungeons.mjs integration/validation.
- [x] Ordinary fresh approach and both clear/optional/archive reward routes, legacy4scopes preserved.
- [x] Verify node --test windwake/tests/ruins.test.mjs windwake/tests/dungeons.test.mjs windwake/tests/caves.test.mjs
Acceptance:SR2/SR3 puzzle contracts and replay.
## Group3: relics and guidance
Dependencies:catalog contracts. Phase:presentation/domain. Skills:hns:implement-tasks.
- [x] Focused source-backed new relic/effect tests.
- [x] relics.mjs, journey-ui.mjs, main.mjs:10relic catalog; guides/map routes/new ruin information/timer.
- [x] Verify node --test windwake/tests/crossroads-rewards.test.mjs windwake/tests/journey.test.mjs windwake/tests/journey-sim.test.mjs
Acceptance:SR3/4, existing8town16quests unchanged.
## Group4: integration and delivery
Dependencies:1–3. Phase:integration. Skills:hns:verify,hns:validate.
- [x] sim.mjs priority guards/cache proof/both restore paths; render.mjs motifs/routes/timed nodes; publish manifests.
- [x] Full244+suite, combined ordinary corridor→ruin→equip→return→reload; Chrome real input/screenshots/console, improve and rerun.
- [ ] Fresh independent review/verdict, docs synchronization, scoped commit/release, public hashes/play.
Acceptance:SR5 and all cross-layer contracts; deferred loading/hardware tasks remain deferred.
