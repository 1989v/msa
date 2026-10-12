# Domain review

Verdict: **REVISE**, one non-blocking inherited documentation gap. No domain-model blocker; no implementation or UI calls.

Seed discovery: reviewed spec companions, ADR-0092, `docs/context-map.md`, `game/CLAUDE.md`, domain-review checklist/language reference, and real party handoff, game-selection, relay and marble simulation code.

## D1 — glossary coverage (non-blocking)

The multi-context index at `docs/context-map.md:21` maps platform contexts but has no game context, and `game/glossary.md` does not exist. The terms introduced or reused by `spec.md:13`, `spec.md:22`, `spec.md:26` and `spec.md:35` therefore have no indexed glossary against which to check meaning/Avoid aliases. This is an existing harness gap, not a proposed new context boundary.

Required narrow clarification: flag local draw, invitation code, participant and marble as terms awaiting glossary registration; explicitly retain the current meanings: `/draw` is a local decider launcher, invitation code identifies an existing private party room, and a participant may own multiple marbles. A later `/hns:glossary` may register those definitions and add the game context mapping. No broader party redesign is necessary.

Evidence: `portal-fe/src/pages/games/party.ts:18` defines last/order and v1 handoff; `portal-fe/public/games/marble-race/js/game.js:49` expands participant entries into owned marbles; `game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt:301` resolves an existing private room. Domain checklist explicitly classifies missing glossary as REVISE and recommends glossary work after the spec ships.

## Confirmed invariants

- SR-1 keeps physical result authority and complete order (`spec.md:16`, `spec.md:17`), while SR-2 selection only highlights (`spec.md:22`). Existing order is recorded by marble arrival at `game.js:134`; the review does not redefine weighted/multiple-pick semantics excluded at `spec.md:60`.
- SR-3 exposes decider choices and uses supported v1 handoff (`spec.md:26`, `spec.md:28`), consistent with ADR-0092 Decision F and `rosterHandoff.test.ts:45` rejecting v2. Random selection must remain within the supported local decider pool, rather than accidentally using all roster-ready interactive games (`portal-fe/src/pages/party/gameChoice.ts:23`, `:26`).
- SR-4 correctly treats the code as discovery, not authorization (`spec.md:40`), preserves private room lookup, and disallows malformed-input fallback to hosting (`spec.md:38`). Local participant names stay out of URLs (`spec.md:29`), matching ADR-0092 and `party.ts:4`.

No Avoid-alias or conflicting domain meaning was found in the available documents; missing indexed glossary prevents a complete alias check.
