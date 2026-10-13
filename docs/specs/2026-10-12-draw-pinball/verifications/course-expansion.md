# Course expansion and completed-only replay — 2026-10-13

Workspace: `/Users/gideok-kwon/.codex/worktrees/d3c3/msa`, isolated `feature/marble-course-expansion-20261013`. Historical six untracked live-QA files were preserved. No push or deployment.

## Final behavior

- Six courses: original 핀볼/폭포/회전목마 plus 지그재그/범퍼 숲/시소. New previews and short Korean descriptions. Original serialized geometry/physical parameters remain identical; only original tags change. No edits to parts.js, physics.js or game.js.
- The user's later request supersedes the earlier fast-forward proposal. No player skip, race/result canvas button rows, bottom shortcut strip, or background-tap restart. Racing Space/Enter/R do not advance time or reset. Internal `Game.fastForward` remains simulation/development tooling.
- Completed results expose one centered native replay target (64 CSS px; SVG32px, “다시 보기”) after the existing0.4-second guard. Replay retains map/roster/mode/seed and immediately hides during ready/racing. ResultR also retains seed; result bodySpace/Enter are no-ops. Native button/summary keys do not execute global shortcuts.
- Native menu: participant selection, manual slow view and participant editing; result copying and an explicit new-seed “새로 시작하기” are available only after completion. Expanded menus use actual canvas width before the minimap and bounded scrolling. Result winner/rank layout reserves the center replay area.
- `useStageFit(active, forceImmersive=false)` preserves responsive state. Only marble-race forces the existing full visible-viewport stage. Height follows the smaller innerHeight/visualViewport height; canvas aspect ratio is preserved. Other games and fullscreen/close behavior remain on their existing paths. Host controls remain top-right; HUD reserves their area where canvas/host controls share the top edge.

## Simulation evidence

Command: `npx vitest run tests/games/marbleCourseExpansion.test.ts`

Output: `Test Files 1 passed (1)`, `Tests 3 passed (3)`, test runtime123268ms. The360 new-course completion/replay/bias runs plus12 representative schedule runs were executed once. They were not repeated after presentation-only corrections or the no-skip steering.

Each new course completes and repeats for2/6/12 people ×10 fixed seeds (i×7919). Each start-x sample uses60 six-person seeds (360 marbles), with the existing investigation threshold |Spearmanρ|≤0.20. Full JSON: [course-expansion-matrix.json](course-expansion-matrix.json).

| Course | Completion range, simulation seconds | Start-xρ |
|---|---:|---:|
| zigzag |27.07–34.72|−0.07447|
| bumper-forest |11.04–32.59|−0.05160|
| seesaw |8.35–30.18|−0.07671|

One representative six-person seed per new map also matched30/60/120Hz ordinary stepping against fixed-step fast-forward. These finite samples establish completion/replay and detect the measured start-x relationship; they do not establish universal fairness or all-seed completion.

Original-course geometry hashes were captured before editing and exclude only display tags. Latest preservation command: `npx vitest run tests/games/marbleCourseExpansion.test.ts -t 'keeps the original'` → `Tests 1 passed | 2 skipped`; skipped expensive matrix/schedule cases already passed above. Simulation/game/parts sources remain unchanged, preserving original seeded outcomes.

## CLI evidence

- Focused suite: marbleCompetition, marbleDeterminism, marbleNameTags, marbleNativeControls, rosterHandoff, stageOrientation, useStageFit, GameDetailPage.loop → `Test Files 8 passed (8)`, `Tests 48 passed (48)` (8.14s).
- Latest replay/menu/rank guard + viewport/route corrections: marbleNativeControls/useStageFit/GameDetailPage.loop → `Test Files 3 passed (3)`, `Tests 8 passed (8)` (4.97s). Includes20 physical marbles' rank rows outside the centered replay target, native keys/same seed/no skip/background no-op,0.4-second protection, and actual canvas menu max-width/height constraints.
- Touched ESLint: exit0,0errors; one pre-existing GameDetailPage stageRef cleanup warning (line139). Existing route tests also emit pre-existing act/XHR stderr; assertions pass.
- `npx tsc -b`: exit0.
- Final fresh-context read-only review: SHIP after expanding-menu/minimap correction. Earlier fast-forward overlap finding is superseded because fast-forward was removed; original art/minimap layout is restored.
- Final-source `npm run build`: exit0; `✓ built in 2.54s`, `프리렌더 184개 페이지 · 게임 82종`, `주석 제거 892개 파일`. No repeated original1080-run/216-schedule marathon.
- Root/games `git diff --check`: exit0.

