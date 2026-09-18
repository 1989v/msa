# WINDWAKE verification — 2026-09-19

Result: **playable complete adventure; core and optional routes verified in Chrome**. The final runtime is self-contained vanilla JavaScript/CSS/WebGL/Web Audio, with no engine, build step or external runtime asset request.

## Executed evidence

| Check | Result | Evidence |
|---|---|---|
| Pure simulation and input tests | PASS — 35 tests, 0 failures | `node --test windwake/tests/*.test.mjs`; [TAP output](unit-tests.tap) |
| All first-shrine routes and full journey | PASS | `node windwake/tests/routes.mjs quarry forest ruins journey optional`; [route checkpoints](routes-node.jsonl) |
| Real Chrome input | PASS | `node windwake/tests/browser.mjs input routes optional`; [input report](input-report.json) |
| Each sanctuary first, starting equipment | PASS | Quarry2473 / forest2231 / ruins1933 fixed ticks; [browser route report](routes-report.json) |
| Full exploration → reward → ascent → boss loop | PASS | 7706 fixed ticks, 3 unique sigils, 7 platform jumps, 8 kills, 2 parries, ending; [report](routes-report.json) |
| Optional discovery and environmental recovery | PASS | 3 caches, cave entry/exit, 8 lake jumps, one deliberate water fall, HP100→85, normal movement resumed; [report](optional-report.json) |
| Saved completion / reload / free roam | PASS | Real page reload, trusted Continue click, 3 sigils and boss-defeated preserved, mode playing |
| Browser exceptions / console errors | PASS — 0 captured | Input suite captures Runtime.exceptionThrown, console errors and Log.error; route suite captures exceptions. Optional report records gameplay state only. Input report confirms local asset requests only |
| Fresh-context implementation review | SHIP | Cover findings fixed and regression retained. Final independent reviewer reran all 35 tests, five route scenarios and 11 module syntax checks; checked route integrity and raw performance evidence |
| Static serving / module syntax | PASS | All `.mjs` parsed with `node --check`; HTTP200 from local server |

The browser full route uses `state()` reads and fixed-step movement/action inputs. It never teleports, grants sigils/items, deletes enemies, sets their health or restores intermediate states. Unit tests use controlled fixtures where appropriate and are not presented as normal-play evidence.

## Actual input and screens

Chrome received trusted keyboard/mouse events for starting, walking, jump/landing, three separate sword strikes, pulse, dodge, guard, camera orbit, map and Escape. The captured event sequence includes `attack1`, `attack2`, `attack3`, `pulse`, `hit`, `dodge`, `guard`; the player received actual enemy damage.

Trusted multi-touch exercised joystick movement (2.96m), simultaneous jump, camera drag, attack and touch cancellation. Cancellation cleared both axes. Tested viewports: desktop1280×800, touch844×390 and390×844.

A second real browser tab made the game document hidden. Its frame counter remained unchanged, pause menu appeared and held keys/pending actions/axes were empty. Switching back and resuming did not leave movement stuck.

Inspected screenshots:
- [Title](title-r1.png), [jump](jump-r1.png), [combat](combat-r2.png), [atlas](atlas-r2.png).
- [Touch landscape](touch-r2.png), [portrait](portrait-r2.png).
- [Quarry](journey-quarry-r3.png), [forest](journey-forest-r3.png), [high observatory](journey-ruins-r3.png), [summit](journey-summit-r3.png), [ending](ending-r3.png).
- [Lake recovery](lake-recovery-r4.png).

## Observed problems and improvements

| Observation | Change | Revalidation |
|---|---|---|
| First ruin rise3.73m exceeded the measured2.24m jump apex | Added an intermediate physical step | All7 actual jumps pass with initial equipment, including ruins as first shrine |
| Holding right against a wall ejected the player along the unmoving Z axis | Skip zero-delta axes; epsilon contact | Solid-wall regression and real routes pass |
| Attacks could cross solid cover | Segment/AABB obstruction for sword, pulse, enemy melee, plunge and charge | Quarry-wall and tree-cover regressions pass |
| Far shrine signals faded into fog; enemy warnings looked alike | Taller beacons, restrained fog, distinct correctly sized attack sectors/rings/lanes | New screenshots inspected; routes stayed readable |
| macOS CDP keys stalled for20s | Omitted Windows values from nativeVirtualKeyCode | Repeated trusted input suite completes; confirmed automation issue rather than game hang |
| Early boss was kept in perpetual pulse stagger | Boss740HP, three pulse impacts to stagger, parry retains immediate opening | Complete player-input route wins with2 successful parries and healing |
| Western lake entry had ~16m of water before its first stone | Added3 shore approach stones |8 physical jumps reach cache; deliberate fall recovers safely with reward retained |
| Software WebGL averaged ~50fps at full internal resolution | Cached chunk frustum culling and sustained-frame-budget resolution adjustment; full-resolution DOM HUD retained | Final6s sample:57.34fps, P95=16.8ms, P99=33.4ms, no dropped-time clamp |

## Performance and limits

Measured in **headless Chrome with SwiftShader software WebGL**, not a physical mobile GPU. Final viewport1280×800; adaptive internal scene922×576; UI remains native size.344 frames in the final6-second sample, average JS render submission0.30ms,34 draw calls and approximately19k visible triangles. See raw [metrics](input-report.json). The nominal60fps target is approached; this is not a guarantee of sustained60fps on every device.

Collections are bounded: effects100, drops120, projectiles60, enemies64, audio voices28. Repeated reset reuses the renderer. Audio only initializes after a user gesture. Save corruption is handled by starting safely; unique progression and derived abilities are normalized. Reduced camera motion and a native-resolution preference are available in pause.

No physical phone, Safari/Firefox, real speaker listening test or production hosting was performed. Procedural sound execution, gesture activation, mute lifecycle and bounded voices were checked; sound-device playback quality remains dependent on the user's device. The game is a compact original adventure, not AAA content volume.

## Repository scope

Only `windwake/` and this spec directory are owned by this work. Existing game assets, submodules and unrelated staged/dirty changes were not used. No Higgsfield request/authentication, deployment, publishing, backend/API/DB change or external asset generation was performed.

Doc impact scan executed read-only. The global source-index policy excludes this new standalone path and `.mjs`; no platform document-index policy or lock regeneration is required. Local README, spec, tasks, decisions and verification records describe the implemented game.
