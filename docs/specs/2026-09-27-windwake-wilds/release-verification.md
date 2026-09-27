<!-- source: windwake/publish.mjs -->
<!-- source: windwake/tests/deployed.mjs -->
<!-- source: windwake/tests/wilds-browser.mjs -->
<!-- source: windwake/tests/journey-browser.mjs -->
# WILDS release verification

Completed 2026-09-28 KST. Public URL: https://game.1989v.com/games/windwake/index.html

## Published version

- Source: `1d26445064a712ed28ad7696fee957083a79d3fc` (isolated cherry-pick of local `34582708`).
- Games runtime commit: `24318651560c6b949390efbcf5dec119a0061213`; subsequent shared games commits retain these files.
- Parent integration: `f8ae0eaac5e0b17a08c1cd03483af580cdc78956`.
- [Portal-only image workflow 36324305262](https://github.com/1989v/msa/actions/runs/36324305262): success.
- Manifest commit: `095a98b0786196d24c88df7df9af6aff0933e649`; portal image `ap-chuncheon-1.ocir.io/axyooxbyk5yv/portal-fe:f8ae0ea`.
- Argo synced this revision. Portal deployment ready=1. Whole commerce application reported Degraded; this is not a claim that unrelated services are healthy.
- All **19** public runtime SHA-256 values exactly match checked source and metadata; expected JS MIME and missing-file 404 verified.

## Verification results

- Full Node suite: **203 tests, 203 pass, 0 fail**. `verifications/unit-summary.txt`.
- Independent implementation review: SHIP after correcting core seam and ambient admission priority. `context/implementation-review.md`.
- Local and public Chrome W/Space movement/jump, held-J 1→2→3 combo, right-mouse orbit, three different weapon poses, canopy framebuffer change (58,169 pixels), controlled physical ascent/descent (18.514m), bounded actors/chunks, console 0. `verifications/local` and `wilds-public`.
- Actual Chrome basic-hit regression: all basic stages preserve enemy attack state/velocity and zero hit-stop; enemy retaliates after trusted J; Q still staggers. `verifications/basic-local`.
- Public core journey: three sigils, boss, mode won, zero falls. Public frontier: farming/watering/harvest, village level 3, two-wave defense won, five defeated bosses including frontier final, save/reload/continue passed. `verifications/deployed/report.json`; errors=[] .
- Continuous Chrome fresh-game journey: 93,414 frames, 11,488.69m, eight town alliances/relics, sixteen quests and four dungeons; zero falls, save continuation passed. Local and public results in `continuous-local` and `continuous-public-retry`.
- Initial public continuous harness attempt timed out at its ten-second initialization gate, before gameplay, with no JS errors. Failure screenshot/report retained in `continuous-public`. Identical command rerun with a separate evidence directory passed without runtime changes. This does not establish a guaranteed cold-network loading time.
- Ten repeated indoor/outdoor transitions: world GPU chunks cleared indoors, one dungeon batch, bounded CPU cache, no console errors. Steady-state 58–60 FPS / 16.8ms p95 in this local run. `verifications/stress-local`.

Browser environment: headless Chrome 153, 1280×800, ANGLE SwiftShader software renderer. Public WILDS run sampled ~56 FPS. These short measurements are not mobile/hardware performance guarantees. Fixture screenshots/controlled hill start are identified separately from complete ordinary-input routes; no claim that every input was a human manual playthrough.

## Research and handoff

Reusable standard: `docs/standards/game-terrain-generation.md`. Shared render/collision triangles, connected traversal verification, distinct combat poses and landing input buffering adopted from the Skybound handoff; no discarded engine/runtime imported. The supplied YouTube title/description were accessible, but verified video viewing/transcript was unavailable. The standard identifies that limitation and cites the actual technical references used.

## Release process notes

Shared main contained unrelated staged/dirty work, so publication used `/private/tmp/windwake-release-20260927`. No unrelated working edits were staged or reverted. Existing staged EventType deletion was preserved. A new branch push was rejected by the author hook's scan of historical bot commits; no hook bypass or history rewrite occurred. The successful existing main-scoped portal-only workflow waited for an unrelated JVM build, which was not cancelled. Root commit doctor reported pre-existing uncited-doc warnings; scoped release commits passed their hooks.
