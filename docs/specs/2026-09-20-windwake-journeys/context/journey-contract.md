<!-- source: windwake/settlements.mjs -->
<!-- source: windwake/relics.mjs -->
<!-- source: windwake/journey-ui.mjs -->
# Journey domain and UI contract

Life owns settlements.mjs, relics.mjs, journey-ui.mjs and progression/village integration. World owns all town/NPC/entrance coordinates. Root owns simulation/main/save orchestration; dungeon worker owns dungeon progress. Existing modules retain their APIs.

## Towns and NPCs

Use TOWNS IDs town-{biomeId}; NPC IDs npc-{biomeId}-guide/merchant/keeper. Guide serves quests; merchant serves regional recipes; keeper provides free rest. Confirmed world service IDs: sunfields mill, dunes caravan, coast fishery, autumn orchard, alpine lodge, mistwood herbalist, canyon forge, lavender observatory. Query NPC positions only from TOWNS. Never serialize their coordinates.

## Journey state

`initJourney()` returns `{visited:[],quests:{[16knownQuestIds]:0},relics:[],equipped:[null,null],tracked:null,allies:[]}`. quest status0 unaccepted,1 accepted,2 claimed. IDs quest-{biomeId}-local and quest-{biomeId}-regional. Quest readiness is a query, not independently saved. allies consists of town IDs with status2 regional quests; validator derives it and ignores supplied allies. visited≤8, relics≤8, slots exactly2distinct owned IDs, tracked null or accepted/unclaimed known quest. validateJourney(raw) drops unknown keys, normalizes quest prerequisites (regional progress requires local claimed), and keeps accepted/claimed proof state without awarding anything.

Root initializes `s.journey` and exports/validates it in v3 saves. Old v1/v2 saves use initJourney(). Root must not put new journey data into adventure.completedTasks or worldDefeated. `validateJourney(raw,state?)` accepts normalized state as optional second argument to crosscheck claimed quest proofs and relic sources; root calls it after progress/adventure/expedition are validated. Dungeon quest readiness uses dungeon worker's documented completion query/record, coordinated directly; no dependency from dungeons to settlements is required.

## Settlement API

- `QUESTS`: ordered16entry array `{id,townId,biomeId,stage:1|2,name,description,objective:{kind,id},cost,reward:{xp,food?,reputation?,relic?},destinationId}`. Local reward XP25/food2. Regional reward XP70/reputation3/alliance; only outdoor regional quests add relic.
- `SERVICES`: keyed service-ID catalog `{id,name,description,cost,effect}`. Descriptions list exact price/result.
- `initJourney()`, `validateJourney(raw)`, `townInteraction(s)`, `townAction(s,action,payload={})`, `questStatus(s,id)`, `trackQuest(s,id|null)`, `journeyObjective(s)`, reexport `grantRelic(s,id)` and `equipRelic(s,id|null,slot)`.
- All mutations return `{ok:true,...}|{ok:false,reason:KoreanString}`. townAction requires mode playing, !expedition.active, known npcId, player within4.2m horizontally and2.5m vertically of that authored NPC. Reject before spending on every failure. No UI trust.
- `townInteraction(s)` is read-only and returns nearest `{kind:'npc',id,townId,role,name,description,x,y,z,action:'talk',payload:{npcId}}` in range. `townAction('talk',{npcId})` records visit and returns `{ok,townId,npcId,panel:'town'}` plus event `{type:'town-visit',townId,npcId,text,x,y,z}`. Root calls talk then owns town-open/activeTown and panel opening.
- `townAction('accept',{npcId,questId})`: guide only, matching town, quest0, local claim prerequisite for regional; set1 and tracked. `townAction('claim',{npcId,questId})`: guide, quest1, recognized prerequisite proof and full delivery cost; deduct cost, set2, derive allies, grant bounded reward, clear tracked if matching. No duplicate payout.
- `townAction('rest',{npcId})`: keeper only, no nearby hostile combat, restores HP/stamina/energy, flasks to at least3 (max6), sets checkpoint to town.waypointId ONLY when already activated; resting never activates a waypoint remotely.
- `townAction('service',{npcId,serviceId})`: matching merchant and service only; validate all costs and effect capacity before spending. No arbitrary output amounts accepted.
- `questStatus(s,id)` returns `{status,ready,reason,destinationId,objectiveText}`; status is unavailable/available/active/ready/claimed. `trackQuest` only tracks known status1 quest and may be used in menus anywhere. `journeyObjective` is one Korean string containing next action and destination.

