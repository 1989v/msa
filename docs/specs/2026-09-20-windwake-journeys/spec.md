<!-- source: windwake/world.mjs -->
<!-- source: windwake/sim.mjs -->
<!-- source: windwake/render.mjs -->

# WINDWAKE JOURNEYS — settlements and dungeons

Status: design review. Risk L3; user explicitly delegates game analysis, missing-content implementation and prior same-game deployment. No additional design interview or approval needed.

## Problem and scope

Frontiers expanded the world from240×240m to1920×1920m:64× area, not64× authored content or playtime. It contains one player-built village,8outer regions, outdoor trials and bosses; it has no NPCtown network or multiroom dungeon. Preserve the existing world/skills/farming/raids and original adventure while adding content density and purposeful return trips.

## Required behavior

1. Add8functional settlements, one near each outer waypoint, in addition to the player village. Each has a distinct name/silhouette, buildings,3NPCs with readable roles, rest/supplies and a regional service. Approach roads and old routes stay traversable by the base character. Towns are safe from ambient spawns; no decorative town without interaction.
2. Add16one-time quest stages across8settlements: accept a local task, fulfil it by real exploration/combat/gathering actions, return to the NPC; then undertake a regional dungeon or outdoor boss task and physically return to claim. Pre-completed exploration/boss facts count. Delivery costs are consumed only upon valid claim. Quest journal shows exact next action, reward and destination, and supports tracking.
3. Add4genuine dungeon instances, with at least5connected chambers each, continuous movement within the instance, actual walls/doors/cover, jump/height routes, readable environmental puzzle clues, optional treasure, normal enemy groups and a boss. Four layouts/mechanic combinations must differ; a menu quiz or one outdoor arena does not count as a dungeon. No imported assets or game engine.
4. Dungeon paths use base jump; no required optional skill or glider. Wrong puzzle inputs can be retried, pushable blocks can be reset, falls recover safely with normal damage. Entry, exit, death, reload and reentry cannot strand players or bypass locked rewards. Defeated guardians and solved puzzles persist; no duplicate rewards.
5. Add8unique equipable relics, two slots, and visible effect descriptions. Dungeon/quest rewards change combat, travel, farming or defense via bounded modifiers rather than naming an inert item. Distinct town services trade resources or prepare supplies. Settlement alliances provide a concrete home benefit with caps and no repeated-claim exploit.
6. Maps/HUD show towns, dungeon entrance and completion, tracked objective and local dungeon room layout. Contextual E works for NPCs, doors, puzzles, treasures and exits. Menus remain readable on desktop and touch; text states accompany color.
7. Version3 durable saves load old version1/2 saves, preserve all existing progress and village raids, normalize finite known IDs/counters/gear. A dungeon save resumes at a verified safe entry/checkpoint with puzzle/kill progress; never deserialize arbitrary collision geometry. World actor state does not leak into local dungeon coordinates. Dungeon monsters never trigger legacy sky ending or regional world boss payout.
8. Preserve60Hz determinism and collection budgets. Only active dungeon is rendered/updated; no unnecessary overworld chunk churn while indoors. Exit restores bounded world streaming. Pause semantics apply to crops; unresolved home raids wait while dungeon exploring and cannot silently win or lose.

## Validation gates

Keep120existing unit tests and original/frontier natural journeys. Add domain tests for town location/claim/reward validation, inventory slots, old saves, dungeon door/puzzle dependencies, cover/height, fall recovery, death/exit/reentry/reload and reward idempotency. In real Chrome use keyboard/mouse plus normal command API: walk to settlements, accept/complete/return a quest; enter and traverse each dungeon without teleports, grants or deleting enemies; capture screenshots and errors; measure transition/render/chunk budgets. Repeat after corrections. Independent implementation review must return SHIP before same-site deployment; verify public runtime hashes and gameplay after rollout.

## Research used as design input

- Nintendo's [Hyrule tips](https://play.nintendo.com/news-tips/tips-tricks/hyrule-tips-and-tricks-tears-of-the-kingdom/) describes villagers providing quests, environmental discoveries and shrine rewards feeding character growth. Design inference here: use residents to connect nearby discoveries with permanent useful rewards.
- Nintendo's [Create your getaway](https://animalcrossing.nintendo.com/new-horizons/create/) describes recipes, resource gathering, crops, cooking and community buildings. Design inference: expedition rewards should also improve the player's home and supplies, making returning worthwhile.
- Blizzard's [Play Your Way](https://news.blizzard.com/en-gb/article/23938756/make-sanctuary-yoursplay-your-way-in-diablo-iv) describes skill/gear choices and non-linear progression. Its [1.0–1.2 patch notes](https://news.blizzard.com/en-us/article/24092662/diablo-iv-patch-notes-1-0-1-2) document shortening the walk before encounters and locating services around town waypoints. Design inference: useful town hubs, explicit dungeon rewards, and short gaps between decisions matter more than raw map size.

Names, layouts, art, mechanics implementation and sound remain original. These are selected official design examples, not a claim of exhaustive game analysis or comparable production scope.
