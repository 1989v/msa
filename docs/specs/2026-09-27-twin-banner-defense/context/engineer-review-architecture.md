# Architecture review — REVISE

## Round 2 — SHIP (2026-09-27)

Re-read amended SR-4.6–7 and the verification matrix. Every connected human now sends `done`, and readiness waits for `roundEnded`; A1 is resolved. Disconnect closes the relay before offline continuation and ignores late starts. Architecture review passes; implementation evidence is still required by task groups.

Date: 2026-09-27. Scope: approved-art implementation specification; no other game source inspected.

## Evidence and discovery

- Seed: `spec.md`, then `tasks.md`, `planning/requirements.md`, `context/key-decisions.md`, `context/open-questions.yml`, `context/progress.md`.
- Standards: `docs/architecture/00.clean-architecture.md`, `docs/standards/online-versus-lobby.md`; `docs/checks/` absent.
- Existing integration checked: `game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt`. Game implementation directory is not yet present.
- Pure fixed-step simulation separated from rendering (`spec.md:49`), isolated game-submodule scope (`spec.md:58`), and unchanged server/schema (`spec.md:36`) preserve the intended boundaries. No speculative interface hierarchy or shallow pass-through module is proposed; module-level deletion test remains an implementation check.

## A1 — Specify all-seat round completion, matching the actual relay

**REVISE.** The no-server-change requirement (`docs/specs/2026-09-27-twin-banner-defense/spec.md:36`) and code-room replay (`spec.md:42`) depend on the existing relay. The referenced lobby standard's §5 says the host sends `done`, but `GameRelayRegistry.kt:395`–`406` requires `doneSeats` to include **all occupied seats** before `roundEnded`. A host-only development relay would pass a local replay test and stall on the real server.

**Fix:** In SR-4.7 and the development-relay contract, state that every connected human sends `done` after receiving/producing the authoritative terminal state, and readiness resets only on `roundEnded`. Cover two humans, a survivor after disconnect, and duplicate `done` in the replay test. No server change is needed.

## Verdict

REVISE for A1. No critical architecture violation, no new backend layer, and no reason to require a user design decision.