Local proof/cost by biome: sunfields gather resource-sunfields + wood4 delivery; dunes opened cache-dunes; coast activated waypoint-coast; autumn gather resource-autumn + stone4 delivery; alpine completed trial-alpine; mistwood opened cache-mistwood; canyon completed trial-canyon; lavender activated waypoint-lavender. Precompleted proof counts. Gather checks known authored resource timestamp existence, not current inventory alone.

Regional proof: sunfields/canyon/mistwood/alpine clear matching dungeon-{biome}; dunes/coast/autumn/lavender defeat boss-{biome}. Physical return to matching guide is required to claim; completing the combat itself cannot claim quest/alliance.

## Distinct services

| service | price | result |
|---|---|---|
| mill | wood3 | food4 |
| caravan | stone4 | wood3 |
| fishery | wood4 | food5 |
| orchard | food2 | pumpkin2+turnip2 seeds |
| lodge | food3 | flasks+3, cap6; reject when full |
| herbalist | food2 | moonflower2 seeds |
| forge | wood4 | stone3 |
| observatory | crystals3 | reset learned skills/active skill slots and refund all earned skill points; reject when no learned skills |

Materials cap99999; seeds cap9999; reject recipe if any resulting inventory would exceed cap. New supply trade never reduces existing flasks. Rest is free; provisioning extends capacity beyond the free3 baseline. No equipment upgrade or repeat-dungeon economy in this slice.

## Relics and alliance modifiers

`relics.mjs` imports no simulation/settlement module. Exports `RELICS` keyed catalog, `grantRelic`, `equipRelic`, `relicModifiers`, `allianceBenefits`. Catalog `{id,name,description,sourceId,effects}`. Fixed IDs:

| id | name | source | effect |
|---|---|---|---|
| relic-sunfields | 황금 씨앗 | dungeon-sunfields | harvest+.25 |
| relic-canyon | 메아리 방울 | dungeon-canyon | bladeDamage+4 |
| relic-mistwood | 안개숲 심장 | dungeon-mistwood | energy+20 |
| relic-alpine | 서리별 방패 | dungeon-alpine | armor+.06 |
| relic-dunes | 모래바람 깃 | dunes regional quest | speed+.08 |
| relic-coast | 푸른 조개 | coast regional quest | stamina+25 |
| relic-autumn | 붉은잎 등불 | autumn regional quest | towerDamage+.25 |
| relic-lavender | 별꽃 반지 | lavender regional quest | bladeDamage+2,energy+10 |

Dungeon grant hook receives biome-based relic ID above. grantRelic is an internal reward function: validates known ID and uniqueness, returns failure without mutation for duplicate, no location restriction; first free relic slot autoequips. equipRelic allows both slots to hold any owned relic, assigns/moves uniquely, null unequips. It requires playing mode and safe combat state (no active home raid or living hostile within13m/5m height); allowed outdoors or indoors outside combat.

relicModifiers returns additive deltas to existing modifier keys, not full bases. progression.modifiers adds these and alliance tower bonus, then caps combined bladeDamage30,speed1.4,stamina100,energy100,armor.35,harvest2.5,towerDamage2.5. All default values unchanged for missing journey.

allianceBenefits returns `{count,towerDamage:min(count,5)*.05,flasks:min(2,floor(count/2))}`. Home rest adds derived flask allowance to existing3(or5 withwell), capped6. Damage bonus applies to actual home towers. Bonuses are recomputed from unique alliances; repeat talk/claim/rest never adds permanent stacks.

Every villageAction rejects expedition.active before coordinate checks. Tick/clock exclusion indoors remains root-owned.

## UI exports

journey-ui.mjs exports `townPanel(root,s,townId,changed)`, `journeyJournal(root,s,callbacks={})`, `relicPanel(root,s,changed)`. `changed(result)` is called after every attempted mutation; root performs save/HUD feedback. NPC sections expose their own distance/role and disable action buttons until in range; journal remains readable anywhere. All display text uses textContent.

journeyJournal callbacks optional `{travel(id),track(id),openRelics()}`; tracking defaults to trackQuest if omitted. Journal shows accepted quest proof/return requirement, destination, reward and town/alliance/dungeon linkage. Relic panel shows owned/locked source, exact effect,2slots and equip/unequip controls. Layout reuses existing skill/journal/button classes so root can add responsive CSS without domain coupling.
