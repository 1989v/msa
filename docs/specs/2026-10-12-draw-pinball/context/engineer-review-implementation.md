# Implementation review

Verdict: **SHIP** (round 2). Read-only code/spec review; no game implementation or UI execution. Retained amendment review only.

Round 2 resolution: `spec.md:16` now requires exactly one unfinished physical marble, complete order/rank/done updates, and a shared fixed-step completion path for normal step and fastForward. This addresses the sole retained implementation finding. The following round 1 evidence remains implementation guidance, not an open finding or a claim that code is implemented.

Seed discovery: read spec, tasks and context siblings; checked test/agent standards and actual game, party, router, VM loader and prerender sources. `docs/checks/` and portal-local CLAUDE/AGENTS were absent. No new backend or concurrency mechanism is required.

## Round 1 finding — resolved

1. **Define early-last completion as one unfinished physical marble, with one shared completion path.** SR-1 requires a complete result without waiting (`spec.md:16–17`), but current `game.js:134–138` appends actual arrivals, `game.js:272–278` only finishes after all arrivals, and `game.js:292–297` independently finishes fast-forward. Explicitly append the sole remaining marble at rank n after each physics-step arrival processing, mark its done/rank state, then finish exactly once. Do not infer later ranks while two or more physical marbles remain, or equate one remaining owner with one remaining marble (weighted entries exist at `game.js:57`). This definition avoids result truncation and frame-batching divergence while preserving weighted/multiple-pick semantics. Add normal-step/fast-forward equivalence checks.

## Implementation constraints confirmed

- A shared pure interest-set helper can drive camera, name labels and competition eligibility. Current camera is always front 60% (`game.js:173–180`); current automatic slowdown targets the sole next decisive marble (`game.js:203–221`). Those are intended change targets, not existing compliance. Keep participant selection and camera bias out of physics inputs.
- `loadGame.ts:21–55,65–73` executes real physics/game/camera with output-only Sound/FX stubs. It supports deterministic state and camera unit tests without computer use. `main.js`/canvas/clipboard need separate focused tests; do not claim VM simulation alone verifies the whole UI.
- Validate root query intent before mounting `PartyPage`: missing/empty route room currently means host (`PartyPage.tsx:60–61,87–92`). Invalid r must mount an error/correction screen, never the host page. Preserve unrelated host roots (`App.tsx:171–187`) and test localhost explicitly.
- `npm run build` includes prerender, not only TypeScript/Vite (`portal-fe/package.json:9`). The prerender intentionally fails partial API availability (`prerender-seo.mjs:131–149,237–242`); record an environmental failure honestly rather than weakening the gate. No live API test is needed for pure renderer tests.

Reference correction: actual loader is `portal-fe/tests/games/loadGame.ts`, not `.test.ts` (`spec.md:52`). Existing local-storage handoff v1 is reusable (`party.ts:10–31`); preserve its one-shot semantics and keep recent draft storage separate.
