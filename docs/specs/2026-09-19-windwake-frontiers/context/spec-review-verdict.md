# Independent spec review verdict

Overall: **SHIP**. Both worker contracts are now frozen and their final consistency corrections were independently re-read. No BLOCK and no additional user approval gate. The expansion is authorized. This adjudication reads all six original reviewer reports, revised spec/contracts/tasks/test plan, both worker contracts, the review protocol, and referenced collision/map/save consumers. Runtime files are unchanged by this review; no runtime tests were run or claimed.

The original validity of all12 findings is upheld; none is rejected. The author added a final acceptance addendum and worker schemas during adjudication. Their residual severity is now reduced to implementation checks because the cited omissions have been corrected. The life contract now matches cottage+first completed harvest and free seed recovery whenever no seeds/planted crops remain (lines79 and65). The world contract supplies explicit eight-region physical TRAIL_ROUTES and the agreed preload/build/metric contract.

```json
[
  {
    "id": "architecture-1",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"context/key-decisions.md","line":33,"quote":"querySolids deduplicates by stable ID and includes cross-boundary extents."},{"file":"context/world-contract.md","line":45,"quote":"Original PROPS/SOLIDS remain a finite legacy center set."}],
    "reason": "Evidence type c: overlap, bounded queries, stable identity and original-only exports are now explicit; verify boundary equivalence during implementation."
  },
  {
    "id": "architecture-2",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"context/life-contract.md","line":39,"quote":"Growth is seconds; watered seeds grow without further watering."},{"file":"context/world-contract.md","line":50,"quote":"Missing new state renders old fixtures in daylight."},{"file":"context/life-contract.md","line":41,"quote":"Structures {id,type,x,y,z,facing,hp,maxHp,cooldown:0}"}],
    "reason": "Evidence type c: frozen worker contracts now name shared resource/boss/building IDs, schemas, crop stages and clock conversion, with consistent life-rule semantics."
  },
  {
    "id": "domain-1",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"context/key-decisions.md","line":30,"quote":"Persist wave number plus current surviving wave snapshots"},{"file":"spec.md","line":45,"quote":"reload/death restores the encounter without reissuing cleared-wave rewards"}],
    "reason": "Evidence type c: the revised text now specifies durable lifecycle, day identity, survivors and reload/death semantics; retain implementation checks for reward markers and transient reconciliation."
  },
  {
    "id": "domain-2",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"context/key-decisions.md","line":22,"quote":"admitting only affordable known nodes with learned prerequisites; ignore supplied raw points/level"}],
    "reason": "Evidence type c: the current contract makes bounded XP and prerequisite-closed affordable nodes authoritative; verify duplicate/unknown equipped IDs in the save normalization cases."
  },
  {
    "id": "domain-3",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"spec.md","line":67,"quote":"## Local Gameplay Terms"},{"file":"spec.md","line":42,"quote":"After a cottage and the first completed harvest establish the village"},{"file":"spec.md","line":44,"quote":"Failure damages repairable structures and beacon without deleting learned skills"}],
    "reason": "Evidence type c: the local vocabulary, measurable establishment trigger and permanent-versus-repairable distinction now exist; workers can complete content vocabulary alongside their definitions."
  },
  {
    "id": "implementation-1",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"context/key-decisions.md","line":34,"quote":"Renderer builds at most2 new chunks per frame after a bounded3×3 initial neighborhood."},{"file":"context/world-contract.md","line":49,"quote":"Chunk eviction deletes WebGL buffers."},{"file":"planning/test-quality.md","line":11,"quote":"resident-byte/triangle/disposal observations"}],
    "reason": "Evidence type c: numeric construction budget, tile priority, resident metrics and disposal observations now supplement rendered residency limits; actual measurements remain a delivery gate."
  },
  {
    "id": "implementation-2",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"context/key-decisions.md","line":35,"quote":"sim movement/vertical support, cover/LOS, projectiles, moving stone and player/enemy knockback"},{"file":"context/life-contract.md","line":54,"quote":"root includes them in player collision and cover"}],
    "reason": "Evidence type c: the acceptance addendum now enumerates collision consumers, camera segment and WORLD.size-aware fixed-raster map migration; village solids have explicit integration ownership."
  },
  {
    "id": "implementation-3",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"context/key-decisions.md","line":36,"quote":"Physical base-character travel lanes from center to all8 outer waypoint approaches are required."},{"file":"context/world-contract.md","line":38,"quote":"eight radial trails to region centers, waypoints and arenas"}],
    "reason": "Evidence type c: all-eight physical route acceptance, sampled grade/clearance and connected arena approaches now appear in the plan; successful movement must still be demonstrated."
  },
  {
    "id": "test-strategy-1",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"planning/test-quality.md","line":5,"quote":"deterministic generation and exact64× area"},{"file":"spec.md","line":15,"quote":"World bounds are ±960m on X/Z:1920²/240²=64× original area."}],
    "reason": "Evidence type c: the weaker ≥50× assertion has been replaced by exact64×; implement the explicit size/area assertion and independent authored-count assertions."
  },
  {
    "id": "test-strategy-2",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"planning/test-quality.md","line":11,"quote":"queued/active/between-wave/won/lost reload and death"},{"file":"context/key-decisions.md","line":37,"quote":"missing/null/unknown/oversized IDs, NaN/Infinity/negative values"},{"file":"context/key-decisions.md","line":38,"quote":"Publishing/deployed-test runtime allowlists include every added module"}],
    "reason": "Evidence type c: the added matrix closes persistence checkpoints, malformed input, atlas-render workload and release coverage while retaining natural-route/fixture separation; execution is still pending."
  },
  {
    "id": "usecase-1",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"spec.md","line":20,"quote":"A distant queued raid explicitly permits travel home."},{"file":"context/key-decisions.md","line":30,"quote":"queued allows home fast travel, active blocks it"}],
    "reason": "Evidence type c: the revised travel contract distinguishes queued from active raids and requires safe arrival and a rejection reason; the conflicting blanket prohibition is resolved."
  },
  {
    "id": "usecase-2",
    "verdict": "demote",
    "severity": "MINOR",
    "evidence": [{"file":"spec.md","line":42,"quote":"After a cottage and the first completed harvest establish the village"},{"file":"context/key-decisions.md","line":39,"quote":"Planted-plot removal returns exactly its seed, no crop yield."},{"file":"context/life-contract.md","line":37,"quote":"materials {wood:48,stone:30,food:6}"}],
    "reason": "Evidence type c: first-harvest gating, refund/recovery semantics and executable starter costs resolve the user journey; life-contract lines65/79 now agree with the revised spec."
  }
]
```

| Reviewer | Revised verdict | Remaining issues |
|---|---|---|
| Architecture | SHIP | Worker schemas frozen and checked |
| Domain | SHIP | Resolved requirements retained as implementation checks |
| Implementation | SHIP | Acceptance addendum resolves the planning omissions |
| Security | SHIP | No findings submitted |
| Test strategy | SHIP | Added acceptance matrix must be executed |
| Use case | SHIP | Frozen first-harvest/recovery semantics agree |

Action: proceed with the owned implementation tasks. The complete original findings remain implementation review/verification inputs. This is a specification gate, not a claim about implemented behavior or measured performance.

SUMMARY: keep 0 / demote 12 / dismiss 0. Original validity upheld12; rejected0; residual specification revisions0.
