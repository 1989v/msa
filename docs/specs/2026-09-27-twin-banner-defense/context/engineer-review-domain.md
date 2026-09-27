# Domain review — REVISE

## Round 2 — SHIP (2026-09-27)

Re-read amended SR-1.3 and Vocabulary. Fixed ten-type unlocked summon pool removes the unresolved selected-formation flow (D1); local vocabulary explicitly distinguishes individual grade from seat-wide type upgrades (D2). Both findings resolved.

Date: 2026-09-27. Scope: isolated new cooperative game domain.

## Evidence and discovery

- Seed and companions: `spec.md`, `tasks.md`, `planning/requirements.md`, `context/key-decisions.md`, `context/open-questions.yml`, `context/progress.md`.
- Language reference: hns `references/language-reference.md`; project context index: `docs/context-map.md:16`–`33`.
- Integration: `GameRelayRegistry.kt` confirms transport seat ownership and independent round lifecycle. No other game code inspected.
- Seat-owned resources/placements, shared gate, legal merges, maximum grade, and rejection without spending are explicit (`spec.md:13`–`18`). AI shares the same rules (`spec.md:30`). No commerce aggregate or database reference enters this game.

## D1 — Resolve what “selected formation” contains

**REVISE.** `docs/specs/2026-09-27-twin-banner-defense/spec.md:15` summons randomly from a selected formation, but no formation size, initial selection, or selection flow is specified. The previous shaping document explicitly defers formation size and unlock policy to implementation spec (`planning/requirements.md:27`, `planning/requirements.md:32`). This affects summon validity, reproducibility, and lobby synchronization, not just balance.

**Fix:** Choose and state an implementation default. A minimal version can use a fixed pool of all ten unlocked types for both seats, replacing “selected formation”; if selection remains, define its allowed size, when it locks, and how the host validates each seat's pool. No user reapproval is needed for this routine default.

## D2 — Record the new game's vocabulary locally

**REVISE, documentation only.** There is no root `docs/product/glossary.md`; the multi-context map (`docs/context-map.md:16`–`33`) has no game vocabulary. The new nouns and distinct operations in `spec.md:13`–`18`—군량, 편성, 합성, 등급, 병종 강화, 지원—therefore have no glossary entry. In particular, grade gained by merging should remain distinct from type-wide upgrades.

**Fix:** Add a short game-local vocabulary section/file and link it from this spec (or flag these new terms explicitly for the later glossary workflow). Define seat, shared gate, resource, summon pool, unit grade, merge, type upgrade and transfer; add `Avoid: —` where no deprecated synonym exists. Do not expand this into a platform-wide glossary rewrite.

## Verdict

REVISE for D1 and D2. No existing glossary meaning conflict or deprecated synonym was found; no BLOCK finding.
