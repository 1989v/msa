# Frozen world/render contract

This supplements key-decisions.md. World worker owns world.mjs, render.mjs and tests/world.test.mjs only. Metadata below is deterministic, finite authored content; no state mutation or simulation import occurs in world/render.

## Regions and encounters

`BIOMES` entries: `{id,name,x,z,radius,description,terrain,props,enemies}`. Eight outer entries are also included in `REGIONS`; original center entries remain. Coordinates below are region centers, not mandatory exact waypoint positions. Each outer region has one waypoint, one regional boss, one renewable resource, one cache and one field trial (24 destination locations total), with additional starter resources near home.

| Region ID | Name | x,z | Terrain | Boss family |
|---|---|---|---|---|
| sunfields | 햇살구릉 | 0,-510 | warm cultivated rolling hills | bulwark |
| dunes | 유리모래 사막 | 430,-430 | pale dunes and sheltered rocks | tempest |
| coast | 청옥 해안 | 650,0 | luminous shore and raised causeway | tide |
| autumn | 붉은잎 고원 | 470,470 | copper woodland and terraces | thorn |
| alpine | 서리별 산맥 | 0,680 | pale blue hills and mountain ruins | bulwark |
| mistwood | 안개수림 | -470,470 | deep pines and shallow ravines | thorn |
| canyon | 메아리 협곡 | -660,0 | sandstone ravines and ruin ridge | tempest |
| lavender | 별꽃 초원 | -440,-460 | violet grass and protected hollows | tide |

`WAYPOINTS`: home plus eight outer `{id:'waypoint-'+biomeId,kind:'waypoint',biomeId,name,x,z,y,description}`. Home uses `id:'home'`, the exact VILLAGE center, and is always available through adventure.waypoints. All entries also appear in LANDMARKS. Ground y is heightAt and physical arrival pads are obstacle-free for at least5m. HOME is a travel beacon; root retains legacy camps independently.

`BOSS_SITES`: eight `{id:'boss-'+biomeId,kind:'boss',type:'boss',biomeId,name,x,z,y,family,level,reward,final:false}` plus `{id:'boss-frontier',final:true,...}` at approximately x0,z870. Original summit guardian `id:'boss'` stays only in original ENEMY_SPAWNS. `reward` is a unique descriptive string/title for display; first-clear XP/material rewards remain simulation-owned. Runtime `bossId` equals site.id. Fixed family IDs:

- `bulwark`: heavy sweep/slam plus charge and phase2 shock ring.
- `tempest`: aimed ranged volley plus ring and phase2 rapid volley.
- `thorn`: spawning/support pressure plus sweep and phase2 burrow/eruption.
- `tide`: moving slowing/eruption zone plus ring and phase2 alternating charge.
- Final boss uses `tempest` with a separate final flag; it is not counted as an additional unique AI family.

Enemy IDs remain `stalker,ranger,charger,slime,wolf,boar,shaman,wisp,bomber,sentinel,burrower,frostling`. Runtime telegraphs use existing `pattern` plus added `sweep,eruption,summon,slow,leap,burst` if needed; renderer gracefully falls back to radial telegraph. Boss silhouettes use `e.family`; all bosses still have `e.type==='boss'`.

## Resources, trials and trails

`RESOURCE_NODES`: `{id,kind:'resource',name,x,z,y,material,amount,cooldown,description}`. Material is `wood|stone|food`; amount is a small positive integer; cooldown is seconds (90 default). Three starter nodes (`resource-home-wood`, `resource-home-stone`, `resource-home-food`) lie near the home clearing edge and are physically reachable. Eight outer resource IDs are `resource-<biomeId>`. Village owns renewable cooldown timestamps and awarded inventory.

Additional landmarks: `cache-<biomeId>` has kind `chest`; `trial-<biomeId>` has kind `trial` and `{challenge:'survive'|'discover'|'climb',reward:integer}`. Trial mechanics/claims are simulation-owned. Every site has y and description. Discovery/resource/challenge counts exclude the boss and waypoint.

`TRAILS` is an optional public list of `{id,points:[{x,z},...]}` for independently checking intended routes. A clear outer loop connects eight radial trails to region centers, waypoints and arenas. Center terrain/puzzles are preserved; the starter south approach connects to the outer loop. Road height changes have maximum sampled rise/run≤0.8; obstacles are excluded by at least3m from trail center lines and≥5m around arrival pads. Boss arenas use≥13m obstacle-free radius. Resource/trial/cache approaches are clear. Water may lie beside a road but not drown its usable route.

`TRAIL_ROUTES` contains eight `{id,waypointId,bossId,points,bossPoints}` records, with points beginning `(0,-72)→(0,-120)→(0,-160)`, following the shorter direction around a16-vertex radius160 loop, then a radial trail to the region waypoint45m inward of its center. `bossPoints` continues from that waypoint through region center to its boss60m farther outward. Cache silhouettes are18m beside radial trails, resources12m beside and lookout/trial sites35m beside, with clear connecting branches. These coordinates are intended physical movement paths, not teleport destinations.

## Chunk, spatial and rendering APIs

- `WORLD={size:960,chunkSize:60,spawn,waterLevel:-3,seed}`; VILLAGE `{x:-34,z:-86,radius:28,cellSize:4}`.
- `getChunk(cx,cz)` uses integer chunk indices [-16,15] and returns `{id,cx,cz,props,solids,spawns}`. Deterministic IDs include chunk coordinates and local index. Original PROPS/SOLIDS remain a finite legacy center set. Original authored objects are included once in owner chunks; collision queries consider their complete extents.
- `querySolids(x,z,radius=6)` intersects every solid's full X/Z AABB with query bounds, includes boundary-crossing objects, deduplicates IDs and clamps valid radius to180. Invalid/nonfinite coordinates return[]. Large line queries must split at caller. Broad-phase iterates only touched cells plus one owner-neighbor band.
- `spawnsNear(x,z,radius=110)` returns authored and procedural deterministic specifications with stable id/type/x/z/y; procedural enemies remain outside village/arrival/trail clearances. Boss site records retain all boss metadata. Root filters already-defeated records and final-boss eligibility and applies active actor≤64.
- `worldStats()` returns `{cachedChunks,maxCachedChunks:96,generatedChunks,evictedChunks,lastQueryCells,lastQueryCandidates}`. Height/color/region queries never materialize chunks. GPU residency is independent and capped64.
- Renderer uses a bounded3×3 initial preload followed by at most2 newly built chunks per ordinary frame, nearest first; a bounded7×7 neighborhood prefetches terrain. Chunk eviction deletes WebGL buffers. Renderer stats include `{residentChunks,maxResidentChunks:64,chunkBuilds,chunkEvictions,disposedChunks,residentBytes,staticTriangles}` where bytes/triangles reflect current residency. Existing stats remain compatible.
- Village rendering follows life-contract.md. Missing new state renders old fixtures in daylight. Clock is seconds/600; geometry/shaders use readable light through night. Structures/plots are dynamic geometry and do not force chunk rebuilds.

## Named art tokens

Root updates windwake/DESIGN.md with biome names used above and renderer additions `dune,autumn,alpine,lavender,nightSky,cropLeaf,cropRipe,soil`. Runtime RGB values are named PALETTE entries; no external assets or copied characters are introduced.
