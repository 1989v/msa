# Progress — Territory sample

Worktree: `/Users/gideok-kwon/IdeaProjects/msa`; this task owns only the new game/spec directories. Other staged/dirty files predate this work and must be preserved.

Implemented engine and responsive shell. Fresh-context review: SHIP, no concrete blockers. `node --test portal-fe/public/games/territory-lab/tests/engine.test.mjs`: tests 9, pass 9, fail 0 (includes 1,800 ticks). `node --check` app/engine/tests: exit 0. Scoped ESLint recommended rules: 3 JS files checked, 0 errors. HTTP HTML/app/engine/CSS: 200 at `http://127.0.0.1:4178/games/territory-lab/` (server session 73482). Implementation and non-UI checks complete; optional visual/input review remains.

The games directory is the `1989v/games` git submodule; it was clean except this new directory. Game source commit: `29df533c4368eac0fc22831fd5b27397f6785785`, directly descended from root's prior pointer `560224e4c61d9c5964a01d9e8d5e94e80e9ef854` with no unrelated commits. Specs and that pointer are included together in the scoped msa commit. No push or deployment is authorized by this sample task.

No browser/computer-use approval exists in this implementation task. Do not use CDP, Playwright, screenshots or browser automation without the parent's explicit approved scope. No expensive intermediate artifacts.

## Feedback fixes — 2026-10-18

Root causes: input only listened for down events and engine always moved every human; AI followed blind rectangular plans without checking trails. Added a separately testable held-input controller with keyboard/pointer release, pointer capture/cancel, overlapping holds and focus/visibility/pause clearing. Human starts/stops in place; stationary trails remain vulnerable and are neither cleared nor duplicated. AI now prioritizes safe cuts within 12 path steps and avoids its own trail; all movement/collision/capture still flows through the shared engine. Circular player markers replace arrows. World is 360×360 (2.25× previous area) with proportional minimap and unchanged camera cell size.

Verification: `node --test portal-fe/public/games/territory-lab/tests/*.test.mjs`: tests 18, pass 18, fail 0; sustained 1,800-tick simulation runs at new world size. All five MJS files pass `node --check`; scoped ESLint recommended rules: 5 JS files checked, 0 errors. `git diff --check`: exit 0. HTTP HTML/app/engine/controls: 200. Fresh-context review: SHIP after correcting a test fixture that asserted moving-only reversal rejection on a stationary spawn. No UI/computer-use checks performed. No push or deployment.

## Reverse, rendering and standings follow-up — 2026-10-18

Reproduced two regressions before the fix: reverse-after-release was accepted, and input release/repress caused a self-trail death. `World.turn` now retains the last travelled heading across stops; opposite input is rejected and the existing input callback stops the human. Fresh humans have no travelled heading and may choose any first direction. All existing collision and exposed-trail rules remain.

Renderer removes the cell background grid and per-tile seams/frames. Same-owner visible row runs are filled as one compound path with sparse world-anchored patterns; only perimeter/hole borders are stroked. Trail cells become one connected round-cap/join line. Display cells shrink from 14/10px to 10/8px desktop/mobile; logical map remains 360×360 and movement remains 8 discrete cells/s. Draw cadence follows requestAnimationFrame; no interpolation, UI rendering verification or measured performance claim.

Approved new upper-right field ranking has a fully transparent, pointer-transparent surface. Actual sorted TOP 10 appears five rows at a time for six active seconds with name, area and approximate current player coordinates (nearest ten cells). Self marker/weight, reset/pause timing and small populations are covered. Side duplicate removed. Changes are instant with no animation.

