<!-- source: windwake/village.mjs -->
<!-- source: windwake/settlements.mjs -->
<!-- source: windwake/frontier-ui.mjs -->
<!-- source: windwake/journey-ui.mjs -->
<!-- source: windwake/tests/community.test.mjs -->
# Life and defense evidence — Task 3

Implemented SR4 and SR5 town-dialog portion. Four crops retain previous food/seed yield, add one typed produce per harvest. Kitchen/workshop support early trailMeal (turnip+wheat, 45 HP/35 stamina), cave-canyon repairKit (pumpkin+wood2+stone2, repair100), cave-mistwood growthTonic (moonflower+turnip, water/growth45). Inventory bounds 9999; no migration harvest/reward. Actions check catalog own keys, local scene/range, resources, output bounds and validated unlock before mutation. Recipe completion is validatedExpedition claimed progress with required puzzle/encounter facts, never a naked clear flag.

Eight named regional residents require validated local+regional claims. Each intact cottage provides one worker slot, max8; catalog-ID ordering selects active workers regardless of save/invitation order. Excess retain job/timer; jobs pause away (>64m), in dungeon/menu, and with no intact housing. Farmer waters every6s, artisan spends wood1/stone1 for repair30 every8s, guard attacks visible same-floor nearby raider for8 every2s. No offline work. Root integration must call normalizeResidents after expedition+journey validation on both durable and snapshot restore; helper drops invalid proof while retaining valid job/timer. residentActors exposes renderer actor positions and activity.

Raid identities/counts remain 3+4 over two waves. Wolf flanking approach, charger nearest solid-building pressure/double structure damage, slime beacon priority and stalker player intercept are distinct. Existing collision/fence, locked target, offscreen pause, save restore, once-only reward regressions remain passing. Forecast announces direction, both compositions and roles before night. Village panel presents produce/cost/effect/unlock, invites/capacity/jobs and forecast. Regional guides explain alliance recruits and nearby cave recipe rewards without changing 24 NPC IDs/16 quest proofs.

Verification: `node --test windwake/tests/life.test.mjs windwake/tests/journey.test.mjs windwake/tests/community.test.mjs` — **68 tests, 68 pass, 0 fail** (2026-09-29). Evidence `/tmp/windwake-community-final.log`. Ten new controlled domain tests cover each crop, all useful recipe effects, malformed/prototype/nonfinite/overflow atomic failures, forged cave/alliance rejection, housing capacity/order, all three jobs, saved timers/pause, migration bounds and tactical roles. These fixtures explicitly seed proofs; they are not ordinary-input travel evidence. Root owns integrated ordinary cave→harvest→craft→use route and Chrome captures.

Initial run retained `/tmp/windwake-life-first.log`: 57/58 pass; sole failure was old exact building count8 after addition of kitchen/workshop. Updated catalog expectation to10 (no gameplay assertion weakened); existing suite then58/58. `/tmp/windwake-community-first.log`:67/67 before final role fixture; final68/68.
