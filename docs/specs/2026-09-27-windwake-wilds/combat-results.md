<!-- source: windwake/sim.mjs -->
<!-- source: windwake/combat.mjs -->
<!-- source: windwake/melee.mjs -->
<!-- source: windwake/progression.mjs -->
<!-- source: windwake/tests/wilds-combat.test.mjs -->
# Wilds simulation and combat evidence

Shared `COMBO_STAGES` is frozen pure data, indexed by `player.combo - 1`. Simulation impacts and renderer poses use `player.attackElapsed`. Cut/rising/overhead durations are 0.48/0.56/0.78 seconds; impacts occur at 0.17/0.23/0.36 seconds, with existing 16/21/38 damage and existing reach/arcs. Held attack chains; discrete presses buffer; release/timeout and dodge cancellation remain. Basic and plunge hits retain no stagger, knockback or hit-stop. Basic slash effects identify themselves with `basic:true`; hit effects explicitly carry their control-hit status.

Ordinary resistance is differentiated: stalker 100 HP/18 damage, ranger 76/16, charger 120/24, wolf 82/18, boar 112/22, shaman 74/14, sentinel 144/22. Introductory slime remains 36 HP/10 damage. Stalker windup/recovery is 0.55/0.55 seconds; ranger tell 0.8 seconds; wolf recovery 0.75 seconds. Every ordinary initial attack is tested to retain at least 0.45 seconds of telegraph. The longer player commitment, shorter melee recovery and pack follow-up make timed defense useful alongside the HP changes. Skill and parry control windows remain functional.

## Paired normal-stat fixtures

Seed 8123; player 100 HP, no gear, upgrades, learned abilities or healing; initial enemy distances 4.5 and 5.41 m; normal enemy stats; 45-second limit. After the initial controlled placement the controller only sends ordinary movement, attack, dodge and parry input. These are controlled balance fixtures, not exploration evidence.

| Encounter | Attack only | Parry + projectile dodge | Dodge only |
| --- | --- | --- | --- |
| Stalker | Win, 64 HP, 2.75 s | Win, 100 HP, 1.62 s, 1 parry | Win, 100 HP, 10.35 s, 6 dodges |
| Stalker + ranger | Win, 32 HP, 5.37 s | Win, 100 HP, 13.35 s, 1 parry/7 dodges | Win, 100 HP, 11.37 s, 6 dodges |

Defensive advantages are 36 and 68 HP, including runs with zero parries. The tests enforce survival, victory, time budget and at least 25 HP advantage; they do not grant defensive controllers stronger stats.

## Streaming and persistence

Ordinary admission stops at 40 resident actors, reserving 24 of the hard 64 slots for authored encounters. Bosses are considered first, followed by distance-sorted ambient candidates. At the ordinary admission limit, a closer candidate replaces an eligible distant ambient resident only with a 12 m distance advantage and an outgoing distance above 40 m. This prevents far residents below the 145 m unload threshold from starving the next encounter; it also avoids residency churn. Injured, engaged and authored actors, including summoned actors, are protected from this replacement. New ambient admission excludes the immediate 9 m arrival radius. A saturated old field can admit priority actors by evicting only dead ambient actors or untouched idle ambient actors more than 40 m away; raid, dungeon, trial, boss and engaged actors are ineligible. Distant engaged actors get an AI tick to resolve their leash before normal dormant residency. Ordinary idle AI runs only within 45 m (boss/instance 80 m).

Tests saturate all 64 slots, preserve an engaged actor during boss admission, instantiate all three survival guardians and all three first-wave raiders, and park/restore a saturated field through a dungeon. Saves retain up to 16,384 valid defeat IDs, including suppressed legacy IDs. Tests round-trip the full generated population plus enough legacy IDs to exceed 4,096, as well as the entire 16,384-entry budget. Grounded snapshots and recovery positions rebase to physical support on current terrain.

Near-landing jump tests cover falling velocities -2/-8/-18 m/s with an unlocked glider: input remains buffered and produces a jump after contact. An already-open glider still folds explicitly.

## Verification and intentional expectation updates

- `node --test windwake/tests/basic-attacks.test.mjs windwake/tests/combat.test.mjs windwake/tests/sim.test.mjs`: 61 tests, 61 pass, 0 fail.
- `node --test windwake/tests/frontier-sim.test.mjs windwake/tests/frontier-regressions.test.mjs windwake/tests/journey-sim.test.mjs windwake/tests/wilds-combat.test.mjs`: 40 tests, 40 pass, 0 fail; includes an unchanged natural frontier adventure earning farming, two defense waves, village level 3 and final victory.
- `node windwake/tests/town-routes.mjs continuous`: `CONTINUOUS SETTLEMENT JOURNEY PASS`, 93,414 frames, eight alliances, eight relics, sixteen completed quests, 11,488.69 m, zero falls. All original natural-input assertions retained.
- `node windwake/tests/routes.mjs journey optional`: exit 0; original adventure and optional cache/water recovery paths completed with original assertions.

Intentional old-test updates: held attacks now chain; normal legacy stat table reflects the stated tuning; impact fixtures import the shared timeline (including the browser's controlled 300 HP fixture); ten-night residency now checks ordinary <=40 and total <=64 rather than old population <25, while retaining full wave counts; the defeat-persistence fixture first streams at 10 m, then places the controlled kill within reach, respecting the new arrival exclusion. Collision, reward uniqueness, progression, natural-route and no-basic-control assertions remain intact.

## Fresh-review correction: near encounter admission

A fresh review reproduced two undefeated encounters 16–19 m away being excluded during an ordinary sunfields walk because 40 resident actors included untouched idle actors 90–107 m away. Added a regression using the unchanged natural route controller: at frame 900, both `wild-v2-0--4-0-2` and `wild-v2-0--4-0-0` must be resident; every frame checks ordinary <=40 and total <=64. The regression failed before the replacement fix and passes afterward. A separate saturated fixture protects injured, telegraphing, boss, trial, raid and summoned actors during nearby admission.

After this correction: `node --test windwake/tests/wilds-combat.test.mjs windwake/tests/frontier-sim.test.mjs windwake/tests/frontier-regressions.test.mjs` reports **34 tests, 34 pass, 0 fail**. `node windwake/tests/dungeon-routes.mjs` reports **DUNGEON NATURAL ROUTES PASS** for all four instances. `node windwake/tests/town-routes.mjs continuous` again reports **CONTINUOUS SETTLEMENT JOURNEY PASS**, 93,414 frames, eight alliances/eight relics/sixteen quests and zero falls.
