<!-- source: windwake/tests/frontier-browser.mjs, windwake/tests/frontier-routes.mjs, windwake/tests/frontier-sim.test.mjs, windwake/tests/frontier-regressions.test.mjs -->
# Frontiers verification — 2026-09-19

Local implementation: **PASS**. Public rollout verification is recorded separately in deployment.md once completed.

## Delivered scope

Actual1920×1920m square bounds versus original240×240m: **64× area**, not64× authored content or playtime. Original central adventure preserved. Eight outer biomes with physically traversable roads,8 activated waypoints plus home,8regional bosses/four pattern families plus separate capstone. Eighteen skill nodes across3branches,4equippable abilities,12regular enemy types. Four crops,8buildings,3village levels,2-wave night defenses and recoverable failure.

## Executed evidence

- `node --test windwake/tests/*.test.mjs`: **tests120 / pass120 / fail0**. See unit-tests.tap. Tests cover existing movement/jump/platform/cover/combos/puzzles; expanded AI, abilities, world bounds/routes/streaming; progression, farm economy and malformed persistence; raid lifecycle and regressions.
- Chrome trusted input: WASD movement, physical jump, three-hit combo, pulse, dodge, parry, camera drag/zoom, pause and background input clearing, joystick+simultaneous touch jump and look. `BROWSER INPUT PASS`; actual damage13,combo1,hit1,dodge1 observed in keyboard sequence.
- Chrome original natural journey: all3sanctuaries can be first; full3sigils→updraft→skyboss,7706ticks,8kills,2parries,HP99,0falls,won. Postendingfreeplay and reload pass. Optional treasure/waterfall recovery also passes.
- Chrome expansion UI:2initial points learned edge+sunbolt, assigned ability fired by actual1key. Atlas home travel, legal grid select→preview(no spend)→confirm(one plot), walking toplot, Eplant/Ewater,45s simulation growth/Eharvest. Desktop and390×844touch layouts inspected, no horizontal page overflow.
- Chrome all8outerwaypoints reached by ordinary movement alongTRAIL_ROUTES; actual walk distances392.72–1061.56m,0falls. All8regionalbosses defeated from fresh games with legal starting skills+combat inputs; free exploration retained.
- **Continuous Chrome adventure:** same game from natural farming through actual day1dusk,2raidwaves won, two paid villageupgrades,4regionalbosses and finalcapstone. **53,502ticks /891.7simulationseconds /3,747.26m walked /0falls /12kills /10parries /village3 /beacon180 /finalDefeatedtrue**. No teleport, clock assignment, inventory/XP grants, enemy deletion or direct state writes. Normal validated village/skill/travel commands supplement movement/combat steps. Full browser reload restores final completion, village3, paid raidreward and freeplay. Screenshots tagged visual-replay restore captured checkpoints only after this continuous run passes.
- Three rendered world circuits across8outerwaypoints+home with atlas open/close:27sampled visits, CPUcache≤96, GPUchunks≤49(maxallowed64), residentbytes≈11MB, morethan1,200GPUchunk buffers disposed on revisit/eviction. Teleports here are explicit stressfixtures, not evidence of natural navigation.
- Captured runtime exceptions, consoleerrors and error-level browserlogs: **0** in smoke, journeys, adventure, stress and input suites. Runtime requests are local procedural assets only.

## Measurements and limits

Chrome onmacOS with owned headless profile and SwiftShader. Warm home sample240frames:60.00fps,p95≈16.7ms,p99≈16.8ms; postworldcircuit5s sample58.21fps,p95≈16.8ms,p99≈33.4ms. Separate trustedinput sample58.67fps. These are measured test samples, not promises for every device. First-render/shader warmup showed transient50–200msframes; scene resolution adapts down to0.85during sustainedload while UI remains sharp. Map and fixture traversal samples do not count as steady gameplay FPS. GPUmemory metric counts resident terrain/prop buffers, not total process memory. Real mobile hardware was not tested; touch uses Chrome emulation.

## Observe → fix → reverify

1. Atlas home button was below long central journal: moved frontiers/home navigation to the top; Chrome UI retry passed.
2. Biome radial color seams too harsh: blended boundary colors while preserving paths/physics; renderedatlas rechecked.
3. Dead raid actors accumulated until night8 exhausted64slots: capture durable kill IDs before pruning, including distant paused raids. Ten-night regression and independent reproduction pass.
4. Raiders hit through intactfences: added bodycollision, bothsidestepchecks, targetlock/facing/height/LOS and towercover. Exact reproduction nowplayer100HP,fence110→101.
5. Partial survival trial reload farmed repeated enemy rewards: stablepertrialguardianIDs preserve defeatedguards acrossrestart. Repeatedfirstkill unavailable, XPunchanged.
6. Building spent immediately: addedghostpreview and explicitbuildconfirmation, plus damagedplot repair. Independenthandler check and Chrome select0plots→confirm1plot passed.
7. Localized raid directions, home region label and near-home warning; completion text distinguishes central and frontier endings.

Independent implementation review: SHIP, all3majorfindings closed with reproduction; see ../context/implementation-review.md. The repo-wide nonblocking Docs Health hook still reports an unrelated existing blog link and uncited older docs; gamechecks above pass. No source/assets/services outside the standalone game were changed by the implementation.
