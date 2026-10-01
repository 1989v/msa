# Test-strategy review — REVISE

Scope: future verification plan only. Tests intentionally are not implemented or executed during this planning/art session. Existing prototype tests are correctly excluded as evidence.

## Acceptance coverage and layers
| Requirement | Planned layer / task | Evidence |
|---|---|---|
| SR-1 economy | Pure simulation, T1/T3 | planning/test-quality.md:5–7 |
| SR-2 growth/ownership | Pure simulation + two-client integration, T1/T7 | planning/test-quality.md:8,19–20 |
| SR-3 workers/towers | Pure simulation + real interaction, T3/T7 | planning/test-quality.md:9–10,20 |
| SR-4 terrain/visibility | World unit tests + browser visual comparison, T2/T5 | planning/test-quality.md:11–12,29–32 |
| SR-5 campaign | Deterministic simulation + normal-action completion, T4 | planning/test-quality.md:13–15 |
| SR-6 network/save | Serializer/network tests + actual service/two browsers, T6/T7 | planning/test-quality.md:16,18–26 |
| SR-7 presentation | Browser/phone measurements and human play, T5/T8 | planning/test-quality.md:28–35 |

Pure logic remains real; relay failure injection is an appropriate external boundary. Actual server persistence and two-browser WS gates prevent mocks from standing in for integration. Backend changes retain matching Gradle verification. Plans distinguish rendered CSS bounds, normal action progression, human pacing and actual phone performance. Environment denial remains unverified rather than falsely passed.

## Findings
1. **T1 — Make recovery/dedupe continuity assertions explicit.** `planning/test-quality.md:19,22–23` lists duplicates, chunks and disconnect cases, but does not define the state oracle for `planning/platform.md:48`'s checkpoint plus continuous deltas. Add fixtures with checkpoint K, delta K+1/K+2 and an intervening missing/replayed delta; compare uninterrupted authority state with the recovered state. Test committed-but-unacknowledged and rejected commands across reconnect, stale host/epoch packets, old snapshot rollback, and resume seat reassignment. These tests must assert exactly-once resources/units and explicit recovery on a delta gap, not merely successful reconnection. Include bounded outbound backlog from security finding S2.
2. **T2 — Add concrete two-slot and legacy-preservation fixtures.** `tasks.md` T6 names old-save preservation, but `planning/test-quality.md:25–26` leaves its assertions implicit. Test both maximum-size slots simultaneously after actual PlatformAdapter collection/escaping, at/beyond the 60KiB application and 64KiB server boundaries; include fully explored fog, maximum entities/jobs/queues and non-ASCII metadata. Seed an existing solo slot, coop slot, guest recovery key and `frontline-expedition-v1`; assert only intended slot changes, recovery is excluded from upload, canceled fork does not overwrite solo, and old bytes remain unchanged after new-game/resume/cloud bootstrap. Also test read-success/write-failure storage and optimistic-lock conflict with distinct local/cloud status. These protect `planning/platform.md:61–74` directly.

Verdict: **REVISE**, non-blocking planning changes. Feature nonimplementation and absent test execution are intentional, not failures.

## Round 2 — SHIP

T1 resolved in `planning/test-quality.md`, “리뷰로 추가한 구체 fixture/oracle”: checkpoint K is the exact recovery oracle, while missing/reordered/duplicate display deltas trigger display resynchronization only. Identical future inputs for 600 steps compare uninterrupted and restored simulation. Post-K committed/unacknowledged and rejected commands, old epochs, false-host snapshots, sequence gaps, changed seat mapping, preparation-state gating and bounded-backlog timeouts have explicit assertions.

T2 resolved in the same section: both maximum-content slots include nested escaping, full fog/jobs/spawn queues and Korean metadata, with independent 60KiB client and 64KiB server limits. Distinct original bytes for solo/coop/recovery/legacy keys establish a preservation oracle across cancel/new-game/resume/bootstrap. Recovery upload exclusion, write-only storage failure and optimistic-lock status separation are covered.

Final test-strategy planning verdict: **SHIP**. No remaining retained findings. Real server/two-browser/phone gates remain mandatory future evidence; no tests were implemented or executed in this planning-only review.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
