# Verification contract — final army RPG
Critical unit cases: hire costs/caps, fractional-resource economic extinction, exchange10:1 and remainder, worker mining/repair jobs, upgrade1/10 atomicity and caps, promotion source retention on failure, exact recipe ingredients consumption, remote heal price/cooldown, follow/defend separation, movement bounds/obstacles, enemy kill point reward, timed wave, camp destruction ambush, location-isolated combat, field advances while dungeon active, locked dungeon entry, room progression, retreat preserves cleared rooms, dungeon rewardonce, final unlock, final victory, base defeat, emergencyonce + second economic defeat, save roundtrip and malformed/duplicate IDs rejected.
Integration: seeded autonomous user-equivalent actions prepare economy, hire/upgrade, defend, clear camps, dungeons, final boss without editing stats. Report duration and outcomes; never claim balance validated from unit tests alone.
Browser: real keys/taps for party movement and camp/army menus, hire/job/promotion/upgrade/heal/recall; pause/reload saves. Mobile390×844+844×390 rotation, console/errors, three screenshot critiques. Browser actions must not be replaced by internal sim calls. Renderer metrics are read-only.

<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
<!-- source: portal-fe/public/games/marine-command/js/main.js -->
