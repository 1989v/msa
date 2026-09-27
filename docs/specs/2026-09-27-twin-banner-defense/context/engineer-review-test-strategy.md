# Test strategy review — 2026-09-27

Verdict: **SHIP** (round 2). TEST-1 and TEST-2 resolved by planning/test-quality.md's SR matrix, fixed seed/configuration, snapshot/save fixtures and independent browser/real-relay boundary. The round-1 findings below are preserved as review history.

## Scope and seed discovery
Read spec, tasks, planning/test-quality, key decisions, reviewer checklist, all three test-strategy procedures, shared review protocol, repository test/agent standards and the permitted online lobby standard. Verified the referenced shared relay file exists without inspecting any other game source. No module scars, portal-local instructions, or configured HNS_KB_PATH found. Kotlin-specific Kotest/MockK requirements do not dictate this standalone JavaScript game's runner; `node --test` is appropriate.

## Finding TEST-1 — turn broad groups into requirement coverage
**Check:** AC → test derivation and negative cases. **Severity:** REVISE.

`tasks.md:17`, `tasks.md:24`, and `tasks.md:30` list broad suites, while `planning/test-quality.md:8`–15 still describe a design-stage plan. They do not derive tests for several explicit requirements. A whole group being labelled "lobby" or "save validation" does not identify the behavior whose pass/fail result completes that requirement.

| Requirements | Existing coverage | Missing concrete cases |
|---|---|---|
| SR-1.1–6 | Core economy/ownership/merge/combat at tasks:17; planning:8–9 | Explicit full-board/grade-4 rejection, move versus swap, support transfer conservation and duplicate no-charge assertions |
| SR-2.1–7 | Asset verifier, gallery and observation at tasks:10–13,23 | Asset failure→visible retry (spec:26); per-kind distinct frame counts and launch/hit timing assertions |
| SR-3.1–4 | Core AI/save validation, natural play | Offline save/resume, malformed/version mismatch prompt, pause/resume, 20-wave normal mode versus test mode defaults (spec:30–33) |
| SR-4.1–8 | Handshake/disconnect in planning:11, two-browser consistency/replay at tasks:30 | All five lobby entry routes; host and guest exits separately; loss/reorder/duplicate/mixed snapshot pieces; old-round command rejection; limits across the whole match (spec:36–43) |
| SR-5.1–5 | Mobile visual/input at planning:15 and tasks:24 | Measured frame rates, idle rendering, hidden host behavior, audio activation/mute persistence, fixed-step equivalence under varied frame times (spec:46–50) |

**Fix:** add a compact SR-item → test case/layer/command-or-manual-evidence matrix to the verification plan and link it from each task group. Use unit tests for deterministic rules and fixed time, real DOM/browser tests for text/input/storage, asset verification plus recorded visual comparison for artwork, and two independent browser pages connected to the actual local dev relay for lobby, completion, disconnection and round reset. Include the lobby standard §7 entry-route and message-budget gates; distinguish 2-seat behavior from its 3+-seat timer branch.

## Finding TEST-2 — make network fixtures and the boundary under test explicit
**Check:** test data strategy and mock boundary. **Severity:** REVISE.

The protocol test command and two-browser tool are named (`tasks.md:31`), but neither tasks nor `planning/test-quality.md:10`–14 defines reproducible fixtures or whether both pages exercise real WebSocket traffic. SR-4.4/6 require fragmented-state safety and continuation after host loss (`spec.md:39`, `spec.md:41`); testing two model instances with the same synthetic state would not validate those promises.

**Fix:** specify a fixed-seed normal configuration and short verification configuration, valid/invalid save fixtures, and snapshot fixtures spanning multiple messages. Keep the pure simulation real and unmocked. The E2E tool should launch its own dev relay and two pages and compare observable canonical state at checkpoints. Inject delay/drop/duplicate/disconnect through the test transport boundary, never by replacing the reducer or copying state between pages. Name cases by given condition/action/expected result. Record the seed/configuration and message-size/rate maxima so failures reproduce.

## Limits
This is a pre-implementation review. No tests have run and no passing implementation is claimed. The proposed checks certify local behavior only; production relay and physical-device thermal certification remain excluded.
