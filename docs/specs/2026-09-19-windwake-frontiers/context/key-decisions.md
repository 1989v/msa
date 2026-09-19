# Contracts and decisions

## Authorization and ownership
The user's five-part expansion instruction authorizes implementation and design decisions. Prior authorization to deploy the game persists for updating this same public game. Hns gates are fulfilled without another permission question. Preserve unrelated staged/dirty files. Root owns sim.mjs, main.mjs, index.html, style.css, integration, publishing and release. World worker owns world.mjs/render.mjs and world-specific tests. Life worker owns NEW progression.mjs/village.mjs and focused tests. Verification worker owns new route/stress tests and read-only review. No worker reverts another's changes.

## Existing contracts retained
60Hz pure state mutation; metres; Y up; north+Z. Player/enemy schemas remain backward-compatible. Events {type,text?,x,y,z}; effects bounded. Renderer consumes state; no simulation RNG in graphics. Preserve original central IDs and world named exports for regression routes.

## World interface
- WORLD.size=960; chunkSize60 for streamed terrain. Original center stays recognizable. VILLAGE={x:-34,z:-86,radius:28,cellSize:4}; its clear flat footprint is excluded from procedural obstacles.
- Export BIOMES, WAYPOINTS, BOSS_SITES, RESOURCE_NODES (finite authored sites), and existing WORLD/LANDMARKS/REGIONS/PLATFORMS/OBSTACLES/SOLIDS/PROPS. Added landmark.kind: waypoint, resource, trial, boss, village.
- Export getChunk(cx,cz) → {id,cx,cz,props,solids,spawns}, querySolids(x,z,radius=6) → nearby static/procedural collision cuboids, spawnsNear(x,z,radius=110) → deterministic specifications, worldStats() → cache counts. No RNG depending on query order. CPU cache≤96 chunks; renderer≤64 resident GPU chunks with a per-frame build budget.
- BOSS_SITES entries {id,name,x,z,type:'boss',family,level,reward,final?}; runtime enemy uses bossId/family, original id='boss' reserved. WAYPOINTS entries are also LANDMARKS kind waypoint, home entry id='home'.
- Spatial queries include every cuboid whose full X/Z AABB intersects the query disk/bounds, including neighboring chunk ownership. Normal radius cap180; reject/split larger queries rather than fill the entire world cache. Streamed props cannot straddle farther than their declared extents. Author trails with maximum rise/run≤0.8 and≥3m obstacle clearance; waypoint spawn/arena clearance≥5m, floor above water. Tests sample central→outer travel lanes and cross-chunk collisions.
- Regular actor IDs: stalker,ranger,charger,slime,wolf,boar,shaman,wisp,bomber,sentinel,burrower,frostling. Boss family IDs will be fixed in world data, with four distinct families minimum. Friendly procedural wildlife is noncombat visual scenery.
- Rendering handles state.village/state.adventure if present and gracefully accepts old fixtures. Structures use world coordinates from village module. state.village.clock is seconds into a600-second day; day starts at1, dusk450. Convert clock/600 to a fraction for daylight; night remains readable. New actor.type names coordinated before changing visuals.

## Pure progression interface (no sim import)
- progression.mjs exports SKILLS, ACTIVE_SKILLS, initAdventure(), awardXP(s,amount), learnSkill(s,id), equipSkill(s,id,slot), modifiers(s), validateAdventure(raw).
- state.adventure={xp,level,points,learned:[],equipped:[id|null,id|null],bosses:[],waypoints:['home'],completedTasks:[],worldDefeated:{},chapter,finalDefeated:false}. Modifiers returns numeric bladeDamage,speed,stamina,energy,armor,harvest,towerDamage; default values documented by worker.
- Active IDs sunbolt,winddash,bloom,quake; root implements their physical effects, energy/cooldown and input skill1/skill2. Worker defines costs/cooldown/skill prerequisites. s.player.abilityCooldowns is keyed by active ID. XP thresholds capped and deterministic.
- Validate skill spending by deriving earned points from bounded XP/level, then admitting only affordable known nodes with learned prerequisites; ignore supplied raw points/level. This prevents contradictory saves from manufacturing permanent upgrades.

