<!-- source: windwake/tests/depth-browser.mjs -->
<!-- source: windwake/tests/deployed.mjs -->
<!-- source: windwake/publish.mjs -->
# 산길과 삶 — release verification

Public URL: https://game.1989v.com/games/windwake/index.html

## Published version

- Local scoped implementation: d3831770. Isolated published source:26c046791e539da8d61670573e4e2b3d86e4a036.
- Games distribution:a564a7e4. Parent release:0dd5c1047cdc6bc2ddbe2b3a9e9daa3d61465742.
- [Image workflow36568301886](https://github.com/1989v/msa/actions/runs/36568301886): success.
- Manifest3770417082453454d5d14112e5e4a0bd714435d7; portal image ap-chuncheon-1.ocir.io/axyooxbyk5yv/portal-fe:0dd5c10. Argo observed this revision; portal ready replica1. The aggregate commerce app remains Degraded for unrelated services; no claim of full-platform health.
- All20 deployed runtime SHA-256 values match local source and build metadata; JS MIME and missing-module404 verified.

## Evidence

- Full Node suite:244 tests,244 pass,0 fail (verifications/unit-summary.txt). Syntax checks pass. Independent implementation review and independent verdict:SHIP after two proven defects were corrected.
- Chrome local-reviewed: two complete fresh cave approaches/clears/returns, two expedition round trips, connected cave→farm→harvest→craft→use→two reloads. No progression/inventory grants in these acceptance routes. Mountain/valley starts explicitly use existing waypoint fixtures. Both caves use ordinary fresh start inputs.
- Alpine route ascent69.43m; canyon descent36m. Shared surfaces, maximum tested route grade below0.60, no fall-recovery shortcuts. Cave interior height range12m each, same ramp function in drawing/physics.
- Old continuous Chrome journey:8allied towns,16quests,4classic dungeons,11,491m,zero falls, save/continue. Controls: trusted W/Space and mouse orbit, held J combos1/2/3, actual foliage framebuffer difference58,169pixels, physical hill ascent/descent18.514m. Basic attacks retain no stagger/knockback/hit-stop.
- Public core/frontier: original3sigils and ending; farming/building/villagelevel3,2wave defense won,5frontier bosses including final, persisted continue. Console errors0. See verifications/public-core/report.json.
- Public depth rerun:PASS, both fresh caves, both expeditions and connected cave/craft/use/reload route; console errors0. See verifications/public-depth/report.json.
- Screenshots visually inspected: alpine slope, natural cave passage/floor and boss tell, town layouts, home farmer/kitchen/workshop, village menu, map. Regional town and resident presentation fixtures are labeled and do not count as earned progression.

## Corrections and limitations

Review caught double-spending by simultaneous artisans and missing added inventory defaults when restoring a pre-expansion snapshot. Regression tests first reproduced4failures, then verified fixes. Cavern visual inspection led to rock facets and nonoverlapping floor patches; solved windstone route uses a normal walking aisle.

The first controls attempt under concurrent software-rendered Chrome tests moved/jumped but missed the fixed650ms distance threshold; unchanged isolated retry passed. The first public harness invocation used a relative screenshot output directory, causing ENOENT after asset verification. Absolute-path retry passed; harness now resolves both relative and absolute output paths. Original evidence retained where generated.

Headless Chrome154,1280×800,ANGLE SwiftShader. Short steady-state controls sample approximately59FPS is not a hardware/mobile guarantee. Initial loading and device-specific performance work remain deliberately deferred. Caves are separate local scenes with single walkable surface per X/Z, not seamless volumetric overworld excavation. Village count remains8, with distinct layouts and24regional decorations; this release does not claim50times more towns.

Unrelated staged root changes were preserved. Publication used the existing isolated release worktree with latest remote games content. Hooks were never bypassed. Root doctor warned about pre-existing uncited unrelated docs; isolated release hook passed.
