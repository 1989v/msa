# Usecase review — round 1

Verdict: **SHIP** (round 2)

Re-review: SR-1.3 explicitly chooses the fixed ten-kind pool, with no unlock or roster-selection flow. U-1 is resolved. Test-quality now maps all SR groups to actions and observable results. Original finding below is retained as review history.

Reviewed `spec.md`, `tasks.md`, planning requirements/test-quality, DESIGN, context decisions, and the online lobby standard. Actors and primary goals are clear: solo player with AI, and two cooperative players. Costs, ownership, invalid-command atomicity, defeat, asset-load retry, save-version failure, and disconnection have explicit alternative or exception behavior. The approved raster image is the visual source of truth.

## U-1 — Close the selected-roster preparation flow

- Check 2/3/4 (alternative flows, preconditions, traceable acceptance).
- Intent: the player must be able to prepare a valid roster, then summon from it without differing solo/online rules.
- Evidence: `spec.md:15` promises summoning from the selected roster; `spec.md:21` introduces ten unit types; `spec.md:31` includes preparation. `planning/requirements.md:27` leaves roster size undecided and `:32` says roster size/unlocks will be resolved by the implementation specification. The current spec does not resolve them. `docs/standards/online-versus-lobby.md:43` requires lobby selections to be shared and immutable during a match.
- Fix: choose an implementation default without another user approval (e.g. all ten unlocked, select a fixed-size roster, a valid default roster supplied); specify minimum/maximum roster size, duplicate/empty rejection, when it locks, AI roster, and what the opponent sees. If no roster editor is intended, state explicitly that the initial roster is fixed to all ten and remove the promise of selecting one.
- Verify: start solo and code-room play with the default roster; test empty/invalid selection if editable; verify only roster members can be summoned and that changing preparation cannot alter an active round.

## Acceptance mapping

| Use case | Existing verification target |
|---|---|
| Solo start, summon/merge, bosses, win/loss, restart | `tasks.md` group 2 core + group 5 natural-play verification; `planning/test-quality.md:13` |
| Invalid actions preserve resources and ownership | core tests; `planning/test-quality.md:8` and `:12` |
| Five online entry routes, partner commands, continuation | network tests + two-browser E2E; `planning/test-quality.md:10`–`:14` |
| View weapon actions and enemy movement | asset gallery + visual observation in task groups 1/3/5 |
| Touch controls preserve game coordinates | component/browser checks; `planning/test-quality.md:15` |

The relay exceptions identified in the implementation review must also be reflected in online usecase expectations. No implementation or test pass is claimed.