## Pure village interface (no sim import)
- village.mjs imports only world/progression if needed, exports CROPS, BUILDINGS, initVillage(), villageAction(s,action,payload), tickVillage(s,dt,hooks), villageInteraction(s), validateVillage(raw).
- state.village={clock,day,materials:{wood,stone,food,...},seeds:{...},structures:[{id,type,x,z,y,hp,...}],plots:[{id,x,z,crop,watered,growth,...}],level,reputation,raid:{status,day,wave,...},...}; caps32 structures,16 plots, deterministic IDs. Keep full village state serializable. Worker confirms exact fields.
- villageAction supports build,remove,repair,plant,water,harvest,trade,upgrade,rest; validates range/location/cost itself (UI not trusted). Interaction returns {kind,id,name,description,...} nearest actionable object/resource, root routes E. Gather finite authored RESOURCE_NODES with renewable game-time cooldown.
- hooks at tick include spawn(type,x,z,extra), damageEnemy(enemy,amount,kind), damagePlayer(amount), rewardXP(amount), toast(text,type), solidQuery(x,z,r). Root adapts core helpers. Villager raid mobs have raid=true and target home/structures; worker supplies steering/attack updates or explicit target fields, root skips ordinary player-target AI for raid actors.
- Crop/raid day clocks derive only dt, pause follows main loop. Initial supplies enable two plots/basic defense. Raids queued while distant; resume only at home, stop clock during unresolved raid. Failures have free recovery. Durable reward markers prevent reload duplication.
- Raid starts only after cottage+first completed harvest. Lifecycle idle/queued/active/won/lost; raid.day is unique. queued allows home fast travel, active blocks it. Persist wave number plus current surviving wave snapshots; on load/respawn restore exactly those survivors without restarting a rewarded wave. Village module exposes capture/restore raid helpers if needed; root owns transient s.enemies reconciliation. No silent instant win from absent enemies.

## Final review acceptance addendum
- querySolids deduplicates by stable ID and includes cross-boundary extents. Original SOLIDS stays original central authored geometry; generated outer geometry is obtained only by local queries.
- Renderer builds at most2 new chunks per frame after a bounded3×3 initial neighborhood. Stats expose residentChunks, residentBytes, triangles and disposedChunks. GPUresident≤64 and CPUcache≤96 after every observed query/render, including atlas open.
- Inventory to migrate: sim movement/vertical support, cover/LOS, projectiles, moving stone and player/enemy knockback; renderer camera segment; main atlas/minimap fixed WORLD.size-aware raster.
- Physical base-character travel lanes from center to all8 outer waypoint approaches are required. Sample every2m, max rise/run≤0.8, clear width≥3m; verify actual player movement along these lanes, not just teleport destinations.
- Save matrix: missing/null/unknown/oversized IDs, NaN/Infinity/negative values, out-of-bounds and overlapping placements, XP/prerequisite overspend, plus queued/active/between-wave/won/lost raid saves. No replay rewards, frozen crop timers or empty-wave win after reload/death.
- Publishing/deployed-test runtime allowlists include every added module and verify hashes against checked source. Don't serve tests.
- Planted-plot removal returns exactly its seed, no crop yield. Raid failure keeps crop state. Home action recovers one turnip seed only if no seeds and no planted crop remain; no resource prerequisite. No normal XP/crystal drop for raid enemies; only village encounter reward marker may pay.

## Save and combat integration
Root owns version2 save normalization, version1 migration, transient enemy streaming, active entity budget64 and durable defeat IDs. Existing summit win remains a chapter completion overlay, not final frontier completion. Legacy mode='won' compatibility may remain for regression while next session/free-roam opens expanded objectives. New final boss requires≥4 regional kills and villagelevel≥3.
