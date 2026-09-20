<!-- source: windwake/sim.mjs -->
<!-- source: windwake/tests/journey-sim.test.mjs -->

# Verification 2026-09-20

| Step | Result | Evidence |
|---|---|---|
| Standards | PASS | Pure dungeon/settlement domains; shared scene collision; root-derived design tokens; two independent nonauthor cross-reviews SHIP after corrections. |
| Lint | PASS | git diff --check over scoped files; Node parse checks for standalone modules. No separate package linter exists. |
| Build | N/A | Explicit no-build static game; publisher allowlist updated to16 runtime files. |
| Tests | PASS | node --test windwake/tests/*.test.mjs:169 tests,169 pass,0 fail,0 skipped,3785ms. |
| Natural routes | PASS | Original5routes; frontier53502frames with farm/raid/finalboss;8settlement adventures; one continuous91845frame journey earns16quest claims/8relics/8alliances with0falls and survives save. |
| Trusted Chrome UI | PASS | Keyboard movement/jump/NPC interaction, mouse quest acceptance/report, real gathering/return/dungeon entry, local map,390×844/844×390 menus and real reload; errors0. |
| Browser full routes / performance | PASS |8natural town adventures + real reloads,10dungeon enter/exit cycles,0errors;1280×800 SwiftShader indoor59.75/outdoor60.00FPS,p95≈16.8ms. One-state all8Chrome run and final boss-title/telegraph assertions pass, with real reload. |
| Deployment | PASS | Images35483296629success; portal-fe:849ddb3 ready1/1; all16publichashes/MIME/404, trusted input, original/frontier/continuous8townplay and real reload pass; consoleerrors0. |
