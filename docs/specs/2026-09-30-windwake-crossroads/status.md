<!-- source: windwake/tests/crossroads-browser.mjs -->
<!-- source: windwake/tests/crossroads-integration.test.mjs -->
# Crossroads verification — 2026-09-30

| Gate | Result | Evidence |
|---|---|---|
| Scope/standards | PASS | No dependency/build/backend changes; ADR0096/0097 static local scenes; original palette; basic attack control unchanged |
| Syntax/diff | PASS | Node syntax checks; scoped git diff --check |
| Full Node suite | PASS | `node --test windwake/tests/*.test.mjs`:282 tests,282 pass,0 fail,11.39s |
| Groups1–3 | PASS | Full suite contains corridor/terrain/world/geography, ruins/classic/caves, relic/journey/sim suites |
| World identity | PASS | Surviving legacy IDs/type/XZ compared against23,966 pre-edit tuples; new reservations cannot resurrect old suppressed slots |
| Progression | PASS | Four fresh real guard-kill/cache/reload/revisit routes; both fresh ruins with and without optional rewards; combined2,124m route with equip/return/reload |
| Chrome first pass | PASS | Trusted keyboard jump/mouse orbit; four bidirectional corridors; two fresh ruins; combined route;0 console errors |
| Independent review | SHIP | Fixed nested corridorId defect; new real-stream40/64 admission tests pass; no other blocking findings |
| Chrome visual improvement | PASS | local-reviewed/report.json:4roundtrips,4fresh guard-cache combats,2fresh ruins,combined route;0errors. Screenshots inspected:bright canopy,coastal timer,road relief,altitude map |
| Public delivery | PASS | Workflow36729210095 success;21/21 hashes match; public-core and public-crossroads Chrome PASS,each0errors;portal ready1 |

No Java/portal TypeScript code changed. Standalone vanilla modules run directly without a build system. Hardware/mobile loading optimization remains deferred by user priority.

Corrections: generic legacy chest test now names its original expedition chest; required corridor metadata moved to top-level streamed actor shape; actual streaming tests supplement direct-spawn tests. Timer failure/retry/completion now emit procedural audio events. Initial sandboxed Chrome launch was blocked; approved unsandboxed dedicated test profile launched successfully.
