# Life modules contract

Owner: life worker. Root owns integration; world worker owns world/render. No sim imports in either module. This contract supplements key-decisions.md.

## Progression API

- `SKILLS`: ordered array `{id,name,branch,cost,requires:[],description,active?:true,effects:{}}`, Korean display strings; branch IDs blade/wind/hearth. `ACTIVE_SKILLS`: keyed object for `sunbolt:{energy:24,cooldown:2.8}`, `winddash:{energy:18,cooldown:3}`, `bloom:{energy:34,cooldown:12}`, `quake:{energy:40,cooldown:7}`; each includes name/description. Physical effects belong to sim.
- `initAdventure()` → `{xp:0,level:1,points:2,learned:[],equipped:[null,null],bosses:[],waypoints:['home'],completedTasks:[],worldDefeated:{},chapter:1,finalDefeated:false}`.
- Cumulative next-level XP: `80*n + 20*n*(n-1)` for n completed level advances. Level capped30; XP capped1,000,000. Earned points=`2+(level-1)*2`. No passive XP/time rewards.
- `awardXP(s,amount)` → `{ok,amount,levels}`; accepts nonnegative finite amounts, derives level/points, never accepts caller-supplied level. `learnSkill(s,id)` and `equipSkill(s,id,slot)` → `{ok,reason?}`; slot0/1, null unequips, assigning an already-equipped ability moves it to requested slot. Reject non-playing actions. Learning is idempotent failure on duplicates, checks all requirements and budget. First learned active autoequips a free slot.
- `modifiers(s)` → `{bladeDamage:0,speed:1,stamina:0,energy:0,armor:0,harvest:1,towerDamage:1}` defaults. bladeDamage is flat bonus sword damage; speed/harvest/towerDamage are multipliers; stamina/energy add to max capacity; armor is damage reduction fraction capped.35. Harvest yields floor(base food×harvest). These values contain learned effects only, not base sigil/camp bonuses.
- `validateAdventure(raw)` returns fresh normalized adventure. Derive level/points from XP, accept unique prerequisite-closed affordable nodes in catalog order, retain only learned active slots. Known world boss/waypoint IDs only; task strings max64chars/128entries; world defeat IDs max96chars/4096entries, values true. Final completion is valid only with ≥4 regional victories. Root sets chapter based on legacy central milestone.

| Branch | id | cost | requires | effect |
|---|---|---:|---|---|
| blade | edge |1|—|bladeDamage+3|
| blade | sunbolt |1|edge|active|
| blade | heavyblade |2|edge|bladeDamage+5|
| blade | quake |2|heavyblade|active|
| blade | guard |1|edge|armor+.10|
| blade | mastery |3|heavyblade,guard|bladeDamage+8|
| wind | quickstep |1|—|speed+.08|
| wind | winddash |1|quickstep|active|
| wind | endurance |1|quickstep|stamina+25|
| wind | current |2|winddash|speed+.12|
| wind | reservoir |1|endurance|energy+25|
| wind | zephyr |3|current,reservoir|stamina+35,energy+20|
| hearth | gardener |1|—|harvest+.25|
| hearth | bloom |1|gardener|active|
| hearth | mason |1|gardener|armor+.08|
| hearth | abundance |2|gardener|harvest+.40|
| hearth | sentry |2|mason|towerDamage+.35|
| hearth | steward |3|abundance,sentry|towerDamage+.40,harvest+.35|

## Village state and rendering

`initVillage()` → clock90, day1, elapsed0, materials `{wood:48,stone:30,food:6}`, seeds `{turnip:4,wheat:2,pumpkin:1,moonflower:1}`, structures[], plots[], level1, reputation0, nextId1, beaconHp180, maxBeaconHp180, gathered{}, tasks[], raid as below. Clock is seconds in a600-second day, dusk450. Elapsed only advances on unpaused simulation and drives renewable gathering. All state is JSON serializable.

