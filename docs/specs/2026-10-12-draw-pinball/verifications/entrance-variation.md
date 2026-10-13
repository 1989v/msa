# Entrance variation — 2026-10-14

Final scope: five newly shaped entrances plus the original cascade collection. All six are geometrically distinct. Pinball distributes through pegs; carousel uses a mirrored rotor pair; zigzag uses paired stepped walls; bumper forest uses a central peg and bumper pair; seesaw uses paired short tilting arms. Cascade retains its proven original hopper after bounded regression investigation. Spawn, physical constants, simulation, replay, downstream y496 and finishes remain unchanged.

## Evidence and commands

- Initial all-six completion/replay/schedules: `npx vitest run tests/games/marbleEntrances.test.ts -t 'all six entrance profiles'`: **2 passed, 1 skipped**, 182.47s, 504 actual simulations (180 completion +180 same-seed replay +120 additional sample +24 schedules). `entrance-matrix.json` preserves this initial snapshot; its cascade entry is superseded, other five geometries remain final.
- Final cascade-only rerun: `MARBLE_ENTRANCE_COURSE=cascade npx vitest run tests/games/marbleEntrances.test.ts`: **4 passed**, 46.66s. Geometry case still checks all six; simulations cover only cascade: 2/6/12 people ×10 seeds with replay, 30-seed observational sample, representative 30/60/120Hz equivalence, then 60-seed finite correlation gate. Final cascade matrix: `entrance-cascade-matrix.json`; min15.3083/max25.5792 simulated seconds.
- Final preservation: `npx vitest run tests/games/marbleCourseExpansion.test.ts -t 'preserves all downstream'`: **1 passed, 2 skipped**, 457ms. Pre-edit downstream hashes protect all six, and restored cascade matches its original full-course hash. No blindly regenerated original fixture.
- Relevant competition/native/roster suite: **3 files,26 passed**, 3.82s. No old marathon matrix repeated.
- Final touched ESLint and `npx tsc -b`: exit0, no output. JavaScript syntax/diff checks and final-source build are recorded below.

Geometry checks cover mirrored entry surfaces, unchanged 2/6/12/20-person spawn clearance, minimum58 free channels between separate connected boundaries, moving-arm envelopes and downstream clearance. Connected segments of one stepped wall are treated as one boundary rather than a fictional passage. Every simulation checks completion/rank order/nonfinite positions and velocities; no physics adjustments or rescue paths were introduced.

## Cascade investigation

The initial 30-seed sample was rho−0.2667, so it was investigated rather than dismissed. Same60 fixed seeds/6 people:

| Profile | rho | Outcome |
| --- | ---: | --- |
| Wide split | −0.29729198 | Rejected |
| Narrow split | −0.31619847 | Rejected |
| Mixing pegs plus split | −0.21803499 | Rejected; three-attempt loop stopped |
| Approved B shortened original collector plus split | −0.29588339 | Rejected; no further tuning |
| Original baseline and final restored cascade | −0.06060092406529045 | Finite, within abs0.20 investigation threshold; exact match |

Failed snapshots are retained in `entrance-cascade-investigation-{before,narrow,mixing,B}.json`. Original baseline is `entrance-cascade-baseline.json`, final is `entrance-cascade-investigation.json`. All attempts completed safely; rank sample regression alone motivated restoring the original cascade collector. The parent approved this fallback: since the other five now differ, there are still six distinct entrances.

Other five initial/final 30-seed observational rhos: pinball +0.023289, carousel +0.002629, zigzag −0.107368, bumper forest −0.103924, seesaw +0.043823; each finite. These bounded samples are regression evidence, not proof of fairness for all seeds/rosters. Signed correlation does not characterize every possible nonlinear or center-position dependence.

## Static geometry diagram

`entrance-geometry.json` is extracted from actual final courses and actual 12-person initial spawn. `python3 verifications/render-entrances.py` generates SVG/MVG/PNG using standard vector primitives and ImageMagick. Blue outlines are spawn, black strokes are wall radii, gray/orange circles are pegs/bumpers, orange arms are actual initial rotor/seesaw positions, dashed line is unchanged y496 handoff. `entrance-comparison.png` is a **geometry diagram, not live UI verification**. No browser, screenshot automation, production action, clipboard action, push or deployment was performed for this task. Previous browser approval expired.

Fresh read-only review accepted the initial downstream/safety implementation. Parent accepted visual differentiation and explicitly approved cascade fallback. Final targeted review follows the final source/docs snapshot. Six historical untracked live QA files are preserved and excluded from commits.

## Final build / syntax
- `npm run build`: exit0; Vite **built in2.25s**, prerender **184 pages /82 games**, HTML comment stripping **892 files /1410.0KB**. Existing build read-only SEO datasource was used; no play/room/browser writes.
- `node --check` parts.js/courses.js and root/games `git diff --check`: exit0.
- Built `dist/games/marble-race/js/{parts,courses}.js` are **byte-identical** to final source.
- Final targeted fresh read-only reviewer: **SHIP** after cascade fallback source/docs snapshot. Parent viewed final PNG with actual blue spawn/wall widths and accepted all six profiles.
