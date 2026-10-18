# Territory wire protocol v1

Same-origin `POST /api/v1/games/territory/tickets` requires an existing game profile. No body. Response is the platform `ApiResponse` envelope with `data: {ticket, expiresAt, wsPath: "/ws/games/territory"}`. Tickets expire after 30 seconds and redeem once. No credentials appear in a WebSocket URL. Missing profile returns `PROFILE_REQUIRED`. Duplicate live identity returns `ALREADY_CONNECTED`; a closed session may obtain a fresh ticket and join again.

All WebSocket frames are JSON objects. Client frames are at most 2048 UTF-8 bytes, at most 60 frames/second. First frame must arrive within five seconds. Server sends errors as `{t:"error", code}`. Invalid protocol, authentication, rate or size violations close the connection. Inputs never supply position, land, score or another player's identity.

| Client frame | Fields |
|---|---|
| `join` | `version:1, ticket:string` |
| `input` | `seq:nonnegative safe integer, moving:boolean, angle:finite radians` (angle optional when stopped) |
| `respawn` | none; only a dead participant can respawn |
| `cosmetics` | `color:0..5, pattern:0..2, border:"solid" or "dashed"` |
| `placeSign` | `x:integer, y:integer, text:string <=24 Unicode characters, logo:"flag" or "star" or "leaf"`; anchor must be owned; at most three |
| `removeSign` | `id:integer`; own signs only |
| `ping` | optional `nonce` string <=32 characters |

`input.seq` must increase strictly. Server retains the newest input only; no unbounded input queue. Movement expires after 350ms without refresh. Client sends held input at 20Hz and an immediate stop on release/blur/settings/help. The world continues while one player stops.

`welcome` carries `{t, version:1, self:id, size:4096, cell:1, chunkSize:64, speed:16, turnRate:18.84955592153876, tickHz:40, snapshotHz:10}`.

`state` carries `{t, tick, ack, self, rank, players, owners, ownerIds, living, chunks, dangerChunks, trailOwners, removedChunks, top10?, population, map?, status}`. `self` is an authoritative player object `{id,name,x,y,heading,alive,area,bot,cosmetics,signs,pending}`. `players` contains nearby heads or visible trail owners as `{id,x,y,trailSegments}`; distant heads use null coordinates. Decorative polyline segments are bounded; they are never the collision-danger source. `owners` supplies changed appearances/signs, and `ownerIds` is the complete current appearance subscription; retain unchanged subscribed entries and evict IDs leaving it. `living` is the complete live-life baseline. `top10` is global `{id,name,area,x,y}` with approximate coordinates, sent initially and once per second; retain it when absent. `population` is `{humans,bots}`. `status` reports capture processing or death/spawn retry. `ack` is the last accepted input sequence.

`chunks` contains at most nine chunks per state: `{id,x,y,revision,runs:[[offset,length,ownerId],...]}`. Runs describe a full 64×64 row-major chunk, omitting neutral cells. The client replaces that entire chunk atomically; revision equality skips unchanged terrain. Nearby view radius is bounded by server. New chunks stream over successive snapshots until complete; a new connection starts with an empty cache. `removedChunks` lists IDs leaving the view. Owner IDs are ephemeral nonnegative integers; zero is neutral. Owner metadata includes appearance even when the owner is outside the nearby player view.

`dangerChunks` independently delivers every changed nearby trail chunk (at most49), using the same RLE shape but run values are ephemeral trail handles. `trailOwners` maps active trail handles to life IDs and is a complete baseline every state. Capturing or dying invalidates the trail handle immediately, so a cached raster cannot leave a ghost collision hint even while its owner remains alive. New loops receive fresh handles. Physical raster/map cleanup examines at most4096 cells per tick and is queued in one4096-bit deduplicated workset. Namespace `id+4096` in `removedChunks` evicts danger chunks. Render this exact danger layer conservatively with merged rounded marks; smooth decorative polylines are additional detail.

`map` is a coarse list of occupied chunk summaries, updated at most once per second; clients must retain the last map when this field is absent. It is a navigation approximation, never used for collision or score. `pong` echoes a bounded nonce. Error/status rendering uses textContent.

Transport output has a bounded queue. A slow consumer is disconnected and must reconnect for a fresh complete chunk baseline. There is no offline gameplay fallback or automatic retry that hides disconnection.

Resource limits:4096 concurrent transport sessions and pending tickets (operational admission, no100-seat game rule),8 outgoing frames per peer,262144 UTF-8 bytes per frame,65536 occupancy cells per individual trail and262144 retained global trail entries. Capacity exhaustion stops further trail growth visibly; it does not silently eliminate the player. Capture has one active same-tick cohort plus four pending cohorts; it prepares at most262144 cells per tick and checks a4ms deadline every1024 fill operations/4096 staged cells. Maximum capture payload staging is two sparse ownership layers, approximately128MiB plus bounded frontier/metadata. Commit applies chunk pointers and precomputed actor deltas, never a wholeworld cell loop.
