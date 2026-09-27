<!-- source: windwake/world.mjs -->
<!-- source: windwake/sim.mjs -->
<!-- source: windwake/render.mjs -->
# Tasks

User authorizes implementation; no redundant approval gate. Existing ADR-0096/0097 apply.

1. World/terrain (independent): focused noise/triangle/seam/relief/route/placement tests; reusable pure generator, world integration, encounter density, reusable standard. Verify `node --test windwake/tests/terrain.test.mjs windwake/tests/world.test.mjs`.
2. Simulation/combat (independent; integrate world admission contract): timeline/held combo, ordinary defensive advantage, streaming saturation/persistence, near-landing buffer, regression tests. Verify targeted combat/simulation tests and ordinary routes.
3. Renderer/camera (root; consumes attack timeline): three distinct poses/trails, restricted canopy cutout and safe damped recovery; numerical and Chrome visual verification.
4. Integration (depends 1–3): full suite, natural routes, targeted actual keyboard/forest/terrain play, bounded performance. Independent L3 review and corrections.
5. Publish (depends 4): scoped commit, isolated release preserving unrelated changes, runtime manifest and deployment, exact public bytes and gameplay. Record final evidence.

## Verification status

Tasks 1–4 complete: full suite 203/203, local Chrome and independent implementation review SHIP. Near-actor admission and core seam corrected after review. Task 5 in progress; public release evidence will be recorded separately.
