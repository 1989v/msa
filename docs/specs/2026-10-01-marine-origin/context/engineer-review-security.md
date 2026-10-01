# Security review — REVISE

Scope: planning/art only. No missing runtime feature is treated as a defect. Seed discovery covered spec, tasks, planning companions, context decisions, game/testing standards, public relay/platform clients, and backend relay/save limits. No runtime edits or verification claims.

## Confirmed boundaries
- Host validates commands against server-attached sender seat; peer payload ownership and nickname are not credentials. Cooperative assets are campaign-local and not ranked/account entitlements.
- Relay limits match existing code: 4096 characters and 40 messages/s (`game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt:58`). Planned 3800-character envelopes and 30/s budget provide headroom.
- Save ceiling is 64×1024 UTF-8 bytes (`game/feature/src/main/kotlin/com/kgd/game/application/play/service/GameSaveService.kt:30`). Both selected keys together must fit 60KiB, including nested JSON escaping. Recovery key stays outside cloud collection; old prototype key is preserved without conversion.
- Credentials remain in existing auth/save boundaries, with token/code logging prohibited. No commerce/payment processing is introduced. Relay derives wss from the HTTPS page; local ws is the existing development pattern.

## Findings
1. **S1 — Specify inbound authority and bounded replay state.** `planning/platform.md:30` defines host-side intent validation, while `planning/platform.md:40` permits checkpoint assembly and `planning/platform.md:56` relies on its hash. Explicitly require guest ack/delta/checkpoint acceptance only from the current host relay seat and current epoch; a checksum is corruption detection, not sender authentication. Specify finite integer sequence bounds, ordering/gap policy and bounded duplicate-result cache so a rejected or repeated transaction cannot execute after retry/resume. The relay forwards peer data with an attached seat and does not authorize message kinds (`game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt:478`). This is a contract clarification before implementation, not an existing exploit claim.
2. **S2 — Bound outbound backlog under a stalled peer.** `planning/platform.md:41` bounds inbound chunk staging, but `planning/platform.md:43` forbids discarding completed transactions/checkpoints without a maximum outbound queue or timeout. Define queue byte/item limits, maximum checkpoint in flight, and backpressure behavior: stop accepting new transactions or enter explicit disconnected/recovery state rather than accumulate indefinitely. Preserve the latest verified recovery point and do not claim the 5-second loss target during sustained delivery failure (`planning/platform.md:57`).

Verdict: **REVISE**, non-blocking planning changes. Host authority is explicitly noncompetitive; requiring a new authoritative server or cryptographic anti-cheat would exceed this scope.

## Round 2 — SHIP

S1 resolved in `planning/platform.md`, “호스트 권위 메시지”: current host relay seat/epoch validation now precedes ack/delta/checkpoint acceptance; checksum is explicitly not authentication. Finite sequence bounds, ordering, one pending transaction, a 256-result cache and no automatic replay across epochs define bounded deduplication.

S2 resolved in the same section: application queue ≤96KiB/96 messages, one in-flight and one pending checkpoint, ≤64 transaction acknowledgements, socket bufferedAmount backpressure, transaction lock after five seconds and recovery after ten seconds. Verified recovery state is retained, and the five-second recovery freshness target is limited to healthy delivery.

The revised recovery contract uses only complete checkpoint K; display deltas never mutate executable recovery state. This removes the previously underspecified continuous-delta recovery boundary. Current-host/epoch checks, snapshot validation and atomic rollback preserve ownership and exactly-once resource effects within that contract.

Final security planning verdict: **SHIP**. No remaining retained findings. This approves the written plan, not runtime security verification or deployment.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
