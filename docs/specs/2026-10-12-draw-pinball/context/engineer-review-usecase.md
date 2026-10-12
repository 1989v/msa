# Usecase review — SHIP (round 2)

Read-only review; two nonblocking contract clarifications, no implementation or UI automation.

## Round 2 disposition

Retained amendments reviewed in `docs/specs/2026-10-12-draw-pinball/spec.md:25–42`. Both findings below are resolved: SR-3 explicitly permits catalog API requests while excluding relay creation/admission and name synchronization; failed handoff writes preserve input, show an error and prevent navigation, while draft-only persistence failures preserve session input and report unavailable persistence. SR-4 additionally requires corrected codes to trigger a fresh join without being ignored by the mounted `opened` guard. No remaining usecase revisions. SHIP refers to the amended specification; implementation evidence is still required.

## Round 1 findings (resolved)

1. **Check: Preconditions / alternative flow — clarify local draw's network boundary.** SR-3 says `/draw` runs “방/네트워크 연결 없이” (`docs/specs/2026-10-12-draw-pinball/spec.md:26`) while reusing the catalog and specifying loading/list failure (`:28,30`). Existing catalog reuse makes a network request (`portal-fe/src/pages/party/PartyPage.tsx:98–100`, `listGames({size:200})`). Specify that local draw creates/joins no relay room and does not synchronize names; catalog API loading is allowed. Otherwise implementing catalog failure states contradicts the literal no-network condition.

2. **Check: Exception flow / postcondition — define unavailable localStorage behavior before navigation.** SR-3 promises preserved recent settings and a start with entered participants (`spec.md:26,28–30`), but the reused `writeParty` swallows storage failure (`portal-fe/src/pages/games/party.ts:48–59`). Existing games then receive no handoff and show setup (`portal-fe/public/games/marble-race/js/main.js:586–613`), asking for names again. This is **기존 패턴과 동일**, not a new storage defect. State the intended exception: when handoff storage cannot be written, retain form values, show an actionable storage error and do not navigate; when recent-setting persistence alone fails, retain session values and report that persistence is unavailable. A supported non-URL fallback would also satisfy the goal, but should be specified rather than silently expanding v1.

## Covered flows

- Actors/goals map to local organizer, spectator and invited friend; SR-1/SR-2 specify attention without influencing results.
- Local and online entry are intentionally separate (`spec.md:26,31`). v1's optional room stays absent for local start (`party.ts:31,48–54`); recent preferences must not replace the one-shot handoff that games consume (`portal-fe/public/games/lib/party.js:82–86`).
- Wrong/empty/duplicate invitations never become host, and missing/ended rooms use existing relay errors (`spec.md:38`; `GameRelayRegistry.kt:298–307`). Error correction must support a fresh join even after a failed attempt: current `PartyPage.tsx:87–92` has an `opened` one-shot ref, so a correction cannot rely solely on changing params within the same mounted page.
- Same participants/new round and copy failures are explicit (`spec.md:32`). Existing marble result controls already distinguish new seed from replay (`main.js:165–185`, `:45–53`), providing a clear continuity baseline.

Suggested scoped evidence: local start without relay, supported catalog candidates, load failure retry, fewer than two names, storage-denied start, returning with recent settings, fresh round preserving participants, and invalid invitation correction. Existing browser approval constraint remains respected.
