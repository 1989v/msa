<!-- source: windwake/publish.mjs -->
<!-- source: windwake/tests/deployed.mjs -->
<!-- source: windwake/tests/crossroads-browser.mjs -->
# Crossroads public release

Public URL: https://game.1989v.com/games/windwake/index.html

## Version chain
- Local implementation4a41e2e8; isolated published sourcef384547ea993b35de27254bf69b385b2490107d1.
- Games distributionbae141b5; parent deploymentf73264eee90e289c897415257c2af4265aa0f79b.
- Image workflow: https://github.com/1989v/msa/actions/runs/36729210095 (success).
- Manifest2f9e9299c3471149c9e3f8a93b6564b9288afa2e; portal-fe image `ap-chuncheon-1.ocir.io/axyooxbyk5yv/portal-fe:f73264e`; ready replica1. Argo Synced. Aggregate commerce health Degraded is unrelated; no full-platform health claim.
- Runtime manifest21 files, including new ruins.mjs.

## Scope and evidence
Four routes585–642m,26.7–46.3m relief connect the existing eight towns. Twelve road clues/discoveries, four caches guarded by eight durable enemies; new tide relay ruin8m range and canopy ruin18m range. Catalog:4classic dungeons+2natural caves+2new ruins;10relics with2equipment slots. Old8town16quest catalog preserved.

All282 Node tests pass,0fail. Chrome local-reviewed:4fresh corridor roundtrips,4real guard/cache fights,2fresh complete ruins with optional/archive caches, combined2,124m coast→autumn→canopy→equipped relic→town→two saves/loads. Zero fall recovery on accepted journeys,0console errors, trusted keyboard/mouse controls. Numerical metre-grade/shared surfaces,23,966legacy tuple fixture, both restore proof paths and deterministic deadline boundaries covered.

Independent review SHIP after actual streamed guard metadata correction. Initial screenshots prompted lower slope-following canopy rails and bright open sky; revised geometry retested and screenshots inspected. Runtime basic attack no-stagger/no-knockback/no-hitstop is preserved.

## Delivery notes
Use clean release worktree and latest games main to retain unrelated releases. Unrelated root staged changes preserved. No hook bypass; isolated commit doctor PASS100/100. Shared root doctor warns about pre-existing uncited documents outside game scope.

Hardware/loading optimization is deferred. New ruins are separate static local scenes, not seamless layered volumetric terrain. No added town count or map area claim. Rollback must restore the complete previous runtime and preserve/export current Crossroads saves before using older code; backward save roundtrips are unsupported.

## Public acceptance — PASS

`node windwake/tests/deployed.mjs https://game.1989v.com/games/windwake/index.html docs/specs/2026-09-30-windwake-crossroads/verifications/public-core`:21/21SHA-256values match source/metadata, JS MIME and missing module404 valid, trusted input, original3sigils/ending, frontier final boss, villagelevel3/defense/reload passed;0consoleerrors.

`node windwake/tests/crossroads-browser.mjs https://game.1989v.com/games/windwake/index.html docs/specs/2026-09-30-windwake-crossroads/verifications/public-crossroads`:PASS,4corridorroundtrips,4freshactualguard/cachecombats,2freshruins,combinedjourney/equip/town/save,liveexpiry/retryfeedback;0consoleerrors. Actualserver screenshots inspected. Finalactorcount40within64cap. See each report.json and adjacent screenshots.

Verified public runtime source remainsf384547e; subsequent documentation-only commits do not change runtime metadata or require a new image.
