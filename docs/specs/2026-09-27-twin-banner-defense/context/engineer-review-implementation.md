# Implementation review — round 1

Verdict: **SHIP** (round 2)

Re-review: SR-4 now describes the actual legacy relay behavior, both-player done, busy admission handling, and relay closure for offline AI continuation. SR-5 explicitly pauses hidden hosts, signals waiting, caps accumulation at 250ms, and discards hidden elapsed time. Test-quality includes those cases. I-1 and I-2 are resolved in the implementation contract; original findings below are retained as review history.

Reviewed `spec.md`, tasks, planning/test-quality, current decisions, the online lobby standard, and the shared `GameRelayRegistry`. No other game implementation was read. The latest approved image supersedes the old SVG direction. The new game directory exists and is empty; its modules are planned artifacts, not missing dependencies. No DB migration or production release is in scope. `docs/checks/` and game-local AGENTS/CLAUDE files were absent.

## I-1 — Reconcile the two-seat contract with the actual relay

- Check 2 (existing-code conflict). Intent: preserve a running cooperative match on disconnect without silently starting a new round.
- Spec evidence: `spec.md:36` (reuse existing two-seat relay), `spec.md:37` (common lobby ready/start), `spec.md:41` (midround reconnect rejected using ROOM_STARTED), `spec.md:42` (done→roundEnded).
- Code evidence: `game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt:313` explicitly leaves two-seat and manual-start rooms open after start; `:315` emits ROOM_STARTED only for nonlegacy, nonmanual rooms. `:357` starts nonmanual rooms immediately when full. `:395`–`:406` requires **all occupied seats** to send done. `:233`–`:237` excludes legacy rooms from the 30-second deadline.
- The shared standard contains older descriptions, so the development relay must reproduce code behavior rather than the conflicting prose. This is not a request to change the server.
- Fix: explicitly make quick two-seat matching start immediately when full (no readiness/host-start guarantee); use preparation/host-start for manual code rooms; have every connected participant send done; remove reliance on ROOM_STARTED. Define active-round hi rejection and/or release the room when entering AI continuation, with stale start/move events fenced by session/round identity. State how a lone quick-match player exits waiting.
- Verify: match a second peer; complete a two-player code round and restart; drop either peer midround, attempt admission to the previous room, and assert the continued game is never reset or joined by that peer.

## I-2 — Decide the hidden-host simulation policy before implementation

- Check 3/4/6 (complexity, bounded work, concurrency). Intent: independently connected devices must continue to agree when the host is backgrounded.
- Evidence: `spec.md:38` makes the browser host authoritative; `spec.md:48` asks for a hidden-tab policy but does not choose one; `spec.md:49` requires time accumulation after long frames. `planning/test-quality.md:10` tests ordering but not the long-frame/background boundary.
- Unbounded accumulated catch-up could burst commands and snapshots after resumption; silently capping elapsed simulation time produces an unexplained pause for the guest. A hidden browser cannot be assumed to keep its foreground timer cadence.
- Fix: choose and document a bounded policy, e.g. host-visible pause signaling plus bounded catch-up and heartbeat timeout, or bounded background stepping with an explicit suspended-host fallback. Specify maximum accumulated time/steps per callback and guest indication during suspension.
- Verify: hide the host during combat, force a long scheduling gap, resume, and assert state convergence, bounded stepping, and ≤40 messages/s including pending sends.

No implementation/build was run; this is a specification review.
