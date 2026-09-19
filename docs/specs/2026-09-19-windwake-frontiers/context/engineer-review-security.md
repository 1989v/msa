# Security spec review

Verdict: **SHIP**. Scope: specification review; implementation and runtime verification remain pending.

## Evidence and threat scope

Seed discovery covered `spec.md`, `tasks.md`, `context/key-decisions.md`, `planning/test-quality.md`, the existing simulation/save/UI/test code and `docs/standards/agent-behavior.md`. No windwake-specific scar list or configured `HNS_KB_PATH` was found. The security checklist was applied independently from the test-strategy review.

- **Actor/boundary:** this is a local single-player static game. Multiplayer/economy and server connectivity are excluded (`spec.md:45`, `spec.md:61`). The player controls their browser and its deterministic debug API; preventing deliberate self-cheating is not an authentication requirement.
- **Tampering/input validation:** v2 saves must bound arrays, coordinates, values and IDs (`spec.md:49`). Village actions validate range, placement and costs in the simulation rather than trusting the UI (`context/key-decisions.md`, Pure village interface). Existing `loadSave` already allowlists sigils/chests and normalizes upgrades, checkpoints and metrics (`windwake/sim.mjs:359`). New object maps such as durable defeat IDs must receive the same treatment before downstream iteration.
- **Reward replay:** duplicate skill, harvest, boss and raid rewards are explicitly forbidden (`spec.md:23`, `spec.md:30`, `spec.md:37`, `spec.md:44`). Raid/day state persists, and unresolved raids cannot roll into a new day (`spec.md:43`). These are suitable contracts for implementation and adversarial integration tests.
- **Local resource exhaustion:** bounded chunks, enemies, effects/projectiles and normalized saves are specified (`spec.md:18`, `spec.md:19`, `spec.md:49`). Contract caps are CPU96/GPU64 chunks,64 active enemies,32 structures and16 plots.
- **XSS:** current enemy and status labels use `textContent`, while HTML panels interpolate local authored definitions and normalized numeric state (`windwake/main.mjs:145`, `windwake/main.mjs:177`). Maintain this boundary for new names/IDs from saved state; map saved IDs back to authored definitions before building markup.
- **Spoofing, repudiation, privilege escalation, sensitive data, cryptography and service authentication:** no new identity, payment, token, external API or secret flow is introduced. These checklist categories are not applicable to the proposed local gameplay feature.

No security requirement revision is necessary. Implementation review must verify the specified bounds and reward invariants rather than treating this spec verdict as evidence that the code is secure.
