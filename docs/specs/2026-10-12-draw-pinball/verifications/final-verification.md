# Final verification — 랜덤레이스 / Random Race

Implementation: 2026-10-12; recovery + QR/invitation lifecycle correction: 2026-10-13. Working tree `/Users/gideok-kwon/IdeaProjects/msa`; commands below run in `portal-fe` unless stated otherwise. No push or deployment.

## Verified implementation

- `/draw` and `/en/draw`: local roster/mode/game draft, supported catalog filtering, v1 one-shot handoff, storage failure blocks navigation and preserves input, room-code entry. No relay hook or roster API is mounted by DrawPage.
- `/?r=ABC234`: current-origin short invite; game/loopback root only. Duplicate/empty/malformed queries remain invalid guest intent; lowercase/space/hyphen/full-link normalization and legacy ko/en routes supported. Corrected/same-code join retries work. StrictMode socket cleanup resets the opened target and leaves old rooms; invalid invitations cannot consume stale room starts.
- Marble: bounded final-entry competition slow motion, mode-aware shared attention/camera/names, native touch/keyboard selection and actual viewport offscreen guidance. Exactly one unfinished physical marble is appended with final rank/done in the common fixed-step callback. Full physical results are retained. Native result copy/failure feedback and same-roster fresh seed round work.
- Small finish-entry variants + static SVG previews distinguish pinball bounce, cascade merge and carousel rotors. Collision-aware labels stack with leader lines without mutating marbles.
- QR format-bit coordinates corrected; four-module white quiet zone, six integer CSS pixels/module, crispEdges, square non-shrinking display. Error correction L and existing encoder/version behavior retained.

## CLI evidence

1. Focused integration command:
   `npx vitest run tests/games/marbleNameTags.test.ts tests/games/marbleNativeControls.test.ts tests/games/marbleCompetition.test.ts tests/games/rosterHandoff.test.ts tests/games/marbleDeterminism.test.ts src/pages/games/__tests__/DrawPage.test.tsx src/pages/games/__tests__/GamesPage.seo.test.tsx src/pages/party/__tests__ src/shell/__tests__/appShell.test.ts`
   Output: **Test Files 15 passed (15); Tests 122 passed (122); Duration 8.47s**. This includes all relevant existing party/handoff/shell/SEO suites. Initial PartyPage test act warnings were removed by awaiting its mount; assertions were retained.
2. Actual schedule matrix command:
   `npx vitest run src/pages/party/__tests__/PartyPage.invite.test.tsx src/pages/party/__tests__/invitation.test.ts src/pages/games/__tests__/DrawPage.test.tsx tests/games/marbleSchedules.test.ts`
   Output: **4 files / 28 tests passed; schedule test 89344ms**. Actual `Game.step`: 3 fixed seeds × 3 courses × 4 modes × 30/60/120Hz/manual slow/selection, each compared with fastForward = **216 complete simulations**. Full unique IDs, all ranks/done and done phase asserted. A redundant render-frame mutation of physics stall `best` was removed; that value now belongs exclusively to the fixed-step callback. No physical code changed after this matrix.
3. Course command:
   `npx vitest run tests/games/marbleCourseMatrix.test.ts`
   Output: **1 file / 1 test passed; 515680ms**. **180 complete/replay pairs** (3 courses × 2/6/12 people × 20 seeds), plus 120 six-person seeds/course for both baseline and changed course = **1080 runs total**. All complete within 240 simulation seconds with full unique orders and repeatable results. Portable baseline source snapshot is `portal-fe/tests/games/fixtures/marble-entry-baseline.json`. Results: [course-matrix.json](course-matrix.json).

   | Course | Min–max sim seconds | Baseline rho | Changed rho |
   |---|---:|---:|---:|
   | pinball | 17.45–34.71 | 0.00946 | -0.01885 |
   | cascade | 13.64–25.58 | -0.05969 | -0.05212 |
   | carousel | 12.96–33.46 | 0.07659 | 0.11188 |

   Each correlation pools 720 marble observations. All satisfy the specified investigation threshold `abs(rho) <= 0.20`; this is a bounded bias check, not proof of fairness.
4. After QR + lifecycle changes:
   `npx vitest run src/pages/party/__tests__/PartyPage.invite.test.tsx src/pages/party/__tests__/qr.test.ts src/pages/party/__tests__/qrDecode.test.ts src/pages/party/__tests__/usePartyRoom.test.ts && npx tsc -b && npx eslint src/pages/party/PartyPage.tsx src/pages/party/qr.ts src/pages/party/__tests__/PartyPage.invite.test.tsx src/pages/party/__tests__/qr.test.ts src/pages/party/__tests__/qrDecode.test.ts`
   Output: **4 files / 31 tests passed; Duration 1.82s; tsc and eslint exit 0**. This supersedes changed tests above and adds format/geometry/decoder + StrictMode/stale-start cases. Untouched physics matrices were not repeated.
5. All touched TS/TSX files (including new VM tests, types, loader, invitation/draw code and old PartyDialog branding) were explicitly passed to `npx eslint`: **exit 0**. Intentional untyped IIFE globals in the existing VM loader have local explanatory no-explicit-any comments; new marble test records use shared typed fields. `git diff --check` at root and games submodule: **exit 0**.
6. Post-brand/render full build: `npx tsc -b && npm run build > /private/tmp/draw-pinball-final-build.log 2>&1`, **exit 0**: `✓ built in 42.87s`, `프리렌더 184개 페이지 · 게임 82종`, `place 상세 프리렌더 6539장`, `주석 제거 6854개 파일`.
7. Post-QR full build: `npm run build > /private/tmp/draw-pinball-qr-final-build.log 2>&1`, **exit 0**, Vite **45.34s**, same successful prerender and strip stages. Final post-lifecycle `npm run build > /private/tmp/draw-pinball-lifecycle-final-build.log 2>&1`: **exit 0**, `✓ built in 34.46s`, `프리렌더 184개 페이지 · 게임 82종`, `place 상세 프리렌더 6539장`, and `주석 제거 6854개 파일`. This corresponds to the final code, including QR and lifecycle fixes. Existing large-chunk/plugin timing warnings are informational; no unrelated failures were repaired.

