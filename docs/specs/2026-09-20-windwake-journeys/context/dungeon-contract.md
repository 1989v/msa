<!-- source: windwake/dungeons.mjs -->

# Frozen dungeon contract

Owner: dungeon worker (`windwake/dungeons.mjs`, `tests/dungeons.test.mjs`, `tests/dungeon-routes.mjs`). Root owns scene switching/physics/save/combat; world owns renderer/entrances. No worker reverts another's files.

## Scene and persistence

`initExpedition()` returns `{active:null,progress:{}}`. `progress[id]` is `{killed:[],solved:[],opened:[],claimed:false}` for known dungeon IDs only. `active` is null outdoors or `{id,roomId,sequenceSteps:{},relayStates:{},plateCharges:{},blocks:[...]}`. `validateExpedition(raw)` rebuilds known IDs, bounded allowlisted facts and authored blocks; active scene always resumes at its safe entry room. It never restores arbitrary geometry, actor positions or supplied doors. Gates derive from known killed/solved facts. `dungeonCleared(s,id)` is the public read for settlement quest eligibility: known dungeon with `progress[id].claimed===true`, admitted only with required puzzle/guardian facts.

IDs: `dungeon-sunfields`, `dungeon-canyon`, `dungeon-mistwood`, `dungeon-alpine`. First-clear relics respectively `relic-sunfields`, `relic-canyon`, `relic-mistwood`, `relic-alpine`. All room, enemy, puzzle and chest IDs are namespaced with dungeon ID. Boss actors have `type:'boss',dungeonId,family,roomId` and NO `bossId` or `final` flag. Root extends expanded-family AI to recognize `dungeonId`; dungeon enemies never run original guardian/reward logic.

## Geometry

`DUNGEONS` is an array of authored records `{id,name,description,relicId,entry:{x,y,z},bounds:{minX,maxX,minZ,maxZ},rooms,floors,walls,doors,props,landmarks,spawns,puzzles,blocks}`. Rooms `{id,name,kind,x,y,z,w,d}`; `entry` room identifier in active is replaced by real room ID when ticking.

`dungeonGeometry(s)` returns null outdoors, otherwise `{id,name,rooms,floors,walls,doors,props,landmarks}`. Floors/walls/cover use `{id,x,y,z,w,d,h,kind?}` cuboids (y is bottom, floor top is y+h). Doors add `open:boolean` derived from the same dependency function used for collision. Landmarks have `{id,kind,name,description,x,y,z,puzzleId?,index?}`; kinds `exit,clue,rune,lever,reset,chest,plate`. Renderer uses authored floors and matching door open flags. Dynamic blocks are in `s.expedition.active.blocks`, aliased by root as `s.blocks` for normal Q pulse and collision/rendering.

`dungeonFloor(s,x,z)` returns maximum authored floor top at x/z, or -12 for a pit/outside; safe floors are ≥0. Raised blocks/platforms also appear in static geometry for support. `dungeonSolids(s,x,z,r=6)` returns nearby walls, cover, raised floors and closed doors, excludes movable blocks (root adds `s.blocks` exactly once). `dungeonBounds(s)` returns the active catalog bounds; inactive fallback bounds are ±150. All local paths fit within ±150; all required rises are ≤1.5m per jump.

## Domain actions and root hooks

- `enterDungeon(s,id,hooks)` validates playing/outdoors, known entrance, horizontal≤4.5m/vertical≤3m, no nearby active enemy or active village raid. Sets `active` BEFORE `hooks.transition('enter',entry)`; hook parks current field arrays, clears active arrays, aliases active blocks, places player and resets motion/input. Returns `{ok,id}` or `{ok:false,reason}`.
- `leaveDungeon(s,hooks)` permits only an in-range authored exit (entry exit always usable; boss exit after clear). Captures dead actors, sets active=null BEFORE `hooks.transition('leave',worldReturn)`; hook restores field arrays/streaming. Return is entrance x/z−5 on safe authored ground (root resolves exact world ground). HP/energy/cooldowns are preserved; scene change itself grants no healing.
- `dungeonInteraction(s)` returns nearest usable `{id,kind,name,description,x,y,z,action,payload}` within3m and vertical≤2.4m. Includes locked doors/clues with reasons, correct free block reset, runes, levers, chests and exits. Root routes E directly to `dungeonAction` while active, without scanning world landmarks.
- `dungeonAction(s,action,payload={},hooks={})` accepts `interact` with landmark/door `id`, or `exit` (same physical exit validation). No arbitrary location/puzzle answers. Success `{ok:true,...}`; failure `{ok:false,reason}`. Puzzle solutions require actual authored object visits.
- `tickDungeon(s,dt,hooks)` accepts dt in(0,1], playing active scene only. Captures defeated authored actors, moves active blocks, observes physical pressure plates and spawns current/adjacent accessible room actors through capped hook. Spawn null/missing actors never mean defeated. Updates roomId and first-clear state, no village tick.
- `recordDungeonKill(s,e,hooks)` validates e.dungeonId/e.id against active authored spawns and hp≤0, records once; root calls it from dropReward's dungeon branch BEFORE any regional/legacy payout. Summoned non-authored adds yield no separate dungeon rewards. `tickDungeon` also calls it before root pruning.
- `dungeonObjective(s)` returns a readable next room/puzzle/boss/return instruction.

Hooks: `transition(kind,spawn)` (required for enter/leave); `spawn(type,x,z,extra)` returns enemy/null, with extra containing stable id/y/homeX/Y/Z/hp/maxHp/dungeonId/roomId/family; `move(body,dx,dz,r=.8)` and `ground(body,dt)` for Q-pushed block physics (static scene solids only, avoid self collision); `rewardXP(amount)`; `grantRelic(id)`; `rewardMaterials({wood,stone,food,crystals})`; `effect(type,at,extra)`; `toast(text)`.

`recordDungeonKill` pays10XP per normal authored monster,80XP for its boss, once. Optional chest pays materials/currency once. First clear atomically records claimed then grants120XP, wood10/stone8/food4/crystals8 and the matching relic. No UI helper or mere absence of actors can claim a room/chest/boss reward. All reward hooks are synchronous and operate on already validated catalog rewards.

Root maintains world-only raid/crop policy independently: active dungeon means remote for raids, even when local coordinates overlap home. Entry during active raid rejected. Dungeon deaths/load resume verified entry with durable facts; free puzzle/block reset prevents a soft lock. Root must record dungeon kills before removing dead actors or parking/exiting.

## Natural route adapter

`tests/dungeon-routes.mjs` exports `runDungeonRoute(driver,id,{freshStart:true})` and `dungeonCheckpoint(driver,stage)`. Required adapter is `state()` plus `step(frames,heldInput)`; optional `learn(id)`, `equip(id,slot)`, `town(action,{npcId})` use normal public actions. `onCheckpoint(record)` receives entry, every chamber, clues, completed puzzles, both terraces, optional chest, first clear and outside return. `freshStart:false` starts at the physical entrance or in the selected entry scene; it never relocates the player. The default route walks the full overworld trail, visits the town keeper for a normal rest, presses E at the entrance, uses E/Q/base jumps and combat, then presses E at the final exit. The controller never writes state. Regression adapters return cloned state so a route cannot alter the running simulation through reads.
