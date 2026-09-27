# Verification — 2026-09-27

Status: local implementation verified. Public deployment not performed.

| Step | Result | Evidence |
|---|---|---|
| Standards/review | PASS | Fresh context review SHIP, no P0/P1/P2; see verifications/fresh-review.md. |
| Syntax | PASS | node --check on all 15 JavaScript modules: PASS syntax: 15 JavaScript modules. No separate linter configured for this standalone vanilla-JS game. |
| Build/load | PASS | No build step or external runtime packages. Real Chrome loaded all modules and five PNGs; runtimeErrors=[] in E2E. |
| Unit/protocol | PASS | node --test tests/*.test.mjs: tests25, pass25, fail0. Includes actual WebSocket tests. |
| Assets | PASS | node tools/verify-assets.mjs:14 types,84 frames,9.65 MiB. Full production-decoded gallery visually inspected. |
| Browser | PASS | node tools/e2e.mjs: PASS9/9 checks, final run 2026-09-27T14:34:59.934Z. |
| Mobile viewport | PASS | 390×844; all16 placement targets minimum44 CSS px. Desktop1600×1000. |
| Production/physical phone | NOT RUN | Production relay, remote devices and thermal testing remain outside local verification. |

Commands run from portal-fe/public/games/twin-banner-defense. Full browser evidence: [browser-e2e.json](verifications/browser-e2e.json).

Real browser checks cover independent contexts, corrupt save handling, save/resume, actual create/join/ready/start, plain-text chat, guest movement and summoning with confirmed returned state, identical authoritative snapshots,3-wave completion, same-room rematch, host window closure and guest continuation with AI. Maximum relay message: 2193 chars; maximum observed rate: 18/second (limits4096/40).

The full20-wave rules also pass in core tests. Independent reviewer additionally completed12 seeds and validated11,865 snapshots. Browser3-wave mode is available only on loopback with ?test=1; normal mode remains20 waves.

## Visual inspection

- [Actual battlefield](verifications/play-art-review.png): clean stone path, approved painted scenery,10-unit roster rendered independently, blue/red flag ownership, projectile in flight.
- [All84 frames](verifications/gallery-all-frames.png): bow draw, sword slash, spear thrust, gun recoil, drum strike, catapult arm, hwacha volley, battery/cannon flash, enemy walk/hit/fall. No magenta backdrop or adjacent sprites visible after extraction.
- [Portrait combat](verifications/e2e-portrait-combat.png), [landscape combat](verifications/e2e-landscape-combat.png), [AI continuation](verifications/e2e-ai-continuation.png).

A first browser run exposed a stale-snapshot guest summon-selection race after a move. main.mjs now distinguishes explicit empty-cell intent from selecting the moved unit. The strengthened E2E waits until guest sees the authoritative moved unit and190 gold before comparing snapshots. It passes. e2e-failure-* files preserve the initial failure, not the current result.

## Route revision verification — 2026-09-28

- `node --test tests/*.test.mjs`: tests41 / pass41 / fail0.
- `node tools/e2e.mjs`: PASS10/10. Added actual browser checkpoints and screenshots forwaves1,6,11,16; previous solo/save/co-op/rematch/AI tests retained.
- Public-release smoke validated locally on ordinary non-test game: PASS6/6, two independent Chrome processes, actualwire snapshots schema2 withrouteIds, maxWaves20/testModefalse. This smoke verifies configuration and initial combat, not20-wave completion.
- Asset check:14types/84frames/9.50MiB active artwork. Built-in image_gen edited only the map connections; output `assets/battlefield-routes-v2.png`, prompt `planning/route-background-prompt.txt`.
- Fresh review SHIP after fixing latelegacyhi, codeinvite-toquick mismatch and busyACKloop. Additional12seeds/9,485 valid snapshots checked by reviewer.
- Release game commit `19e6c2c3e2e3e1c76824ad7e045c4da201b45769`; parent gitlink commit `02ced3bc`. Public verification recorded separately in `verifications/public/public-smoke.json` after rollout.

## Production release — 2026-09-28

- URL: https://game.1989v.com/games/twin-banner-defense/index.html
- Image workflow: https://github.com/1989v/msa/actions/runs/36338402776 — completed/success.
- Rollout: deployment portal-fe successfully rolled out, updated1/replicas1/ready1; image portal-fe:02ced3b.
- Deployed js/data.mjs: HTTP200,text/javascript; byte-for-byte identical to locally verified data.mjs.
- `PUBLIC_GAME_URL=https://game.1989v.com/games/twin-banner-defense/index.html node tools/public-smoke.mjs`: PASS6/6, finished 2026-09-27T17:56:42.692Z. Real production WebSocket, two independent Chrome processes, no testhooks. Both peers shared schema2/routeIds/normal20-wave settings and matching wire snapshots; guest closure preserved live host progress with AI. Runtime errors0.
- Evidence: [public-smoke.json](verifications/public/public-smoke.json), [production combat](verifications/public/public-online-host.png). Actual physical-phone thermal tests remain unperformed.
- Test-only assertion strengthened after release in local commit db35ad77; runtime release remains19e6c2c3. No unrelated dirty code deployed.