`CROPS` is keyed by ID, values `{id,name,growthSeconds,food,seedYield:1,colorToken}`. turnip45s/food3; wheat75s/food5; pumpkin110s/food8; moonflower140s/food11. Plots are `{id,x,y,z,crop:null|id,watered:false,growth:0,stage:'empty'|'seed'|'sprout'|'growing'|'ripe'}`. Growth is seconds; watered seeds grow without further watering. Stages: <.25 growth fraction seed, <.65 sprout, <1 growing, then ripe. Harvest empties plot immediately, returns one seed, food plus learned modifier, reputation2 and task XP once. Crops never wither. Plot IDs equal owning structure IDs.

`BUILDINGS` is keyed by ID; values `{id,name,description,cost:{wood?,stone?,food?},hp,level,solid,w,d,h}`. Each occupies one cell. Structures `{id,type,x,y,z,facing,hp,maxHp,cooldown:0}`; facing is radians yaw (0 faces+Z), y is ground height; visuals use type, hp and facing. Structures remain visible when hp0 and can be repaired/removed. Plot data is separate to avoid duplicate rendering.

| id | wood | stone | food | HP | village level | dimensions w/d/h | solid |
|---|---:|---:|---:|---:|---:|---|---|
| plot |4|0|0|60|1|3/3/.18|false|
| cottage |12|4|0|180|1|3.2/3.2/3.8|true|
| well |3|8|0|140|1|1.8/1.8/1.2|true|
| granary |14|8|0|190|2|3.2/3.2/3|true|
| tower |10|8|0|160|1|1.8/1.8/4.6|true|
| fence |3|1|0|110|1|3.6/.6/1.6|true|
| flowers |1|0|1|35|1|2/2/.5|false|
| lantern |2|2|0|65|1|.5/.5/2.5|false|

`villageSolids(s)` exports cuboids for intact solid structures (fence dimensions rotate on quarter turns); root includes them in player collision and cover. Root should not combine them twice. Home center within5m and resource pads within3m are reserved; cell center grid is VILLAGE.x/z+cellX/Z*4; cells must fit within village.radius-2. Cap32 structures and16 plots. Placement must not overlap player or an existing structure cell.

## Village actions

`villageAction(s,action,payload={})` returns `{ok:true,...}|{ok:false,reason:string}`; reasons are Korean user-facing strings. Invalid mode, unknown action/IDs/nonfinite arguments, distant or vertically unreachable interactions and failed budgets leave state unchanged. Build uses target within12m and player within village.radius+4; object/resource use requires horizontal≤4.5m and vertical≤3m. Home rest/trade/upgrade require≤7m of beacon. Root displays result.reason or success message; module also emits bounded semantic events on successful actions.

- `build {type,x,z,facing?}` uses world coordinates, snaps to nearest valid grid cell; facing snaps to quarter turns. Returns `{ok,id,x,y,z}`. Validate cost, unlocked level, occupancy, caps and reserved home center. UI previews snapped coordinates before confirmation.
- `remove {id}` returns floor(half original material cost), refunds planted seed (never food), removes plot and structure together. Block during active raid.
- `repair {id}` costs wood2+stone1 for a structure, fully heals; `repair {id:'beacon'}` is free whenever no active raid. Beacon repair cannot be charged and restores180HP.
- `plant {id,crop}` on empty intact plot consumes one seed; `water {id}` is free; `harvest {id}` only ripe and once per planting.
- `gather {id}` recognized RESOURCE_NODES entry, range checked, gain entry.material (wood/stone/food) and entry.amount, renews after entry.cooldown seconds (90default). Home wood/stone/food nodes are resource-home-wood/stone/food, defined by world-contract.md.
- `trade {kind:'seed',crop}` costs food1 for one seed; if no seeds/planted crops, `trade {kind:'recovery'}` grants one free turnip seed (no repeat while seed/crop available). `trade {kind:'food'}` consumes food2 and heals35, only if injured.
- `upgrade {}` costs level1→2: wood12/stone8/food4 and reputation≥6; level2→3: wood20/stone14/food8 and reputation≥16; level3 max. Grants no repeatable reputation/XP.
- `rest {}` requires no local non-idle enemies or active raid, heals and restores player resources/flasks. Free beacon recovery also available after failure. Rest never skips clock/raid.

