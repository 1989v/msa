# Independent implementation review — 2026-09-27

**Verdict: SHIP.** Both independently reproduced findings are resolved. No remaining actionable defect was found in the reviewed implementation.

## Scope and independence

Reviewed the current `windwake` diff, new `terrain.mjs`, `melee.mjs`, `presentation.mjs`, relevant surrounding runtime code and tests against `spec.md`, root AGENTS instructions and `docs/standards/agent-behavior.md`. Implementation history and verification/result reports were excluded from the initial review. This review changed no runtime or test files.

Focus: no basic stagger/knockback/hit-stop, shared combo timing, canopy material and depth-limited shader treatment, camera correction/recovery, terrain mesh/collision agreement and caching, durable save compatibility, encounter admission under the actor cap, and critical routes.

## Resolved findings

### SR-5: analytic core boundary had a collision seam

Initial reproduction at `(-1.5,119.999999)` and `(-1.5,120.000001)` measured a **0.0148173 m** height discontinuity, exceeding the **0.001 m** seam gate. Rendering already stitched the edge, but collision switched directly between analytic and triangle heights.

`world.mjs` now blends the final three core metres, from 117 to 120, into the shared triangle surface. Independent resampling of all four ±120 edges at 0.1 m intervals, across ±0.000001 m offsets, measured a maximum discontinuity of **0.0000006270034 m**. Actual core rendered-height comparison using `renderTerrainHeight` and 1.5 m triangles on a 0.5 m grid measured **0.0303473 m**, below the **0.12 m** allowance. All authored trail segments sampled at intervals no greater than 0.1 m had maximum grade **0.5972043**, below **0.8**.

### SR-1: distant idle residents prevented nearby encounter admission

Initial ordinary `runFrontierTrail(driver,'route-sunfields')` reproduction at frame 900, player `(0,-191.739875)`, found 40 residents, two missing undefeated encounters at 16.16 m and 18.41 m, and eight untouched idle ambient actors at 90.6–106.6 m. Sorting incoming candidates did not reprioritize existing residents.

`sim.mjs` now admits nearer candidates by replacing eligible ambient residents, using a 40 m protection radius and a 12 m distance advantage. Engaged, injured, raid, trial, dungeon, boss and summoned live actors are excluded from this replacement policy. The 9 m arrival exclusion and total 64-actor hard cap remain.

Independent rerun of the original ordinary route confirmed both `wild-v2-0--4-0-2` and `wild-v2-0--4-0-0` resident at frame 900, with 40 actors. At 90-frame sampling intervals, cases combining a missing undefeated candidate 9–30 m away with an eligible untouched idle resident beyond 80 m decreased from **18 to 0**. Added natural-walk and protected-actor regressions passed.

## Verification executed by this reviewer

```text
node --test windwake/tests/presentation.test.mjs windwake/tests/terrain.test.mjs windwake/tests/wilds-combat.test.mjs windwake/tests/basic-attacks.test.mjs
# tests 34
# pass 34
# fail 0
```

This covers the shared three-stage impact timeline, basic attack resistance invariants, defensive advantage, minimum ordinary telegraphs, near-landing jump buffering, foliage helper/material behavior, immediate inward and damped outward camera correction, terrain relief and ordinary ascent/descent, legacy spawn identity, population/save budgets, restored floor positions, and saturated boss/raid/trial/dungeon admission.

Independent numerical and ordinary-route probes described above were rerun after both fixes. The paired combat fixtures finished with 100 HP for both defensive controllers versus 64 HP for attack-only in the ordinary melee encounter, and 100 HP versus 32 HP in the mixed encounter.

## Verification boundary

This is the implementation review verdict. The reviewer inspected the real-Chrome test code but did not independently launch Chrome or perform deployment/public hash verification. Those release checks remain separate; the numerical foliage tests alone are not presented as proof of actual shader output.
