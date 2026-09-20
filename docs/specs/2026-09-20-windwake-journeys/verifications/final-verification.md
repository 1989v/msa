<!-- source: windwake/sim.mjs -->
<!-- source: windwake/tests/journey-sim.test.mjs -->
<!-- source: windwake/tests/town-routes.mjs -->
<!-- source: windwake/tests/journey-ui-browser.mjs -->

# Journeys verification

2026-09-20. Complete. Implementation, independent review, repeated real-Chrome play/fixes and final public rollout verification passed.

## Scope measured honestly

The original240×240m world became1920×1920m in Frontiers:64× **area**. This update keeps that area and increases authored content. It does not claim64× content or playtime. It adds8regional towns beyond the existing player home,48buildings,24functional residents,16quest stages,4local dungeon instances containing27rooms, and8functional relics with2equipment slots. Houses are exterior scenery around functional NPC hubs; individual house interiors, NPC daily schedules, procedural dungeon rerolls and multiplayer are outside this release.

## Verification evidence

- Final domain/regression suite: `node --test windwake/tests/*.test.mjs`:169tests,169pass,0fail,0skipped (3785ms). The previous120tests remain, with49new checks.
- Original central natural paths: quarry, forest, ruins, journey and optional exploration passed. The optional path intentionally tests one water fall/recovery; it is not a traversal shortcut.
- Existing frontier one-state adventure:53502frames,891.7simulation seconds,3747.26m,0falls,12kills,10parries, farming/harvest/two-wave defense/home level3 and final guardian completed.
- Eight independent settlement adventures physically visit each town, accept/finish/report both stages, defeat a dungeon or regional guardian, claim the relic and form the alliance; no falls. [Results](node-settlement-adventures.json).
- One continuous settlement journey:91845frames,1530.75simulation seconds,11480.52m walked,25kills,0falls;16quest stages,8alliances and8relics retained together through save/load. Uses only normal movement/combat and discovered home fast travel; no teleport/grants/deleting enemies. These optimized automation times are not an estimate of first-time human playtime. [Results](node-continuous-journey.json).
- Real Chrome keyboard movement/jump/E, mouse quest acceptance/report, natural gathering and NPC return, dungeon entry and indoor jump, local map,390×844portrait and844×390landscape relic/map panels, real page reload/Continue:PASS,0console errors. [UI report](ui-report.json).
- Independent nonauthor reviews: [simulation/settlements](../context/cross-review-sim-life.md) and [dungeon/world](../context/cross-review-dungeon-world.md), both SHIP after corrections. Dungeon review also replayed17intermediate saves through physical routes and138camera positions.

## Observations corrected and retested

1. Indoor map drew ceiling geometry over room floors. Filtered ceilings from the overhead map, while preserving actual render/collision ceilings; verified corrected desktop/mobile screenshots.
2. Entry portal jewel obscured the character. Moved it to a side post; verified entry screenshot.
3. Reload removed purchased alpine recovery flasks while retaining their food cost. Version3 now saves a bounded flask count, older saves retain the default; actual service-purchase regression passes.
4. Movable pressure stones stopped the player but not attacks. Unified actor/ray/projectile collision with the moving block geometry, excluding the block itself during integration; sword/projectile cover and actual pressure-puzzle routes pass.
5. Minimum camera distance put the camera in an adjacent wall. Replaced coarse samples with a swept camera segment and near-plane clearance, including shake; wall/door/ceiling tests and independent138position sweep pass.

6. Dungeon boss HUD reused the old sky-guardian title and gave the same dodge hint for different patterns. It now uses the actual dungeon name and explicit instructions for charge, sweep, summon, eruption, slow and leap. The final continuous Chrome run checks the title and tell against each actual boss; all four captured telegraphs passed. [Corrected HUD and full rerun](continuous-hud-r2/continuous-report.json).

7. Public visual inspection found the town HUD offering a new quest after both stages were claimed. Allied towns now point to trade, rest and preparing home defense; the continuous Chrome route asserts this for all8towns. [Retest](completed-hud-r3/continuous-report.json).

Test-controller corrections are separate: coast boss approach now reaches the same16m physical approach as the proven boss route, rather than filtering the actor out from a high midpoint. Retained bounded CPU world cache is allowed indoors; the performance gate checks zero new world generation/query churn, not an unnecessarily empty cache.

## Browser performance and deployment

The reusable real-Chrome harness passed8independent settlement adventures, with27verified-state visual replays and actual page reload for every town. A second one-state Chrome journey matches the Node result exactly:91845frames,11480.52m,0falls,25kills,16claims,8relics/alliances and4dungeon clears retained after real reload. [Continuous report](continuous-report.json). Ten natural enter/exit cycles passed with20scene transitions,0world GPU chunks and1dungeon buffer indoors (386496bytes), bounded CPU cache63/96 and zero new chunk generation during indoor sampling. On exit the dungeon buffer is disposed and ordinary world streaming resumes. [Adventure report](adventures-report.json), [transition/performance report](stress-report.json).

Steady1280×800 SwiftShader measurements after warmup: indoor59.75FPS and outdoor60.00FPS; frameP95≈16.8ms in both4second samples, no dropped simulation time. These are short software-WebGL samples at one location, not a guarantee across devices or the entire world. Trusted touch layouts were emulated, not run on physical phones.

Public rollout verification is complete at [play WINDWAKE JOURNEYS](https://game.1989v.com/games/windwake/index.html).

- Final runtime source:`60bdfc438480315e375f90d7c9574218d641cbd2`; private games:`ff395ab9`; deployment parent:`849ddb3a`.
- [Images run35483296629](https://github.com/1989v/msa/actions/runs/35483296629):success. OCI portal image:`portal-fe:849ddb3`; ready/available1/1 and observed generation matches. [CI](deployment-final-ci.json), [deployment](deployment-final.json). This is the portal deployment status, not a claim that every unrelated cluster application is healthy.
- Final public HTTP checks:all16SHA256 hashes match checked source and metadata; module MIME is JavaScript; missing module404. Actual Chrome keyboard movement/jump, original7730frameending, existing53502framefrontier adventure with farming/defense/finalboss and real reload:PASS,0errors. [Public report](public-final/report.json).
- Final public continuous settlement journey:91845frames,11480.52m,0falls,25kills;16questclaims,8relics/alliances and4dungeons survive actual page reload. All4captured boss names/tells and all8completed-town hints pass. [Public journey report](public-journeys-final/continuous-report.json). Screenshots were visually inspected after the final run.
- First public rollout reports remain inpublic/ andpublic-journeys/ for comparison; final reports above include the last completed-town guidance correction.

Tests/docs are excluded from the16-file runtime publication. No external game engine/assets or Higgsfield were used. All Chrome profiles were isolated and removed by the owned profile stop routine. The shared user worktree and preexisting staged deletion were preserved; only game changes were transplanted into the release checkout, and previously published concurrent changes were retained.

Repository-wide warn-only doctor still reports an existing unrelated draft link and uncited old documents in the shared checkout. Scoped new-document citations/links and diff checks pass; no unrelated files were changed to silence those warnings.
