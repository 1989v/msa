# Progress

Workspace: `/Users/gideok-kwon/IdeaProjects/msa`. Scope: standalone `windwake/` and this spec directory. Preserve unrelated staged and dirty files.

Current: implementation, repeated Chrome playtesting, improvements, independent final review and subsequently authorized public deployment complete. No open deployment blockers or assigned implementation work.

Verification: 35 Node tests pass with zero failures. Three first-sanctuary routes, full boss journey and optional cave/lake/cache route pass independently in Node and Chrome. Chrome trusted keyboard/mouse/multi-touch, focus loss, save/reload and ending/free-roam transitions verified. Final independent reviewer returned SHIP after rerunning tests, all five routes and syntax checks.

Evidence: `verifications/final-verification.md`, JSON/TAP reports and screenshots. Input suite captures browser exceptions, console errors and error-level log entries; route suite captures exceptions. Performance: headless software WebGL averaged 57.34fps at adaptive scene resolution, with native-resolution HUD.

Observed fixes: intermediate ruin step, zero-axis collision, cover-respecting attacks, third-sigil pulse reward, buffered input, boss stagger resistance, actor separation, reachable lake approach, visible beacons/telegraphs and adaptive scene resolution. Each behavioral fix was rechecked with regression tests or actual input routes.

Running locally: `python3 -m http.server 8787 --bind 127.0.0.1 --directory windwake`; open `http://127.0.0.1:8787/`. Browser verification: `node windwake/tests/browser.mjs input routes optional`. The runner owns its Chrome lifecycle through `scripts/cdp-chrome.sh`; headless trusted input requires focus emulation and no macOS `nativeVirtualKeyCode` override.

Route evidence uses only state reads and movement/action steps, never reward grants or teleportation. Controlled unit fixtures are documented separately. Physical-phone performance, Safari/Firefox and speaker playback quality remain untested; no external asset service was used.

Public release: https://game.1989v.com/games/windwake/index.html — source ebc5a52d, distribution931fef20, deployment742eafc7, portal-fe:742eafc ready1/1. Public Chrome and all eight source hashes pass; see `verifications/deployment.md`. The deployment used a separate latest-main checkout so unrelated local work stayed untouched.
