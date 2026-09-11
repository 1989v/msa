# Front scarf sculpt review

Reference: `../../../assets/character-props-board.png`; compared visually with `../../../verifications/t02b-3c-detail.png` before editing. No other game art or implementation was used.

The previous closed circumference loft created a symmetrical shoulder pad. It is replaced by two open curved cloth patches: a short diagonal front fold extending from the left brooch to a lower right shoulder tip, and a smaller gathered left shoulder triangle. Unequal top and free-edge control curves establish the silhouette; curved cross sections make the broad overlapping folds converge at the brooch. A narrower closed neck wrap and 3 mm returned hems complete the cloth. The brooch follows the new left anchor.

Only scarf/collar/brooch geometry changed. Face, hair, torso, sleeves, cape, strap route, rig and atlas remain as authored. Front and collar subdivisions were redistributed to provide the small shoulder patch within the existing budget: LOD0 **14,882 triangles**, LOD1 **5,000 triangles**, **19 bones**, **1024 px atlas**.

Verification: `node --test docs/specs/2026-09-10-skybound/implementation/t02b/character/tests/model.test.mjs` reports **6 passed, 0 failed**. The original shoulder/strap contact sample positions and all clearance limits were retained for both LODs and rest/inspection pose. Only the expected left shoulder surface name changed from `front-scarf-fold` to `scarf-shoulder-gather`, because that region now belongs to the small gathered patch. This preserves the previous shoulder-hole and exposed-strap bug paths.

Rendered GLB inspection remains with the main agent; numerical contact tests do not establish final art acceptance. Historical `model-report` was not edited.
