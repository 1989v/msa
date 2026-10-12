# Test-strategy review

Verdict: **SHIP** (round 2). No tests executed; this reviews the proposed verification coverage. Retained amendment review only.

Round 2 resolution: `planning/test-quality.md:10–14` now specifies actual Game.step at 30/60/120Hz, manual/selection/fastForward equivalence, 3 fixed seeds × 3 courses × 4 modes, complete unique marble ranks/done assertions, one-physical-marble vs same-owner-two fixtures, competition bounds/recovery and interest-ID consistency. It also specifies routing/parser/catalog/storage/copy/share negative cases and fixed course completion/bias sample sizes, a 240-second simulation bound and a reported Spearman threshold. Both retained findings are addressed. The matrix and mock-boundary guidance below remain the implementation verification contract; SHIP is spec approval, not a claim of passing tests.

Seed discovery: read spec/tasks/context, reviewer procedures, project test/agent standards and real VM, physics, router, party and prerender code. Frontend Vitest conventions apply; Kotlin-only test naming is not applicable to these TS/JS changes.

## Round 1 findings — resolved

1. **The determinism task must exercise actual normal stepping, not only fast-forward.** SR-1/SR-2 require presentation-independent outcomes (`spec.md:17,22`); existing `marbleDeterminism.test.ts:12–23` only calls fastForward, and assertions at `:29–31` accept a nonempty partial order. Require full n-length unique marble identity/ranks, done phase and equal final order across fixed seeds/courses/modes, normal stepping at multiple frame schedules, automatic/manual slowdown and participant/camera selection. Compare at completion, not equal wall time. Include a fixture with exactly one remaining physical marble and a negative fixture with two remaining marbles of one owner, plus 2/3-marble near-entry vs far-apart competition, bounded slowdown duration/recovery, and shared camera/name interest IDs. Real `loadGame.ts:65–73` is the correct execution boundary; Sound/FX stubs are output-only. Any canvas/clipboard tests need a separate boundary because those modules are omitted.

2. **Add an explicit SR-to-case matrix and deterministic course sample gates.** Tasks (`tasks.md:7,13,20`) contain topic-level tests but omit several required negative paths. Use the matrix below before implementation; define fixed seed count, participant counts, simulation budget and reported positional bias measure for SR-5 (`spec.md:44`). Current repeated-seed equality (`marbleDeterminism.test.ts:39–42`) cannot establish completion or starting-slot fairness. Do not replace evidence with a flaky random fairness assertion.

| Requirement | Minimum test layer and cases |
|---|---|
| SR-1 | Real VM unit/simulation: competition eligibility, timeout and recovery; early-last completeness; same order under presentation controls and frame schedules |
| SR-2 | Pure/VM interest-set unit: last/first/rank/order, target rank boundaries, selected/offscreen participant; focused renderer/control unit tests for shared names and touch/selection behavior |
| SR-3 | React component + handoff integration: no relay create/connect, supported catalog filter, loading/failure/retry/empty/<2, stored draft restore and corrupt/unavailable storage, names absent from URLs, v1 consumed by actual game parser, result copy success/rejection and new-round participants |
| SR-4 | Pure parser + routing/party component: valid/lowercase/whitespace/hyphen/full-link; missing vs empty/invalid/duplicate r; game and localhost roots vs apex/place/blog/deal/resume/rank roots; old ko/en links; invalid input never host/create; unknown/closed relay errors; share AbortError vs other rejection; click-only clipboard/share |
| SR-5 | Real fixed-seed simulation: all three courses, defined counts/seeds/time limit, complete unique order, replay equality, positional result report against baseline; focused static preview tests |
| Design/build | Component semantics/CSS inspection: input labels, focus and reduced-motion/44px controls; focused Vitest + `npx tsc -b`, touched ESLint, full `npm run build` including prerender and `git diff --check` |

Mock boundaries: stub catalog/relay network at their outward API boundary, clipboard/share/storage capability and failures as environment edges; use real handoff/parser and Game/camera/physics. Import prerender renderer functions without hitting API (`prerender-seo.mjs:144–146`), then run the separately documented full build. UI screenshots and real browser behavior remain unverified until explicit computer-use approval; component tests do not substitute for that evidence.
