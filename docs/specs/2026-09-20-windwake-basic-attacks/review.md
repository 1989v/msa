<!-- source: windwake/sim.mjs -->
<!-- source: windwake/main.mjs -->
<!-- source: windwake/tests/basic-attacks.test.mjs -->

# Independent implementation review

Date: 2026-09-20. Verdict: **SHIP** for the reviewed source diff. No actionable correctness findings.

Scope: current changes in `windwake/sim.mjs`, `windwake/main.mjs`, and the new `windwake/tests/basic-attacks.test.mjs`, reviewed against [the approved behavior](spec.md#L8) and [agent review standards](../../standards/agent-behavior.md). Review used the current sources and an independently executed test run; no implementation history was supplied.

## Contract checks

- Sword combos and ordinary airborne plunge both reach the shared damage function with their explicit attack kinds ([sword](../../../windwake/sim.mjs#L369), [plunge](../../../windwake/sim.mjs#L405)). The `controlHit` gate excludes these kinds from velocity replacement and stagger state/timer/poise reset while keeping lethal state transition and reward handling ([damage path](../../../windwake/sim.mjs#L128)). A pre-existing stagger therefore expires through its original AI timer, rather than being refreshed or shortened by a sword hit.
- Basic hit events explicitly carry `hitStop: false`; other damage kinds carry `true` ([event emission](../../../windwake/sim.mjs#L143)). The browser consumes the flag only when assigning the global pause, retaining audio, event history, and camera shake ([event processing](../../../windwake/main.mjs#L157)). An existing skill-induced pause is neither cleared nor refreshed by a subsequent basic hit. The real-time loop remains unchanged ([frame loop](../../../windwake/main.mjs#L264)).
- Armor calculation, HP loss, hit flash/effect, hit metrics, energy reward, and death rewards stay in the common path. Pulse still accumulates boss poise and triggers its existing threshold; parry and all other existing control kinds still use the original velocity/stagger logic ([combat resolution](../../../windwake/sim.mjs#L131)). Range, cover, height, and combo timing call sites are unchanged.
- The new tests cover all three combo impacts followed by the pending enemy attack, active charge movement across legacy/expanded/dungeon actors, a pre-existing stagger and poise, plunge, single lethal reward, and pulse/parry control ([regressions](../../../windwake/tests/basic-attacks.test.mjs#L14)). Existing tests were not weakened or removed.

## Independent verification

Command: `node --test windwake/tests/*.test.mjs`

```text
1..177
# tests 177
# pass 177
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3971.03275
```

This includes the eight new basic-attack cases, existing boss-poise regression, and existing natural dungeon-route tests. `node --check windwake/main.mjs` and `git diff --check -- windwake/sim.mjs windwake/main.mjs` also exited 0.

This verdict covers implementation review. Real Chrome trusted input, the separately invoked route scripts, publication, and exact deployed-byte/combat checks were not executed by this reviewer and remain the implementing session's verification responsibilities under the spec.
