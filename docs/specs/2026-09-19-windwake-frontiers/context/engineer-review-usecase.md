# Usecase review — round 1

Verdict: **REVISE**. Actor goals and measurable content targets are clear; two player-facing exception flows need decisions before implementation.

Seed discovery: reviewed spec/context, original WINDWAKE spec and simulation, natural route and save regression evidence. Missing docs/checks files were treated as no recorded scars.

## Findings

1. **Distant queued raids need a usable return action.** SR-1 blocks travel during “raid” (`spec.md:20`) while SR-5 queues distant raids until the player returns and promises return guidance (`spec.md:42–43`). On a 1920m world, applying the blanket block to queued raids forces a long return walk and stalls the day. Define travel restriction as active combat/active raid, allow a queued raid's home destination, and begin the encounter only after safe arrival. If walk-only return is intended, explicitly state it and test the distant novice journey. Existing `windwake/sim.mjs:353` has a Boolean-only travel result; new UI must expose why a rejected travel failed.

2. **The first village loop needs costs and failure recovery as an executable acceptance route.** SR-4 requires modest starter supplies, renewable gathering and a teaching sequence (`spec.md:35–39`), but there is no precise raid trigger or end-to-end resource budget. Record a fresh-game route: reach home → gather → place plot/defense → sow → water free of consumable cost → harvest → replenish seeds/use food → receive dusk warning → defend or fail → freely repair beacon and continue. Specify when raids unlock and ensure the first raid cannot precede the promised introduction. Failed/removed crops must not exhaust all seed acquisition paths. `context/key-decisions.md:24–26` defines actions and free recovery but does not yet pin these postconditions.

## Required exception coverage

- Occupied/out-of-bounds/unaffordable build leaves inventory and placement unchanged; removal of planted plots has a declared refund/seed policy.
- Already-learned/unaffordable/locked skill and invalid equip slot expose the requirement without spending points.
- Pause, distant travel, active-raid save/reload, lethal combat and loss all preserve earned permanent progress.
- Mobile users can place a visible world-cell preview, cancel placement, water/harvest, choose slots and return home through accessible controls.

## Test mapping

- Pure Node fixtures: skill economy, transaction atomicity, seed/growth/harvest rules, raid transition and persistence invariants.
- Input-only fresh-game route: introductory village progression and natural waypoint approach; report any accelerated clocks/fixture combat separately.
- Real Chrome keyboard/mouse/touch: skill selection, village actions, paused menus, rejected travel reason, save/reload and dusk/raid return guidance.
