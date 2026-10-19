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

## Autonomous expansion regression — 2026-10-19

The old online bot repeatedly followed its spawn-relative 12-unit square after capture. There was no human-proximity AI sleep: every alive bot was planned every eight ticks. A nearby exposed human trail temporarily changed its target to hunting, explaining the apparent activation on approach. Snapshot AOI only filters nearby heads/chunks; global ranking areas still came from the running simulation.

Same-seed domain reproduction: 4096 world, seed1,30 AI, no humans/viewers,7200 ticks (180 simulated seconds), area samples every30seconds. Before the fix all six maximum-area samples were264, with eight bots exactly264 and none growing beyond their first sample. Before wall time418ms. After the fix maximum areas were1455 /2707 /4073 /5691 /7588 /9091;22 original bots still alive had grown beyond their30-second areas. Every checkpoint increased the maximum; bots can still die under unchanged combat/self-cross/world-edge rules.

The after run used2533ms wall /2462ms current-thread CPU, tick p95 3.381ms and max8.592ms. These cover simulation only, not snapshots/network. Baseline CPU was not recorded; the same-machine wall increase includes real repeated capture work that the old plateau avoided. JVM scheduling/GC and the existing cooperative4ms capture deadline make exact per-checkpoint numbers vary; this is not a production CPU/capacity guarantee. Maximum observed capture work262144 cells/tick and planning scan18750 positions (30×625). Frontier neighbor checks are constant per scanned owned cell. Capture code, queue limits and the deadline were unchanged;4ms is not a hard whole-tick latency bound.

Scoped command: `./gradlew -Pkotlin.compiler.execution.strategy=in-process :game:domain:test --tests '*TerritoryBotTest' --tests '*TerritoryWorldTest' :game:feature:test --tests '*TerritoryWorldServiceTest' --console=plain` → **BUILD SUCCESSFUL**,29 tests,0 failures/errors (new bot7, existing world20, snapshot/AOI2). Additional fixtures cover a6561-cell owned interior growing to9425, a world-corner expansion growing98→1800, stolen closure anchor recovery56→1863, theft after single-point return selection, successive exposed recovery waypoints32units, and hunting-first then expansion49→1660. AOI regression: a distant ranked bot grew1455→2707 while absent from nearby head payloads, then appeared at the current world tick after moving the test viewer near it.

`verifyArchitecture` plus the27 domain tests also completed **BUILD SUCCESSFUL** on the current release base; the historical transaction-qualifier failure above no longer reproduces. `git diff --check` passed.

Fresh-context review retained two recovery defects: selected one-point return anchors needed revalidation, and exposed physical-recovery waypoints needed completion independent of trail emptiness. Both were fixed with targeted regressions; rereview found no further issues. No browser or production traffic was used for this correction. A separate optional60-second one-client ranked-area observer is prepared outside the repository for the deployment owner; it has not been executed.

## Aggressive expansion strategy — 2026-10-19

A12×12 square limits nominal capture throughput to144 cells per three seconds before turns/overlap/pending. Enlarging that constant alone was unsafe:48-unit scratch routes produced407 self-cross deaths in10 simulated minutes. Failure traces showed bots on the last leg intersecting their curved outgoing trail1.6 units before reaching the same frontier closure point. Moving the staging/closing side into owned land removed that repeated geometry failure; an inset48 scratch candidate had only3 self-cross deaths over the same duration. Static48/96/192 inset candidates were compared before selecting the adaptive strategy.

Final strategy starts48, earns96/192 after positive captures, halves after capture failure and temporarily selects48 near another head. Earned size recovers when that head leaves. Frontiers without a safe3–4-unit inward owned approach use existing bounded walking/recovery. Every vertex retains the4.5-unit world-edge margin; the3-unit inset is used only when a4-unit inset cannot keep that margin. Own-trail obstruction retries share768 perimeter probes per new plan; discovery remains625 positions and new-plan head checks are bounded by the30-player population while bots are present. No extra perimeter scan each tick, map-wide planning, target commitment change, movement bonus or capture-budget increase.

Standalone same-process-source comparisons used4096 world,30AI/no humans, seed1/2/3 and600 simulated seconds each (24000 ticks). Baseline is4c87d73; adaptive is the source in this change. Each variant ran in its own Java25 JVM with `-Xmx1g` on the same development machine. Scratch instrumentation counted deaths/completed captures and pending ticks without changing gameplay. The wall-clock capture deadline can change exact outcomes between runs. No production traffic or UI was used.

| Seed | Baseline median / total live area | Adaptive median / total live area | Median gain | Deaths baseline → adaptive | CPU seconds baseline → adaptive |
|---|---:|---:|---:|---:|---:|
|1|10,342 /383,537|126,644 /5,985,485|12.2×|44 →41|10.75 →9.68|
|2|9,859 /282,573|94,046 /4,255,712|9.5×|60 →42|9.88 →10.46|
|3|11,017 /340,037|182,257 /5,049,654|16.5×|54 →40|9.95 →11.15|

Adaptive maxima were513,773 /564,688 /485,782. Self-cross deaths fell43/59/52 →10/6/5; trail-cut deaths25/32/31 remain an intended risk of longer exposed paths. Capture failures were0 in these runs. Pending ticks increased1321/839/872 →2533/2992/3578, and maximum individual capture latency increased8/6/7 →42/52/34 ticks (up to1.3 simulated seconds). All runs retained30 bots and the262144-cell/tick capture bound. Larger captures improve throughput while legitimately increasing exposure and pending time; bots do not receive free territory or immunity.

Wall seconds baseline11.19/9.96/10.03 versus adaptive12.72/10.58/15.02. Adaptive tick p95 approximately4.03–4.05ms; maxima72.10/10.15/61.06ms include observed shared-machine/JVM outliers. The existing4ms cooperative capture deadline is not a hard total-tick guarantee. Observed Java heap peaks591–621MB under a1GB test heap include transient allocations and are not content-host RSS or a production memory guarantee. This simulation-only sample excludes snapshots/network and does not establish production CPU utilization or player capacity.

Focused regression coverage retains population/hunting/owned-interior/world-edge/stolen-anchor/recovery/AOI cases and adds the formerly failing48-unit closing geometry plus temporary threat shrink/large-plan recovery. Work counters assert per tick at most30×625 discovery positions,30×768 perimeter probes,30×30 new-plan head checks and262144 capture cells. Fresh-context review returned SHIP with no actionable findings; reviewer did not duplicate owner test execution.

Final command: `./gradlew -Pkotlin.compiler.execution.strategy=in-process verifyArchitecture :game:domain:test --tests '*TerritoryBotTest' --tests '*TerritoryWorldTest' :game:feature:test --tests '*TerritoryWorldServiceTest' --console=plain` → **BUILD SUCCESSFUL in1m9s**,31 tests/0 failures (bot9,world20,service2), all architecture gates passed. `git diff --check` passed. Detailed local evidence: `/private/tmp/zone-war-aggression-final.log` and `/private/tmp/zone-war-aggression-probe/final-seed-{1,2,3}-length-{12,192}.log`.
