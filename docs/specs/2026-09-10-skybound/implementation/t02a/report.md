# T02A verification · 2026-09-10

Implemented the deterministic, renderer-independent movement slice for SR-1, sprint stamina from SR-2, and safe respawn preserving opaque progress from SR-7. This packet does not complete T02 or produce a playable game.

Verified with `node --test docs/specs/2026-09-10-skybound/implementation/t02a/tests/movement.test.mjs`: **11 tests passed, 0 failed**.

Evidence covers actual T01B meadow triangle heights, raised path vertices and jagged boundary; identical 30/144 Hz subdivision results; camera-relative diagonal/analog speed; grounded traversal along the winding path and terraces; pre-landing buffer, zero-tick pulse retention, coyote timing and buffer expiry; water recovery preserving isolated progress; sprint drain/exhaustion/recovery; bounded backlog, input clearing and atomic invalid-input rejection.

Terrain is consumed directly from the game's actual geometry, avoiding a duplicated analytic height or island-boundary implementation. Runtime core imports no Three.js, DOM or storage API. Tests alone reuse T01B's existing build-tool Three import. No new dependency or existing-game reference was introduced.

Independent review corrected the default water contact height from 0 to the scene's -18 and made it a finite constructor option. A regression observes uninterrupted falling through y=0, then recovery exactly on the tick crossing the configured water plane. Another regression verifies that a grounded step toward terrain above maxStep is rejected at the previous x/z rather than falling underneath it, while a small upward step still works. This is still point-foot ground contact, not capsule wall collision.

Remaining: character/animation hookup in T02B, browser input and explicit pause/resume, full prop/wall/camera collision, mobile performance and hands-on movement tuning. No renderer or T01B world edits were made. Exact contracts and limitations are in README.md.
