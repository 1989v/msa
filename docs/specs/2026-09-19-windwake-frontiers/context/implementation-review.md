# Independent integration review

Final verdict: **SHIP within the reviewed integration scope — all three major findings independently verified fixed**. No runtime files were edited by this reviewer. Scope: sim/main/frontier-ui boundaries with progression, village, combat, streamed world/render and the approved contracts. Runtime owners fixed the findings during this review. The discovery records below are retained as evidence; the final closure results follow them.

The review used source inspection and targeted Node controlled fixtures. Fixture positions, raid clock and defeated enemy state are explicit setup; these are not claimed as natural player journeys. Natural eight-region routes and Chrome work remain owned by the other verification tasks. No full-suite or Chrome-pass claim is made here.

## IR-1 — Dead raid actors exhaust the actor budget across successful nights

**Major.** At discovery, `sim.mjs:17` rejected spawns when the entire `s.enemies` array reached64; `sim.mjs:468` retained every raid actor during streaming. `village.mjs:343–348` awarded victory but did not release the dead wave actors. Saving/reloading happened to clear the debris, but uninterrupted play accumulated seven corpses per won raid.

Reproduction: create a game, travel home, legally build a cottage at `VILLAGE.x+8,VILLAGE.z`, mark the fixture's introduction complete, and advance successive raid days. Kill each instantiated wave in the controlled fixture and tick the real village logic with `spawnEnemy` as its spawn hook. Observed output:

```text
day1 won, actors22, deadRaids7
day2 won, actors29, deadRaids14
day3 won, actors36, deadRaids21
day4 won, actors43, deadRaids28
day5 won, actors50, deadRaids35
day6 won, actors57, deadRaids42
day7 won, actors64, deadRaids49
day8 active wave1, actors64, pending survivors3
```

The eighth raid cannot instantiate any opponent; the player eventually loses to timeout while waiting. This violates bounded active-actor lifecycle and repeatable defense/recovery, even though the numerical64 ceiling is technically respected.

Required correction: commit recorded raid defeat accounting before releasing dead transient actors. Cleanup must also capture deaths before pruning when `tickVillage` returns early because the player is outside the active neighborhood; otherwise frozen saved survivors resurrect on return. Test at least ten consecutive successful nights without reload, plus a ranged kill from outside the64m neighborhood followed by save/return.

## IR-2 — Raid attacks bypass intact player-built cover

**Major.** At discovery, `village.mjs:272` selected the player whenever within4.5m, bypassing its structure-target choice. Its damage path at `:287–289` checked only distance. The movement query at `:299` received static world solids from `sim.mjs:441`, omitting player-built village solids. Thus a player behind an intact fence takes damage through it, and movement can cross the same cover.

Reproduced through the real `stepGame` damage hook:

```js
const s = createGame();
fastTravel(s, 'home');
villageAction(s, 'build', {type:'fence', x:-26, z:-86});
s.enemies = [];
Object.assign(s.player, {x:-26, z:-85, y:heightAt(-26,-85)});
const e = spawnEnemy(s, 'stalker', -26, -87, undefined, {
  id:'raid-1-1-0', raid:true, raidDay:1, raidWave:1, raidIndex:0,
  state:'telegraph', timer:0
});
Object.assign(s.village.raid, {
  status:'active', day:1, wave:1, spawned:true,
  enemies:[structuredClone(e)], defeated:['raid-1-1-1','raid-1-1-2']
});
stepGame(s, {});
```

Output: **player HP100→91; fence HP110→110**. Enemy/player are on opposite sides of the fence, one metre from its center. This contradicts the approved cover and wall-absorption behavior; ordinary combat already uses a line-clear check.

Required correction: use complete village/world collision and cover queries for raid movement and player damage. Keep the structure-targeting behavior so an intact blocking wall is attacked instead of trapping a wave forever. The deterministic sidestep must obey collision too. Repeat the fixture with solid structures and test that a wall can be broken to continue the approach.

## IR-3 — Reloading an unfinished survival trial pays the same defeated actor again

**Major.** At discovery, `sim.mjs:184` created survival-trial enemies using transient generated `spawn-*` IDs and did not check durable defeats. `exportSave` omitted the active trial; `loadSave` reconstructed no surviving trial roster. `dropReward` recorded `worldDefeated[e.id]` but did not check whether that ID had already been paid before awarding its XP/crystals. Saving after killing one trial enemy and reloading therefore restarts the challenge with fresh payable opponents.