Verification: `node --test portal-fe/public/games/territory-lab/tests/*.test.mjs`: tests 25, pass 25, fail 0 (including 1,800 seeded ticks). Nine MJS files pass `node --check`; scoped ESLint recommended rules: 9 files, 0 errors. Fresh review: SHIP after retaining and fixing a refresh-rate issue (removed the 16ms RAF throttle, which skipped excess frames on 75/90/144Hz schedules). Bounded recheck confirmed the fix. HTTP HTML/app/engine/controls/rendering/standings/CSS: all 200; local Python server session 16580 replaces the stopped earlier server. Game source commit: `c96f759a` (10 scoped files). Games hooks directory contains sample hooks only; no active hook was skipped. Initial commit hit index.lock sandbox restriction; normal escalated retry succeeded. Root docs/pointer commit is left to the parent session. No computer-use tools used; browser/mobile/visual/performance review remains outside authorization.

## 720 world and anchored cosmetics — 2026-10-18

Approved bounded follow-up: 720×720 default, unchanged10px/8px display cells, equal movement and start. Terrain revision invalidates the minimap and area recount only on land changes; movement-only frames reuse cached minimap terrain. Capture remains full-world flood-fill; browser performance is not measured.

Solid/dashed perimeters; safe24-character signs with built-in flag/star/leaf symbols live in world state with owner/cell anchors. Start play, choose **간판 배치**, then click/tap owned land or **현재 위치에 배치**. Max3, edit/delete controls, cancel/Escape, no automatic resume. Lost cell/death/reset deletes signs with no transfer. v1 nickname/color/pattern/sign preferences migrate with new defaults; world positions are never persisted.

Checks: Node suite33/pass33/fail0, including1800ticks720 and retained360 regression. All11 MJS syntax checks pass. Scoped ESLint recommended rules:11 files, exit0. HTTP index plus7CSS/MJS assets: all200 at http://127.0.0.1:4178/games/territory-lab/. git diff --check exit0. Fresh review caught edit/delete node replacement on movement-only HUD refresh; fixed by decoration-data caching and pausing when sign-tools gain focus. Bounded re-review verdict: SHIP (no remaining issue in fix; no UI exercise). Game-only local commit: `0a944ced`. Root spec files and submodule pointer remain for parent integration.

No UI/browser/CDP/Playwright use: visual/input/performance approval remains outstanding. No backend, uploads, online features, publishing, push or deployment. Working in original games submodule; unrelated woodland-haven untracked files preserved. No expensive intermediate artifacts.

## Full viewport, faster movement and collapsed map — 2026-10-18

Approved bounded feedback implemented at shared12cells/s (1000/12ms,1.5× prior), unchanged720logical world,10px/8px cells, held input and reverse blocking. Field fills100dvw/100dvh with floating HUD, TOP10, touch keys and status. Settings/cosmetics begin closed; opening pauses, closing stays paused. Placement closes the drawer and moves current-position/cancel controls into a separate field overlay. Initial/reset map closed; accessible 맵 보기/맵 닫기 toggles lower-right translucent click-through map; blank minimap terrain now clears transparent and hidden map redraw is skipped.

Evidence: `node --test portal-fe/public/games/territory-lab/tests/*.test.mjs` → tests34/pass34/fail0 (new JSDOM non-UI shell test checks map toggle/reset, settings pause/no-resume, placement controls and cancellation; existing33regressions retained). `node --check` all12MJS files passed. Scoped ESLint recommended rules12files,0errors. Scoped `git diff --check` and cached diff check exit0. Fresh-context focused review verdict SHIP, no concrete blocker; stale speed/layout spec references updated. HTTP index and7CSS/MJS assets all200 at http://127.0.0.1:4178/games/territory-lab/. Prior local server was stopped (connection refused); restarted Python static server session33009. No UI/browser/CDP/Playwright use; actual visual overlap, touch behavior and performance remain unmeasured.

Game-only local commit `e4d91b9f` (six territory-lab files), directly follows0a944ced. Initial commit hit sandbox index.lock permission; normal escalated retry succeeded. Games has only sample hooks, none bypassed. Root docs/pointer integration left to parent. Unrelated woodland-haven tracked/untracked work preserved; no push/deploy. No expensive intermediate artifacts.
