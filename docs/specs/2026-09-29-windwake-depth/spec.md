<!-- source: windwake/world.mjs -->
<!-- source: windwake/combat.mjs -->
<!-- source: windwake/dungeons.mjs -->
<!-- source: windwake/village.mjs -->
# Specification: WINDWAKE — 산길과 삶

## Goal
Make the existing world worth traversing through recognizable mountains/valleys, physical natural caves, distinct settlements, tactical combat and a farming/resident/crafting/defense loop. User explicitly prioritizes content over cold-start optimization and device benchmarking; normal functional regression and Chrome play remain required.

## User Stories
- As an explorer, I can see and climb a mountain, descend into a valley, enter a cave and earn useful rewards along connected routes.
- As a fighter, I read committed attack geometry and choose movement, dodge, parry or control instead of only holding attack.
- As a villager, I choose crops for recipes, invite regional allies and assign real jobs, then prepare defenses for readable raids.

## Specific Requirements
### SR-1: Mountain and valley routes
- Add two named optional outdoor branch loops, alpine summit and canyon valley, connected to existing waypoint/town approaches. Each provides clues, intermediate discovery and one durable reward; legacy mandatory routes remain reachable.
- Alpine trail rises at least 55m from branch start; canyon trail descends at least 25m and returns by an alternate branch. Clear silhouettes, exposed rock and visible path markers communicate those shapes. Do not represent these as isolated teleport destinations.
- New routes have measured one-metre grade <=0.8, no unintended water/solid blockers, and an ordinary directional-input round trip without teleport/fall recovery. Preserve shared 3m render/collision triangles and core seam limits from game-terrain-generation.md.
- Additive generation must preserve surviving legacy ID→type/XZ meaning; new exclusions apply after legacy random draws. Existing core puzzles, protected pads and 8-town routes remain valid.
### SR-2: Actual natural caves
- Add two optional local cave scenes with physical world entrances connected to the new canyon branch and mistwood settlement. Existing four dungeon layouts and durable IDs remain intact. This extends ADR-0097; outdoor heightfield does not pretend to support underground layers.
- Each cave has >=4 connected spaces, enclosed rock corridors/ceiling/columns, branching side treasure and >=8m traversable height difference using slopes/ledges. Camera uses shared collision geometry. Floor slope rendering and collision share the same height rule.
- One cave uses a wind-pushed weight puzzle, the other a multi-level relay route; each includes a guarded final objective. Cues in the world explain solutions, reset is possible, optional treasure and completion reward cannot be duplicated.
- Entry, descent, puzzle, fight, optional reward, return to correct world entrance and save/reload are verified through ordinary movement/actions after an explicit test start. At least one connected approach begins at an existing visited waypoint/town without coordinate edits.
- Cave clears provide crafting access in addition to ordinary materials/XP. Active cave saves restore at safe entry with durable progress preserved; scene-local transient actors never leak into world.
### SR-3: Tactical combat
- Wolves use stable-ID coordinated flank/commit decisions; same-floor nearby packs visibly distribute positions, limit simultaneous committed attacks, eventually rotate attackers, and do not coordinate through blockers or across scenes.
- Shaman maintains useful distance; sentinel can screen a nearby caster while respecting collision/cover. Existing stats need not increase.
- Boss family signatures produce different correct responses: bulwark committed follow-up, tempest gapped locked lanes, thorn fixed eruption zones, tide jumpable wave/safe sector. Keep tells >=0.45s, recovery punish windows, bounded summons and one-hit-per-attack contacts.
- Serializable attack geometry is authoritative for both tells and damage/projectiles. Expanded ranged attacks do not re-aim after a locked tell; visible lane count matches fired count. Skills/parries can still interrupt; basic sword/plunge never stagger, knock back or hit-stop enemies.
- Deterministic fixtures demonstrate standing damage vs an appropriate spatial/timing response for signatures, plus unchanged natural boss routes and normal-HP defensive advantage regression.
### SR-4: Farming, residents, crafting, defense
- Preserve 4 crops and existing food/seed yields; add typed produce so crops have different recipe uses. Add kitchen/workshop and >=3 recipes with usable effects (expedition supplies, repair/improvement, cultivation). Unlocks derive from validated regional alliance/cave facts; at least one useful recipe is available early.
- Invite named allied regional residents, with one resident per intact cottage, maximum eight residents. Active workers are selected in stable catalog-ID order up to current capacity; excess residents retain their assignments but pause timers/effects until repaired housing restores capacity. Assign farmer/artisan/guard jobs with actual effects: watering, material-funded repair and defensive assistance. Work follows simulation time, pauses where village simulation pauses, cannot duplicate rewards across save/reload, and pauses with no intact housing.
- Typed produce is a separate per-crop inventory added alongside legacy food/seed rewards. A cave completion proof is validated claimed progress backed by required encounter/puzzle facts, never a free client flag. Resident eligibility derives from validated regional alliance proofs; recipe eligibility derives from their explicitly named alliance/cave proof. Housing capacity counts intact cottage structures, one slot each.
- Recipe/assignment/invite actions validate location, unlock, capacity, resources and IDs before atomic mutation. Bounded saved counters/inventory/timers; old saves receive safe empty defaults, no retroactive duplicate crop rewards. Revalidate resident eligibility after restored regional/cave proofs.
- Raids differentiate wolf flanking, charger structure pressure and other targeting roles, with next-raid direction/composition communicated before night. Preserve two waves, stable 3+4 actor identities, offscreen pause, blocking fences, active-raid save and exactly-once reward.
- UI exposes crop produce, recipe cost/unlock/effect, invite eligibility, housing/jobs and raid forecast. Physical residents/tools and different kitchen/workshop models show the work in-world.
### SR-5: Settlements and presentation
- Existing 8 towns retain guide/merchant/keeper IDs and 16 quest proofs, but gain layout and local props matching their roles (harbor, mill, market, orchard, mountain lodge, herbalist, forge, observatory). Required NPC access remains clear, building collision matches visible blocking geometry.
- Town dialogs explain resident/recipe unlocks and point toward nearby expeditions/caves. Map/journal mark named routes/cave entrances and completion so rewards motivate subsequent travel.
- Maintain bright low-poly art, named palette tokens, keyboard focus and existing touch controls. New module files explicitly included in publish manifest.
### SR-6: Verification and delivery
- New focused domain tests, complete existing suite, old core/frontier/8-town/4-dungeon routes and new outdoor/cave/life paths. Preserve failing evidence and fix causes; no weakened safety/gameplay assertions to force passage.
- At least one integrated ordinary-action acceptance path completes a cave, returns home, harvests required produce, crafts and uses the newly unlocked item, then saves/reloads to verify consumed resources, persistent unlock and effect without duplicate awards. Initial fixture seeding, if used, is declared and cannot grant the cave clear, recipe output or final reward.
- Actual Chrome input plus rendered captures at summit, valley, cave levels, settlement, resident activity and new combat tells. Check console and bounded actor/geometry contracts. No broad device/long-run performance project in this slice.
- Independent implementation review, scoped commits preserving unrelated work, existing authorized deployment and exact public runtime verification. Cold-start and hardware/mobile benchmarking remain explicitly deferred by user.

## Visual Design
Use windwake/DESIGN.md palette and existing procedural mesh language. Mountain paths turn with terrain; caves read as rock shells with irregular profiles and warm lamps, not recolored identical square rooms. Settlement styles change silhouettes/props and layout. Combat geometry must be readable by shape, not color alone.

## Existing Code to Leverage
world.mjs seeded terrain and protected routes; terrain.mjs shared triangles; dungeons.mjs scene/proof/geometry domain; combat.mjs hooks; village.mjs transactional actions and persistent raid; settlements/journey UI existing ally proofs; render.mjs meshes/camera; tests ordinary-input routes.

## Out of Scope
New engine/backend, overworld underground voxels, offline progression, multiplayer, wholesale original campaign rewrite, new graphics assets, cold-load optimization, hardware/mobile performance campaign. No Higgsfield.

## Open Questions
None pre-implementation. User explicitly authorizes decisions and implementation; retain prior deployment scope. Existing ADR-0096/0097 apply; additive save fields remain version3 with validators.
