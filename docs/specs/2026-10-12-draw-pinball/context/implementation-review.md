# Implementation Review

Verdict: **SHIP** — round 3 scoped code review, 2026-10-12. Both round 1 findings remain resolved; branding and render-only label changes add no unresolved code findings. Read-only review; no tests rerun or UI/browser calls. Implementation worker owns final verification evidence and completion checks.

## Round 3
- User steering reflected in `portal-fe/src/pages/games/DrawPage.tsx:21`, `:43`, `GamesPage.tsx:356`, `:373`, and dormant `PartyDialog.tsx:88`: Korean branding is 랜덤레이스 and English is Random Race. Hub entries still navigate to `/draw`; handoff, participant settings, and route contracts are unchanged. Spec/key-decisions record the naming choice.
- Render-only overlap fix reviewed at `portal-fe/public/games/marble-race/js/art.js:266` and `main.js:309`: a copied/sorted list builds separate label positions, colliding labels stack upward, and shifted labels keep leader lines to the original physical marble. Layout does not mutate marble positions, rank, done, or simulation state.
- `portal-fe/tests/games/marbleNameTags.test.ts` checks three nearby labels for pairwise separation and unchanged input marbles. Parent-provided latest worker evidence: focused suite 15 files / 122 tests in 8.47s; physics matrices previously passed. This reviewer did not rerun them.
- Remaining completion gate: worker post-brand/render build and approved browser artifacts. No additional code revision requested.

## Round 2
- Keyboard fix reviewed at `portal-fe/public/games/marble-race/js/main.js:68`, `:103`: Tab is no longer prevented, and `closest('input, textarea, button, summary, select, a')` excludes native controls and their descendants from game shortcuts. This prevents Enter on result-copy from launching a new race before the native click.
- Guidance fix reviewed at `portal-fe/public/games/marble-race/js/game.js:231`: `selectionGuide()` uses camera x/y and unpadded viewport dimensions, emits horizontal/vertical directions, and checks all unfinished physical marbles of the selected owner for a visible member. main.js consumes this single guide.
- Regression coverage read: `portal-fe/tests/games/marbleNativeControls.test.ts`, `marbleCompetition.test.ts`, `marbleSchedules.test.ts`, `marbleCourseMatrix.test.ts`, and `portal-fe/src/pages/party/__tests__/PartyPage.invite.test.tsx`. Native controls protect phase/seed/result text; guide tests cover both axes and multiple marbles; invite component tests cover invalid correction, legacy/root joins, same-code retry, and clipboard rejection.
- Parent-provided worker evidence: the actual schedule matrix completed all 216 runs (3 seeds × 3 courses × 4 modes × 6 schedules) with full order matching fastForward, in 89.34s. This reviewer did not independently execute that matrix.
- Completion evidence still pending at this review: course matrix/bias results and worker final CLI/browser verification. Code-review SHIP is not a claim that those checks passed; attach their evidence before claiming implementation complete.

## Round 1 Findings — Resolved

### Major — Native controls collide with global shortcuts
- Location: `portal-fe/public/games/marble-race/js/main.js:19`, `:101`, `:166`.
- Failure scenario: on the result screen, pointer-focus **결과 복사**, then press Enter. The key bubbles to the global handler, which runs `handleKey('fill')` and `launch(lastOpt)`. The button's native activation then calls `Game.resultText()` in the new ready phase, so an empty string can be copied while success is reported. Space is prevented, and Tab is swallowed globally, so keyboard users cannot navigate/activate the new participant controls normally.
- Evidence: the handler exempts only `INPUT`, `TEXTAREA`, and editable content; `SWALLOW` includes Tab and Space. Native buttons/summary are not exempt.
- Fix: allow Tab, and bypass game shortcuts for native interactive targets (including descendants of button/summary). Add a focused native-control keyboard regression check that protects the current seed/phase and copies the completed result.

### Minor — Selected participant guidance can report an invisible marble as visible
- Location: `portal-fe/public/games/marble-race/js/main.js:289`, `:310`.
- Failure scenario: while zoomed into the attention group, select another participant at the same height near a course edge. Their x position can lie outside the viewport, but the status says **화면 안에서 강조 중**. A marble up to 80 world units beyond the vertical viewport is also classified as visible because the status uses the padded drawing band `cam.band(80)`.
- Fix: compute actual unpadded viewport x/y bounds for the guidance; report left/right/up/down and retain minimap guidance. For owners with multiple physical marbles, base guidance on visible members or explicitly describe the offscreen member.

## Clean Architecture Analysis
- Layer Classification: `game.js` owns deterministic simulation and presentation attention policy; `main.js`/`setup.js` adapt DOM/canvas input and rendering. Invitation parsing and draft helpers are small frontend boundary modules; DrawPage orchestrates existing catalog and v1 local handoff.
- Dependency Flow: DrawPage → catalog API / draft + handoff helpers; PartyPage → invite parser / existing party relay; main/setup → Game/Courses. No new backend service, database, authentication protocol, or cross-service dependency found.
- Violations: no inward-dependency or API-boundary violation identified in this scoped diff. Existing frontend global game architecture is preserved.

## AGENTS.md Compliance
- Reviewed root AGENTS.md, DESIGN.md, agent-behavior standard, approved spec/test-quality/key-decisions, and ADR-0092. No additional AGENTS.md was found under portal-fe.
- Pass: scoped course changes; existing v1 payload and relay code issuance reused; draw imports no relay or roster API; failed handoff prevents navigation; invite cardinality/format distinguished from host intent; new CSS uses existing color tokens and native controls specify 44px targets.
- Pass after round 2: native keyboard interaction and viewport guidance (DESIGN.md focus/accessibility requirement and spec SR-2/SR-3).
- Pending evidence: required simulation matrix, course completion/bias comparison, route/component retry/error coverage, and approved browser verification are being produced by the worker. This review does not assert they passed.

## Summary
- Unresolved Issues: Critical 0 / Major 0 / Minor 0. Round 1 resolved: Major 1 / Minor 1.
- Overall Assessment: SHIP for scoped code review.
- Priority Actions: attach worker final course matrix, CLI, and approved browser verification evidence before completion.