Command result summaries are recorded above; structured simulation/UI outputs and reproducible scripts are in [course-expansion-ui/](course-expansion-ui/).

## Approved local browser evidence

The user explicitly approved localhost/127.0.0.1 browser reads/screenshots, fake local names/settings, game execution, icon/menu keyboard actions and viewport sizing. Actual GameDetailPage and shipped iframe scripts were served by Vite at127.0.0.1:5186. Catalogue/session endpoints returned local test responses; external browser requests were blocked. This validates frontend/game rendering and controls, not the live backend. No production browsing/POST, rooms, sharing, clipboard copying or native fullscreen were performed.

Final candidate screenshots and measurements contain no old fast-forward candidate. Browser execution used the project CDP wrapper with an owned isolated profile. Natural completion was observed without calling dev.scene, changing phase or invoking fastForward in final UI verification.

- Stage/frame dimensions fill measured visible height at360×780,390×844,480×640,720×720,844×390 and desktop result1440×900. Aspect ratio is retained, including mobile width-limited letterboxing.
- Exact480×640: rendered HUDright390CSS px, host toolbarleft400px (10px gap).720-square: HUDright582px, toolbarleft640px.844×390: HUDright542.04px, toolbarleft764px.
- Expanded12-distinct-name menus (12 characters each) do not cover the minimap.844×390: menu right538.36px, minimap left546.37px (8px gap); participant-edit action bottom329px remains inside menu bottom346px and has44px height.480/720 and360/390 also pass the actual bounds checks.
- Final natural12-person seesaw run: simulation24.53s, seed2184441237. Trusted native replayEnter starts ready with the same seed and hidden replay. Trusted replayclick was separately confirmed on the same implementation. MenuEnter/Space leaves the replayed race/seed intact and shows focus outline. Unit tests cover replayEnter/Space default activation and duplicate guarding.
- Current new-map racing screenshots verify all three new selections. All six course names are exposed in the actual setup. All final root stage close actions restore the non-playing view. Result ranks remain visible around the center target.

Measurements: [replay-measure.json](course-expansion-ui/replay-measure.json), [mobile-measure.json](course-expansion-ui/mobile-measure.json), [new-maps-measure.json](course-expansion-ui/new-maps-measure.json). Final result menu action accessibility and owned-process cleanup are recorded below after their checks complete.

Representative screenshots: [mobile result](course-expansion-ui/replay-result-390x844.png), [short landscape result](course-expansion-ui/replay-result-844x390.png), [exact-aspect race](course-expansion-ui/replay-race-480x640.png), [long-name menu](course-expansion-ui/replay-menu-844x390.png), [new zigzag course](course-expansion-ui/replay-race-zigzag-390x844.png).

Reproduce from repository root: start the local fixture with `VITE_API_URL='' node docs/specs/2026-10-12-draw-pinball/verifications/course-expansion-ui/scripts/serve.mjs portal-fe`; set CLAUDE_SCRATCHPAD to a new owned canonical scratch directory and use `scripts/cdp-chrome.sh start <name>`. The committed measurement scripts take `<CDP port> <output directory>` and use only127.0.0.1:5186. Stop the owned browser with the same wrapper/profile root and stop the fixture process afterwards.


Result menu: [result-menu-measure.json](course-expansion-ui/result-menu-measure.json) and [screenshot](course-expansion-ui/replay-result-menu-844x390.png) validate the completed12-long-name roster at844×390. Menu top8/bottom346px; both result-copy and new-start actions top293/bottom337px,44px high, within the reachable menu. Neither was clicked.

Owned browser cleanup: `CLAUDE_SCRATCHPAD=/private/tmp/marble-expansion-ui-20261013 scripts/cdp-chrome.sh stop marble-expansion` stopped/deleted only the owned CDP profile. Canonical `/private/tmp` was required because `/tmp` is a macOS symlink. The own fixture and keep-alive shell were stopped separately. No user/MCP browser or other profile was targeted.


Final asset check: `FINAL_GAME_ASSETS match shipped source; replay/menu present; player skip/bottom rows absent` (exit0). Built courses/setup/main JS are byte-for-byte equal to final source; final HTML includes the replay control styling. Owned CDP port9403 no longer responds and its task profile directory is absent after cleanup.
