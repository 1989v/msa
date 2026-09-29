<!-- source: windwake/world.mjs -->
<!-- source: windwake/caves.mjs -->
<!-- source: windwake/village.mjs -->
# Scoped crosscheck

| Contract | Result | Implementation/evidence |
|---|---|---|
| SR1 terrain loops | PASS | EXPEDITIONS, shared world height,69.43m ascent/36m descent, grade tests and ordinary return routes |
| SR2 caves | PASS | caves.mjs, local scenes4+2, branching treasure,12m height difference, puzzles/guardians/crafting unlocks, fresh routes |
| SR3 tactics | PASS | serialized attackSpec, locked tell/damage geometry, wolf coordination/caster spacing; basic-control regression |
| SR4 life/defense | PASS | typed crops/3recipes/10buildings/resident capacity/jobs/raid roles, atomic action and save-proof tests |
| SR5 presentation | PASS |8town layouts/24regional props, cave/trail atlas, residents/tools, distinct tells and health bars |
| SR6 release | PASS | Local244tests,20public module hashes, core/frontier/depth Chrome paths and console0 |

No Kotlin/service/database changes in this slice. Existing local-scene architecture retained, so no new architecture decision is required. README/DESIGN and reusable terrain standard updated to actual implementation. Runtime manifests include the only new runtime module, caves.mjs. Source comments link new docs to implemented code. User deferred hardware and loading improvement work; browser correctness remains required and verified.
