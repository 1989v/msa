# Domain review — round 1

Verdict: **REVISE**. No bounded-context or framework-dependency blocker.

Seed discovery: reviewed spec and context contracts; root AGENTS.md and agent-behavior standard; existing simulation progression/save/death paths; previous WINDWAKE spec local terminology; platform context map. There are no docs/checks/common.md, docs/checks/windwake.md or windwake-local AGENTS/CLAUDE files.

## Findings

1. **Raid persistence needs a state invariant, not only a wave index.** SR-5 promises durable raids and once-only rewards (`spec.md:42–45`), but the proposed schema only sketches status/day/wave (`context/key-decisions.md:23`). Existing `windwake/sim.mjs:350` respawns through export/load and `windwake/sim.mjs:358` omits transient enemies. If an active raid reloads with its wave marked spawned and no enemies, it can clear for free; resetting the wave can repeat enemy rewards. Specify idle→queued→active→won/lost, one stable raid ID per day, a persisted remaining enemy roster and claimed reward marker. Death should resolve failure once or resume the same roster; save/load must not manufacture an empty completed wave.

2. **Skill points require a canonical source on load.** SR-2 (`spec.md:23`) requires no duplicate/negative rewards while the save contract stores XP, level, points and learned nodes independently (`context/key-decisions.md:18`). Derive level/earned points from bounded XP and available points from valid prerequisite-closed learned nodes and their costs. Reject or normalize over-budget learned sets and unlearned/duplicate equipped abilities. This mirrors the existing derived glider/stamina normalization in `windwake/sim.mjs:366–369`.

3. **The introduced gameplay vocabulary lacks a local glossary.** The platform map (`docs/context-map.md:14`) does not include this standalone game; previous WINDWAKE work deliberately uses a local vocabulary section (`docs/specs/2026-09-18-windwake/spec.md:55`). Extend that precedent here for activated waypoint, skill node, material, seed, crop plot, reputation, village level, queued/active raid and beacon. Define “established village” (`spec.md:42`) as a measurable trigger and distinguish permanent progression from repairable structure health. No conflicting platform glossary meaning found.

## Positive checks

- Progression and village remain pure serializable gameplay state; no commerce-domain integration or framework dependency is introduced.
- Authored IDs, deterministic clocks, bounded collections and first-clear reward uniqueness are explicit.
- Crop harvest and construction transactions are required to validate costs/range at the domain entry point rather than trusting menus.

## Suggested acceptance evidence

- Saving/reloading at each raid transition preserves remaining combat and rewards; death during a wave cannot replay paid rewards.
- Malformed XP/points/learned/equipped combinations normalize to affordable prerequisite-closed state.
- Harvest→repeat harvest grants once; seed replenishment and zero-resource recovery remain reachable.
