<!-- source: windwake/tests/basic-attacks.test.mjs -->
<!-- source: windwake/tests/basic-attack-browser.mjs -->
<!-- source: windwake/tests/town-routes.mjs -->

# Basic attack balance verification

2026-09-20. Implementation and local verification complete; public deployment verification pending.

- Regression demonstrated before the fix: 8 targeted tests, 1 pass and 7 failures. After the fix, the full suite reports **177 tests, 177 pass, 0 fail, 0 skipped**. Independent review also ran all 177 successfully; see [review](review.md).
- Original quarry, forest, ruins, journey and optional routes passed. The optional water-fall case is intentional and unchanged.
- Continuous frontier adventure passed: 53,532 frames, 892.2 simulated seconds, 3,738.5 m, 0 falls, 12 kills, 10 parries, village level 3, raid won, final boss defeated.
- Continuous eight-town route passed: 91,809 frames, 1,530.15 simulated seconds, 11,469.02 m, 0 falls, 25 kills, 16 claimed quests, all eight allies/relics, save/load preserved.
- Real Chrome [local report](verifications/local/report.json): each combo preserves enemy attack preparation and velocity with no global hit-stop. Trusted J input damages the enemy from 300 to 284 HP; its uninterrupted attack then damages the player from 100 to 87 HP. Trusted Q still staggers the enemy. No console errors. These combat encounters use an explicitly controlled fixture, not an unassisted playthrough.
- Inspected both local screenshots: basic-hit frame retains the enemy's attack preparation cue and hit feedback; skill frame shows stagger and the player's HP loss from the intervening counterattack.

Commands: `node --test windwake/tests/*.test.mjs`, `node windwake/tests/routes.mjs quarry forest ruins journey optional`, `node windwake/tests/frontier-routes.mjs adventure`, `node windwake/tests/town-routes.mjs continuous`, `node windwake/tests/basic-attack-browser.mjs`.

Only the ordinary sword/plunge control effects and their global hit-stop changed. Damage, rewards, armor, skill/parry control and existing skill-induced pause remain intact.