`villageInteraction(s)` → null or `{kind:'village'|'resource'|'crop',id,name,description,x,y,z,action,payload}`. Nearest useful action precedence: ripe harvest, unwatered crop water, empty plot plant(turnip if owned otherwise first seed), depleted beacon repair, ready resource gather, home rest. Only returns genuinely in-range actions. Root delegates returned action/payload to villageAction; UI can supply specific crop/build/trade choices.

Tasks are stable one-time flags gather/build/plant/water/harvest/defend, earning XP15 each; ordinary harvest gains reputation2, build first type gains reputation1, raid victory gains reputation6. Levels are paid unlocks independent of reputation count. `villageObjective(s)` returns short Korean next-step string for the home journal.

## Clock, raid hooks and persistence

`tickVillage(s,dt,hooks={})` accepts finite dt in(0,1], no wall clock, no changes if mode is not playing. Tick after regular enemy/projectile combat; skip ordinary enemy AI for all e.raid. Crops and gathering elapsed can advance during combat; day clock stops for queued/active raids. Distant active raid also freezes raid actors/timers and displays return guidance; it never silently damages village. Active neighborhood is distance≤64m.

Hooks are `spawn(type,x,z,extra)→enemy|null`, `damageEnemy(enemy,amount,kind)`, `damagePlayer(amount,source?)`, `rewardXP(amount)`, `toast(text,type='notice')`, `solidQuery(x,z,r)→cuboids`. Spawn must merge `extra` AFTER core enemy defaults and return the inserted enemy; null means global cap is full and wave stays pending. Village worker steers raid actors, telegraphs/attacks home/structures/player, and towers attack; root supplies damage helpers and skips normal AI. Root must suppress ordinary drop/XP/boss logic for e.raid; only raid completion awards resources/XP once.

Raid shape: `{status:'idle'|'queued'|'active'|'won'|'lost',day:0,wave:0,waves:2,spawned:false,timer:0,elapsed:0,direction:'north'|'east'|'south'|'west',rewarded:false,enemies:[]}`. At dusk after cottage+first completed harvest (tasks includes harvest), queue day identity once, direction rotates day%4. Show warning; queued timer10s runs only while home and then activates. Two waves:3 then4 regular enemies, IDs `raid-{day}-{wave}-{index}`. Later days scale stats slightly, count capped. Inter-wave delay4s, three minute active limit→loss. Destroyed beacon or timeout→loss; surviving raid enemies disappear, earned progression/crops/inventory remain, structures keep repairable damage. Player death freezes simulation and respawn retains the same surviving wave; root captures before death export and restores after load. Repeated death cannot refresh rewards.

- `captureRaid(s)` synchronizes living matching-day enemy snapshots into raid.enemies and returns that array; call before exportSave. Snapshots persist id/type/x/y/z/yaw/hp/maxHp/state/timer/attackCount plus raid=true/raidDay/raidWave/raidIndex. Preserve active wave accounting even when all enemies have died; spawned=true+empty means legitimately cleared only after capture of synchronized live state.
- `restoreRaid(s,hooks)` reconciles snapshots with s.enemies by stable ID. It does not overwrite already-present actors, starts no new wave and grants nothing; retries cap-blocked entries on tick. Missing restored survivors must never count as defeated. Call after load with hooks or allow first tick to restore before progress evaluation.
- `validateVillage(raw)` normalizes all values/arrays/IDs, drops out-of-bounds/duplicate cells, rebuilds plot references, derives HP maxima from building types and bounds raid snapshots to7enemies. Unknown/contradictory raid state normalizes to nonrewarded lost state, never free victory. Enemies are restored from validated snapshots after core load. Root owns state.version and v1 migration.
- Win only after last active wave resolves with all persisted/live survivors defeated. Atomically set status=won/rewarded=true then grant wood12, stone8, food4, XP60 and reputation6. A won/rewarded raid cannot grant again after restore. `failRaid(s)` is idempotent, marks lost, removes raid actors, never grants rewards.

Implementation may add helper exports; these agreed names/semantics remain stable and deviations are coordinated first.
