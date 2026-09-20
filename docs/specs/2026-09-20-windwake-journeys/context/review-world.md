# Architecture and implementation review — world/render

Verdict: **SHIP with the following recorded interface resolutions**. Read-only review completed before runtime changes. Existing area is exactly64×; eight functioning towns and four instances address the content-density gap rather than claiming another size increase.

## Findings and resolutions

1. **Interior collision cannot share an outdoor floor implicitly.** `world.mjs:84` is a single-valued outdoor height; `render.mjs:1006` always streams terrain and `:1036` draws outdoor water. Resolution: `s.expedition.active` selects the scene. Indoor camera/shadows use dungeonFloor/dungeonSolids; renderer draws the dungeon worker's authoritative geometry, omits all outdoor streaming/landmarks/sky/water, disposes outgoing scene buffers and resets camera interpolation. Primary must route every physics/projectile/bounds query through the same scene selection.

2. **Populated hubs must not obstruct proven old paths.** Existing radial routes end at waypoint→region→boss (`world.mjs:58`). Resolution: town centers lie48m perpendicular to their existing waypoint, flat radius28 and a feathered edge; a new courtyard street connects the waypoint to town and four dungeon portals. Six buildings sit outside the central street and NPC approach pads; ambient props/encounters are excluded. Old route heights are preserved where a new blend could reach them, and physical route tests remain authoritative.

3. **Static geometry and economic state have different owners.** Player-building meshes currently live inside `render.mjs:812`; settlement services must not be encoded into decorative models. Resolution: TOWNS contains finite building/NPC/appearance metadata, while settlements.mjs owns actual trades, quests and rest. NPC IDs/roles/service IDs agreed with life worker before edits. Public types remain data, never executable UI actions.

4. **Door rendering must follow the same open facts as collision.** Renderer must consume the dungeon worker's actual floor/wall/door geometry rather than reconstruct room layouts. Immutable floors/walls use a bounded active-scene batch; closed-door and mechanism geometry uses authoritative current state. Required final geometry export/schema is coordinated directly with dungeon worker before interior renderer implementation.

5. **Transitions must not retain hidden GPU scenes.** Existing resident counters only cover outdoor chunk buffers (`render.mjs:346`). Resolution: expose activeScene and dungeonBuffers/dungeonBytes alongside unchanged chunk counters; include both scene forms in total residentBytes, keep CPU≤96/GPU≤64 and outdoor build≤2/frame. Repeated enter/exit must delete every outgoing batch exactly once. NPC visual budget is12, independent of64 combat actors.

## Frozen settlement metadata

TOWN IDs: `town-<biomeId>`; NPC IDs `npc-<biomeId>-guide|merchant|keeper`, roles matching suffix. Guide owns quest interaction, merchant owns regional service, keeper owns rest. Local NPC pads `(0,-6),(-6,0),(6,0)` are transformed by town yaw and clear of buildings. TOWNS records include `{id,biomeId,name,x,y,z,radius:28,waypointId,service,description,yaw,npcs,buildings,style}`. Six main buildings use two rows at local x±13/z−15,0,15, leaving the center street open.

| biome | town name | service / style |
|---|---|---|
| sunfields | 밀바람 마을 | mill |
| dunes | 유리샘 교역소 | caravan |
| coast | 청옥항 | fishery |
| autumn | 단풍마루 | orchard |
| alpine | 서리별 산장 | lodge |
| mistwood | 안개가지 마을 | herbalist |
| canyon | 메아리 대장간 | forge |
| lavender | 별꽃 관측촌 | observatory |

Entrances are `dungeon-sunfields`, `dungeon-canyon`, `dungeon-mistwood`, `dungeon-alpine`, each58m along the positive local street from its town center. DUNGEON_ENTRANCES records include `{id,townId,biomeId,name,kind:'dungeon',x,y,z,yaw,description}`. The public world metadata remains finite; active dungeon geometry lives solely in dungeons.mjs.

## Verification scope

Run world geometry/route/CPU/GPU tests plus renderer geometry finiteness, NPC budget, shared door facts and repeated scene transition allocation tests. Chrome remains required for ceiling/camera visibility and actual dungeon movement; mock GL allocation tests are not screenshot evidence. Existing central and frontier journeys must remain passing.
