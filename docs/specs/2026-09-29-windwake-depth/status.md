<!-- source: windwake/tests/depth-browser.mjs -->
<!-- source: windwake/tests/community-save.test.mjs -->
# Verification — 2026-09-29

| Step | Result | Evidence |
|---|---|---|
| Standards | PASS | ADR0096/0097, shared floorSurface, named palette, additive v3 fields; independent SHIP |
| Syntax | PASS | node --check on changed runtime/test modules; no framework/build dependency |
| Runtime packaging | PASS | publish/deployed manifests agree on20 existing files including caves.mjs; published exact20file hash verification PASS |
| Tests | PASS | Full244 tests /244 pass /0 fail; both required review reproductions fixed |
| Browser | PASS | Chrome2freshcaves+2expeditions+connected cave/craft loop, actual W/Space, console0 |
| Regression | PASS | Existing8town16quest4dungeon continuous journey11,491m/falls0, save continuation; combo1→2→3, foliage pixel change58,169, orbit, physical18.514mhill |
| Deployment | PASS | workflow36568301886 success; portal0dd5c10 ready;20exact public hashes; core/frontier/depth Chrome pass, console0 |

Evidence directories separate first runs and reruns. The first controls harness attempt under concurrent Chrome tests moved and jumped but missed its fixed650ms distance threshold (z=-70.268 vs >-70); unchanged isolated retry passed. No runtime weakening. These short local software-rendered checks do not establish cold-load or mobile performance guarantees.
