<!-- source: game/domain/src/test/kotlin/com/kgd/game/domain/territory/model/TerritoryWorldTest.kt, game/feature/src/test/kotlin/com/kgd/game/infrastructure/territory/TerritoryEndpointTest.kt, portal-fe/public/games/territory/tests/client.test.mjs, gateway/src/test/kotlin/com/kgd/gateway/config/GatewayRoutingSpec.kt -->
# Online verification — 2026-10-18

## Implemented scope

CPU-only authoritative Kotlin world, 4096×4096 units, continuous movement with 1-unit occupancy, held input, AI population fill to30, territory stealing and disconnected land retention, incremental capture, exact visible trail raster, bounded network queues and local rendering caches. Final client: `/games/territory/`. Existing comparison samples remain unchanged.

The production integration uses existing server profiles and one-use HTTP tickets, the content host, and a separate exact WebSocket route. The runnable local verification launcher uses the same engine and adapters with a **test-source-only in-memory profile store**. It is not a deployment or a production account service.

## Automated evidence

- `:game:domain:test --tests '*TerritoryWorldTest'`:20 tests,0 failures/errors. Includes independent small-grid flood oracle, input/stop/collision/capture/lifecycle, sustained100 active actors, large capture budgets, and100-player capture-completion cleanup.
- `:game:feature:test --tests '*territory*'`:11 tests,0 failures/errors (endpoint8, ticket1, snapshot1, slow consumer1). Actual Tomcat/100 independent WebSocket clients, identity, replay, origin, input lease/rate, late terrain synchronization and metadata updates. Fake stalled asynchronous writes test cleanup separately.
- Existing regressions: GameRelayEndpointSpec6 and GamePlayerProfileControllerTest7,0 failures/errors.
- `node --test portal-fe/public/games/territory/tests/*.test.mjs`:9 pass,0 fail. Input throttling, reconnect baseline, exact danger generations, metadata cache and null-coordinate interpolation.
- `:gateway:test --tests '*GatewayRoutingSpec' --tests '*AuthenticationGatewayFilterTest'`:BUILD SUCCESSFUL;20+13 tests,0 failures/errors. New ticket route matches the profile identity filter before public catch-all and rejects invalid credentials/forged identity headers.
- `verifyArchitecture`: layer dependencies, external API quotas, Flyway wiring, topology, search index contract and test conventions passed. Overall FAILED at existing `verifyTransactionQualifiers`: BlogShortLinkService and GameShortLinkService constant transaction-manager annotations (six findings). Those unrelated classes were not changed; overall architecture PASS is not claimed.

## Performance evidence and limits

Local Apple M4 Pro/Darwin arm64, Java25.0.2 for game tests. No GPU server or GPU computation. These are development-machine measurements, not a capacity guarantee for a low-cost cloud VM. Builds and other applications shared the machine; timings varied between runs.

Latest metadata-delta 100-socket measurement:100 clients alive and moving,20Hz input,10Hz snapshots,4096 world. All clients concentrated nearby. Initial terrain burst was excluded from bandwidth's3.273-second sampling window; pipeline timing also includes startup ticks (432 samples).

| Metric | Observed |
|---|---:|
| Delivered steady bytes/sec, all100 clients | 7,104,125 (~7.1MB/s,56.8Mbps) |
| Tick + snapshot/JSON generation p50 | 0.161ms |
| Tick + snapshot/JSON generation p95 | 18.329ms |
| Maximum sampled tick + snapshot | 185.632ms |
| JVM heap observed | 435,334,928bytes |
| JVM GC cumulative count / time |141 /608ms |

Heap and GC figures cover the whole Spring test JVM, not isolated territory allocations. Maximum latency is a real observed outlier; the p95 passing25ms does not mean every tick met the deadline. This short test establishes functional100-client fanout and a local cost sample, not a soak test, low-end mobile rendering result, production SLA, or unlimited capacity.

The preceding metadata-heavy version delivered19.76MB/s; revised owner appearance deltas and1Hz rankings reduce that by~64%. Exact collision danger data remains present. Earlier movement-only benchmarks that lost living participants were discarded; subsequent tests assert100 active humans throughout. Do not cite the discarded results as capacity evidence.

Capture work has a262,144-cell ceiling and a4ms deadline checked in batches. Synthetic rectangular capture budget comparisons gave256²~25ms,1024²~225ms and4000²~3.1s of simulated pending time; the latter previously took98.7s at8,192 cells/tick. Deadline/contended runtime can extend pending time. The4000² test performs12,036 descriptor/aggregate operations at atomic publication, not16million cell mutations. The final100-cohort completion test with204,800 old trail references measured1.96ms for the finish tick and4,096 physical cleanup cells. Semantic trail invalidation is immediate; stale storage is reclaimed incrementally through a bounded4,096-chunk workset.

## Browser verification

User explicitly approved local4180 `/games/territory/` plus local profile setup and play-state changes. Parent observed initial screen, authoritative join,49-cell start, ranking carousel, settings and map toggle. During concurrent user play, the displayed captured area reached4,460 with rank1; the parent did not itself automate that capture. Open map displayed human1/AI29. The player/land rendered rather than a black field. Fast native key taps did not provide a meaningful sustained-movement timing measurement. On the final metadata-delta server, an older tab stopped updating and showed an empty page after reload. A fresh native Chrome tab successfully joined with the retained test nickname:49 cells, live coordinates, TOP10 switching between1–5 and6–10, human1/AI29, map open/close and cosmetics open/close. Its screenshot confirmed the blue land and circular player with no entry overlay. The older-tab cause was not established; it did not reproduce in the fresh tab. Native short key/drag actions did not establish sustained movement or stop timing. A separate non-UI actual-app test with a DOM/canvas stub and real HTTP/WebSocket frames ran118 animation frames in2 seconds without an exception; this does not validate native Canvas performance. The approved local UI bundle is complete.

## Delivery and deployment boundaries

Run: `./gradlew -I portal-fe/public/games/territory/tools/local.init.gradle :game:feature:territoryLocal`, then open `http://127.0.0.1:4180/games/territory/`. Loopback only. Stop/restart resets this in-memory world; there is no offline retention. Real deployment must use a single designated world-owner content instance. No deployment, migration, publication or push was performed. Games client lives in its own Git submodule; root pointer is deliberately not staged with unrelated concurrent game commits.