## Independent QR decoding

- Local installed decoder: `/opt/homebrew/bin/zbarimg`. No dependencies or external QR service added.
- Exported the real TypeScript encoder with existing esbuild, rendered clean PGM symbols and ran `zbarimg`. Original short and legacy symbols at 132/200/231px: **0/6 decoded**, including four-module quiet-zone versions.
- Root cause: `writeFormat` stored BCH format bits with row/column transposed. Scratch-only coordinate correction decoded **6/6 exact original URLs** at those same sizes before repo editing. This establishes why enlargement alone was insufficient.
- Added decoder regression on the real encoder: short URL, legacy URL, UTF-8 text and version-six multi-block payload, each at 132/200/231px: **12/12 decoded exactly**, test **552ms**. Test explicitly skips if zbar is absent; the standard format-bit and geometry tests remain portable and mandatory.
- Actual browser-rendered mobile screenshot also independently decodes:
  `zbarimg --quiet docs/specs/2026-10-12-draw-pinball/verifications/party-qr-mobile-fixture.png`
  Output: **QR-Code:http://127.0.0.1:5175/?r=ABC234**, exit 0.
- Browser measured SVG `viewBox="-4 -4 33 33"`, width/height **198 CSS px**, `shape-rendering="crispEdges"`; no adjacent label intrudes into white quiet zone. This is decoder evidence, not a measured phone scan rate.

## Approved UI evidence and limits

Explicit approval recorded in `context/key-decisions.md`: local loopback and game.1989v.com only; UI/screenshot reads, fake names, courses/mobile viewport, temporary rooms, link/code joining, and user-click copy. No native share target was submitted and no external message sent.

- CUA iab/Chrome providers were unavailable. Dedicated Chrome DevTools provider succeeded by opening the approved URL directly. Broad app/tab inventory was not used.
- Local viewport **390×844**. Real local catalog failure/error/start-disabled path observed before fixture. Local success screenshot uses a clearly labeled temporary catalog fixture on port8089; fake A/B/C roster + order handed off through the actual detail iframe and deployed v1 parser, then one-shot key was consumed. Draft remained and URL contained no names.
- Real new local marble setup → race → result, selection, result copy, focused copy Enter preserves done seed/phase, and same roster/new seed round verified. Pinball last-entry snapshot uses a genuine seeded contested state paused only for screenshot/camera settling; names remain readable. Cascade and carousel also completed in-browser (20.61 and20.55sim seconds in those particular fresh rounds). Determinism claims come from CLI matrix, not these random UI rounds.
- Local duplicate-r root showed explicit error and no host setup. Corrected ` abc-234 ` navigated to `/party/ABC234`; valid local short root showed guest intent. Local real relay is absent; new-code successful join and lifecycle assertions use component tests and a labeled browser-only room-state fixture for QR rendering.
- **Existing deployed protocol only**: on game.1989v.com, created temporary room **GMGHX8**, user-click link copy succeeded, and legacy guest URL joined from a separate context. Host showed two people. Production has not received this new code; this is not a live deployment check of new short routes.
- Screenshots: [branded draw / fixture catalog](random-race-mobile-fixture-catalog.png), [marble countdown](marble-mobile-race.png), [late contest](marble-mobile-late-contest.png), [result/copy](marble-mobile-result.png), [QR / room-state fixture](party-qr-mobile-fixture.png).

## Integration and remaining limitations

- Fresh implementation reviews SHIP after native-key/viewport corrections, label stacking/branding, and narrow QR/lifecycle review (latest verdict recorded in context).
- Existing multi-pick/weights meaning is unchanged and remains a follow-up; no backend services, auth or random-code issuance changed.
- Root HEAD games gitlink is `58dd81be5959c2bfd82fc5fa21c56c75ebdc832b`; preexisting **staged** gitlink is `15cf171c49ce44901e5d2486ed124e716e7863dd`; games working HEAD before this feature is `d1bbfa6a91bda9172113c22a8b506ffa7af08c27` (already committed unrelated duel-defense history).
- Initially the parent instructed preserving that staged pointer and leaving rootintegration pending. The user subsequently replied **"진행해"** to the concrete integration question; parent confirmed advancing to current games560224e4 including its already committed interveninggames history. Only this gitlink and listedFE/spec paths are authorized in the rootcommit; all other staged/dirty paths remain unchanged. Only this feature's seven marble files are committed inside games as **560224e4** (`feat(marble-race): focus final competition and streamline results`), parent **d1bbfa6a**. Games has no configured/installed Git hook; none was skipped. Root hooks/index were not altered. Explicit root ownership is in `owned-root-paths.txt`; no unrelated staged entry was added, reset or committed.
- Selected integration: advance to games560224e4 with the existing interveninggames history. No isolation, push or deployment. Active rootpre-commit hook is `.githooks/pre-commit`; unrelatedindex entries and dirtyfile hashes are snapshotted before committing and compared afterward. Rootcommit hash is reported separately to avoid a self-referential document hash.
