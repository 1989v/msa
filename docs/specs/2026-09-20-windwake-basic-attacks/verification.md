<!-- source: windwake/tests/basic-attacks.test.mjs -->
<!-- source: windwake/tests/basic-attack-browser.mjs -->
<!-- source: windwake/tests/town-routes.mjs -->

# Basic attack balance verification

2026-09-20. Implementation, independent review, local verification, deployment and public verification complete.

- Regression demonstrated before the fix: 8 targeted tests, 1 pass and 7 failures. After the fix, the full suite reports **177 tests, 177 pass, 0 fail, 0 skipped**. Independent review also ran all 177 successfully; see [review](review.md).
- Original quarry, forest, ruins, journey and optional routes passed. The optional water-fall case is intentional and unchanged.
- Continuous frontier adventure passed: 53,532 frames, 892.2 simulated seconds, 3,738.5 m, 0 falls, 12 kills, 10 parries, village level 3, raid won, final boss defeated.
- Continuous eight-town route passed: 91,809 frames, 1,530.15 simulated seconds, 11,469.02 m, 0 falls, 25 kills, 16 claimed quests, all eight allies/relics, save/load preserved.
- Real Chrome [local report](verifications/local/report.json): each combo preserves enemy attack preparation and velocity with no global hit-stop. Trusted J input damages the enemy from 300 to 284 HP; its uninterrupted attack then damages the player from 100 to 87 HP. Trusted Q still staggers the enemy. No console errors. These combat encounters use an explicitly controlled fixture, not an unassisted playthrough.
- Inspected both local screenshots: basic-hit frame retains the enemy's attack preparation cue and hit feedback; skill frame shows stagger and the player's HP loss from the intervening counterattack.

Commands: `node --test windwake/tests/*.test.mjs`, `node windwake/tests/routes.mjs quarry forest ruins journey optional`, `node windwake/tests/frontier-routes.mjs adventure`, `node windwake/tests/town-routes.mjs continuous`, `node windwake/tests/basic-attack-browser.mjs`.

Only the ordinary sword/plunge control effects and their global hit-stop changed. Damage, rewards, armor, skill/parry control and existing skill-induced pause remain intact.

## Public release

- Runtime source `3b6b5742b171013dcc87aa040678b5a6cc38efd7`, games package `0ca68736`, publication `d83e1856`, manifest update `8bf72d6d`. [Image build](https://github.com/1989v/msa/actions/runs/35490936790) succeeded; [CI record](verifications/ci.json).
- [Rollout](verifications/rollout.json) at 2026-09-20 05:14:25 UTC: portal image `portal-fe:d83e185`, desired/updated/ready/available all 1, observed generation 432 equals desired generation 432.
- [Public game](https://game.1989v.com/games/windwake/index.html): [runtime report](verifications/public-runtime/report.json) verifies all 16 exact SHA-256 hashes, JavaScript MIME types and missing-module 404; trusted movement/jump, original three sigils and boss, frontier farming/defense/final boss, and actual page reload/save continuation passed. No console errors.
- [Public combat](verifications/public-combat/report.json) repeats deterministic combo impacts and real keyboard J/Q using the documented controlled encounter: basic hit retains attack preparation, velocity and zero hit-stop; enemy counterattack reduces player HP to 87; Q still causes stagger. No console errors. The public basic-hit screenshot was visually inspected.
- [Public continuous town route](verifications/public-towns/continuous-report.json) passed all eight towns with 91,809 frames, 11,469.02 m, all eight allies/relics and all 16 quest claims. Four dungeon routes, their boss attacks, and save continuation remain functional; no console errors. Inspected the final continued-game screenshot. Deterministic traversal uses normal simulation inputs; labelled visual replays are separate screenshot-only snapshots.

Public commands: `node windwake/tests/basic-attack-browser.mjs <public-url> <absolute-output>`, `node windwake/tests/deployed.mjs <public-url> <absolute-output>`, `node windwake/tests/journey-browser.mjs continuous <public-url> <absolute-output>`.

Release used the existing isolated checkout and preserved unrelated workspace changes and the user's staged deletion. No hooks were bypassed. The shared workspace's warn-only documentation doctor reported pre-existing unrelated missing citations/broken draft links; the release publication hook passed 100/100.
