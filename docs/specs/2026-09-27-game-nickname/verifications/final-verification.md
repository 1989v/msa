<!-- source: game/feature/src/main/kotlin/com/kgd/game/application/profile/service/GamePlayerProfileService.kt, portal-fe/src/game-profile/GameProfileHost.tsx -->

# Verification — 2026-09-27

## Result
Code validation PASS · fresh review SHIP · browser PASS. Deployment and production migration have not been performed.

## Server
`./gradlew -Pkotlin.compiler.execution.strategy=in-process :game:domain:test :game:feature:test :gateway:test verifyArchitecture`

Final output: **BUILD SUCCESSFUL in 27s**. XML: domain 78, feature 278, gateway 33, failures/errors/skipped 0. Real MySQL integration 16 cases, skipped 0. Architecture checks cover layer direction, Flyway wiring, transaction qualifiers, topology and other existing gates.

MySQL checks include normalization uniqueness race, simultaneous same-player submissions, guest claim+rename rollback, owner XOR, existing member precedence, legacy preservation, combined ranks and current profile name projection. Controller checks include proxy HTTPS Secure cookie and GET/PUT no-store.

## Portal
`npx tsc -b` exit 0. Scoped lint passed on new profile code.

`npx vitest run src/api/__tests__/gameProfileApi.test.ts src/game-profile/__tests__ src/pages/games/__tests__/GameLeaderboard.test.tsx src/pages/games/__tests__/GameSuggestions.test.tsx src/pages/games/__tests__/LeaderboardRail.test.tsx src/pages/games/__tests__/leaderboardView.test.ts src/pages/games/__tests__/GameDetailPage.loop.test.tsx`

**8 files / 75 tests passed**. Existing GameDetailPage loop tests produce act/network console warnings but pass; no tests were weakened. Actual interceptor test verifies delayed A 401 does not replay PUT as B.

## Shared game widget
`node --test portal-fe/public/games/lib/tests/rank-profile.test.mjs`: **9 passed, 0 failed, 0 skipped**. JS syntax and scoped diff checks passed.

Real Chrome fixture runner `node portal-fe/public/games/lib/tests/rank-profile-browser.mjs 9418`: seven PASS lines (standalone input focus, focus trap, Escape restore, sandbox ACK timeout fallback, valid ACK suppression, actual fullscreen exit/keyboard trap, trusted input save).

## Actual browser
Portal at local Vite, API responses mocked at CDP boundary (not a deployed backend E2E). Desktop open/focus, duplicate response, guest create, rename preserving playerId, 390px mobile no overflow, repeated Tab stays within modal, Escape close passed; runtime exceptions 0. Screenshots: desktop.png / mobile.png. browser-report.json records results.

Button text contrast after theme correction: light 9.98:1, dark 8.62:1; OS light/dark × site light/dark all pass. Mobile dialog left16/right374 inside390px viewport.

## Docs / shared working tree
Updated ADR-0102, spec, decisions, tasks and game/CLAUDE.md. `doc_scan.py --base HEAD --json` ran. `doc_map.py --check` reports drift for the shared working tree (501 changed paths; broad unrelated pending work). The generated global lock was not rewritten to mix those changes into this task. No global docs lock PASS claim.

Existing games submodule pointer was already different from root HEAD before this task (root3356e767 vs local630f6669). Widget changes are committed inside games separately; unrelated pre-existing pointer changes are preserved rather than included in the root commit.

커밋 훅은 실행되었고 exit0으로 완료했다. warn-only doctor는 기존 문서들의 source citation 부족 등 전역 문서 health 경고를 출력했다. 이번 spec 문서에는 source citation을 추가했다.