Reproduction (controlled setup positions; the kills use ordinary sword inputs and full enemy HP):

```js
const trial = LANDMARKS.find(x => x.kind==='trial' && x.challenge==='survive');
let s = createGame();
for (let attempt=1; attempt<=3; attempt++) {
  Object.assign(s.player, {x:trial.x, y:trial.y, z:trial.z, vx:0, vz:0, vy:0});
  interact(s);
  const e = s.enemies.find(e => e.trialId===trial.id && e.type==='slime');
  const paidBefore = s.adventure.worldDefeated[e.id]===true;
  const before = s.adventure.xp;
  Object.assign(s.player, {x:e.x, y:e.y, z:e.z-2, yaw:0, energy:100});
  for (let i=0; i<80; i++) stepGame(s, {attack:i%30===0});
  console.log(attempt, e.id, paidBefore, e.hp, s.adventure.xp-before);
  s = loadSave(exportSave(s));
}
```

Observed:

```text
1 spawn-12 false 0 +32XP   # includes the first region discovery
2 spawn-14 false 0 +12XP
3 spawn-14 true  0 +12XP   # same durable defeat ID paid again
```

`trial-sunfields` remains incomplete throughout. Repeating the third attempt gives repeatable skill progression without completing the encounter, contrary to durable first-clear/defeat accounting. The completed trial reward itself is correctly guarded; this defect is the per-enemy reward/reconstruction boundary.

Required correction: establish stable trial actor identity and a durable payout/resume policy. Suppressing individual trial drops and paying only the once-only completion reward is also sufficient if clearly retained in the gameplay contract. Reload/abandon/cap-blocked retry must remain completable and must not pay an already paid enemy or completion again.

## Bounded review notes

- At discovery, crop repair UI preferred the plot record over its owning structure, leaving an HP0 plot without a repair control. The owner added the matching structure repair action; independently verified below.
- At discovery, the build grid spent immediately on cell click. The owner added a world preview state and explicit confirmation; independently verified below. Actual Chrome input/screenshots remain with the root verification task.
- The actor caps, local world queries, validated skill economy, pause-by-main-loop behavior and serializable raid ledger are present. Their presence does not replace the outstanding full integration/route/performance verification.

## Final independent closure

| Item | Result | Evidence |
|---|---|---|
| IR-1 repeated raid actor exhaustion | CLOSED | Real stepGame fixture completed10 successive nights without reload; actors15 and raid actors0 after victories. |
| IR-1 distant kill accounting | CLOSED | A dead raid actor outside the64m neighborhood is recorded before pruning; save/load restores exactly2 survivors and does not resurrect the dead ID. |
| IR-2 cover bypass | CLOSED | Original integration fixture now keeps player100HP, reduces fence110→101HP, and leaves the raider outside. |
| IR-3 survival trial replay | CLOSED | Reload omits the paid stable actor trial-sunfields-guardian-0; restart leaves XP unchanged at32 and retains two remaining guardians. |
| Placement preview/confirmation note | CLOSED | DOM-handler fixture: selection spends0 and creates0 plots; confirmation spends4 wood and creates1 plot, then clears buildPreview. Renderer reads that preview; closePanel clears it to cancel. |
| Damaged plot repair note | CLOSED | DOM-handler fixture finds the damaged plot repair button, invokes the domain action, and restores60HP. |

Executed regression commands and output:

```text
node --test windwake/tests/frontier-regressions.test.mjs
# tests 3
# pass 3
# fail 0

node --test --test-name-pattern='nearby player|raid strikes|raid windup|blocked raid sidesteps|tower shots' windwake/tests/life.test.mjs
# tests 5
# pass 5
# fail 0
```

Additional read-only inline Node fixtures produced:

```text
PASS ten consecutive raid victories: actors=15, raid actors=0
PASS trial reload omits paid actor trial-sunfields-guardian-0; XP unchanged 32
PASS distant kill captured before prune; reload restores exactly 2 survivors
PASS integrated fence interception: player100HP, fence101HP, raider stays outside
PASS UI selection spends0, confirmation creates1 plot/cost4, preview clears
PASS UI damaged plot repair invokes domain action and restores60HP
```

No remaining blocking/major finding in this bounded review. This verdict does not claim that the final full-suite, natural-route, real-browser UX/performance, or deployed-byte verification has completed; those remain the release task's responsibility.
