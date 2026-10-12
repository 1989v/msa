# Architecture review

Verdict: **SHIP**. Read-only review; no implementation or UI calls.

Seed discovery: reviewed spec, tasks, planning/requirements, context/key-decisions, ADR-0092, relevant game service guidance and agent standards, then production FE/relay/simulation code. `docs/checks/` and `.claude/rules/` are absent.

- Invitation reuse preserves the existing boundary: SR-4 explicitly keeps server issuance/private join/rate limit and adds no URL service or database (`spec.md:35`, `spec.md:40`). `GameRelayRegistry.kt:301` already rejects a missing private room, `:567` checks code collisions, `:578` uses SecureRandom-backed generation, and `:585` limits messages. This matches ADR-0092 Decision A.
- Local draw does not acquire network party ownership (`spec.md:26`, `spec.md:31`). Existing `party.ts:54`/`:56` define the v1, local-storage handoff; ADR-0092 Decision F requires preserving v1. Durable recent preferences must remain separate from the consumed handoff, whose one-shot behavior is tested in `rosterHandoff.test.ts:82`.
- Presentation remains outside result authority (`spec.md:17`, `spec.md:22`). `game.js:246` feeds elapsed presentation time into fixed-step advancement; `physics.js:19` owns the 240 Hz step and `game.js:288` already offers fixed-step fast-forward. Course changes retain the deterministic arithmetic guard documented in ADR-0092 Decision D and `marbleDeterminism.test.ts:52`.
- Host-root isolation is required explicitly (`spec.md:36`), compatible with existing host discrimination in `App.tsx:56` and explicit legacy party routes at `App.tsx:251`.

No new architecture seam, cross-service persistence, or duplicated server room authority is proposed. Implementation verification must cover invalid-invitation paths never calling host/create, complete result order after last-marble acceleration, and unchanged order across presentation controls.

Code references above are under `portal-fe/src/pages/games/`, `portal-fe/src/`, `portal-fe/public/games/marble-race/js/`, `portal-fe/tests/games/`, and `game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/` as named in the spec.
