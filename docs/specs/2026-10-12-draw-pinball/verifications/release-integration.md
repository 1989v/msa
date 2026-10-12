# Release integration — Random Race

2026-10-13. This record supersedes the original working-tree integration notes in `final-verification.md` for publication. No browser/UI tools were used. Push and deployment belong to the parent session.

## Isolation and preserved history

- Root release worktree: `/Users/gideok-kwon/.codex/worktrees/d3c3/msa`, branch `release/random-race-20261013`, based on root remote main `eb796b07377320a6daa08e46669e31127c8aaa3d`.
- Games release worktree: its `portal-fe/public/games`, branch `release/random-race-20261013`, based on games remote main `bf2c5243`.
- Cherry-picked only source games commit `560224e4c61d9c5964a01d9e8d5e94e80e9ef854`; resulting games commit `b0f445616a8ee1603f1ccd207bab59c5ae99690e`. Exactly seven marble files changed. Source and integrated stable patch IDs both equal `d47899e4291d9220d453e7111fd3918da09b6e23`.
- Cherry-picked only source root commit `cdea8ff58350014e689af07a1572c7d19a9a1038`; resulting feature commit `803191add4ded25d8f6de65946c9cbd4fbf6aac2`. The only merge conflict was the games gitlink; it points to the new isolated games commit. App/GamesPage/PartyPage auto-merged onto current remote code. App's delta is seven additions and one replacement; current IT screens and other remote routes remain.
- Root source/release changed-path lists matched exactly before this new report. No package/lock/service changes. The original working tree and its unrelated staged/dirty changes were untouched; no reset, stash, rebase, full-history push or force push was performed.
- Current remote HttpOnly-auth migration uses `isLoggedIn`; the owned invite test mock was adapted to `isLoggedIn: false` instead of removed `getAccessToken`. All assertions are unchanged. Initial verification exposed this mock mismatch (10 failures), then the corrected complete focused suite passed.
- Removed one trailing space from the archived build log so `git diff --check` passes. No implementation/physics changes were made during release integration.

## Verification commands and evidence

Commands below run in the isolated `portal-fe` unless stated otherwise. The root/package lock equals the original dependency lock (`cmp` exit 0), so `node_modules` is an ignored symlink to the existing installation. No dependencies were installed or mutated.

1. `node scripts/render-content.mjs`: exit 0; generated five current tech drill datasets and three place-guide pages for this clean checkout.
2. `npx vitest run tests/games/marbleNameTags.test.ts tests/games/marbleNativeControls.test.ts tests/games/marbleCompetition.test.ts tests/games/rosterHandoff.test.ts tests/games/marbleDeterminism.test.ts src/pages/games/__tests__/DrawPage.test.tsx src/pages/games/__tests__/GamesPage.seo.test.tsx src/pages/party/__tests__ src/shell/__tests__/appShell.test.ts > /private/tmp/random-race-release-tests.log 2>&1`: **Test Files 16 passed (16); Tests 129 passed (129); Duration 8.60s**. Includes independent zbar short/legacy/UTF-8/multi-block decoding at three sizes, invite correction/StrictMode/stale-start, new draw/handoff, native marble controls, deterministic physics and current game-shell/SEO regressions.
3. `git diff --name-only origin/main -- '*.ts' '*.tsx' | sed 's#^portal-fe/##' | xargs npx eslint`: exit 0. After the mock correction, `npx eslint src/pages/party/__tests__/PartyPage.invite.test.tsx`: exit 0.
4. `npx tsc -b`: exit 0. Full current-root frontend type checking, after generated content.
5. Root `git diff --check origin/main` and games `git diff --check origin/main`: exit 0.
6. `npm run build > /private/tmp/random-race-release-build.log 2>&1`: **exit 0**, Vite **built in 2.20s**, public API **184 game pages / 82 games**, **539 place region pages**, **20 place landing pages**, **3 guide pages**, **13 glossaries / 500 concepts**, comment stripping **892 files**. Current remote architecture serves place detail HTML dynamically, explaining the lower static page count than the old-base build. No API fixture or disabled prerender was used.

The already verified 216 schedule simulations and 1080 course runs in `final-verification.md` are retained. The isolated games patch is identical and no physics changes occurred, so those expensive matrices were not repeated.

## Publication boundary

Publish games first, then the root branch with its remotely reachable new gitlink, retaining remote main history and active hooks. The root hook path remains `/Users/gideok-kwon/IdeaProjects/msa/.githooks`; pre-commit ran and its doctor reported PASS 100/100. No hook was bypassed. Commit authors remain `kgd <1989v@naver.com>`.
