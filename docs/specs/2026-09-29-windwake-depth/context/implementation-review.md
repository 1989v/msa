<!-- source: windwake/village.mjs -->
<!-- source: windwake/sim.mjs -->
# Independent implementation review

Fresh reviewer depth_review found two P2 defects: simultaneous artisans spending on a structure repaired by the preceding worker, and pre-expansion snapshots lacking new produce/items fields. Both reproduced before fixes. Workers now reacquire live targets before consumption; restoreSnapshot validates only the added community fields while preserving active scene, actor, raid, plot and cooldown transients. Farmers also retain ready timers when no dry plot remains.

Regression evidence: four new cases initially failed; after correction focused suite63/63 passed. Reviewer independently reran original reproductions and34 tests, returning SHIP. Fresh verdict agent depth_verdict accepted both findings/fixes and independently ran54 tests, all PASS. No remaining required findings.

Visual review found overly regular cave tiles and overlapping coplanar room floors. Cave surfaces now use rock facets and nonoverlapping floor wings with the same collision union. Cave route/save suite5/5 passes after this correction. Attack telegraphs no longer return before rendering enemy health bars. Attack impact arcs use the same serialized geometry as damage.
