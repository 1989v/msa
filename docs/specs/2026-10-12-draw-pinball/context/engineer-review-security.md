# Security review — SHIP

Read-only review of SR-3/SR-4 against existing routing, handoff and relay. No implementation or UI automation performed.

- Input boundary is explicit: exactly one nonempty `r`, normalization limited to the agreed formatting, exact server alphabet, and an error/correction state that never becomes hosting (`spec.md:35–40`). This is material because `PartyPage.tsx:60–61,87–92` currently treats an absent/falsy room as host and opens immediately. The implementation must preserve the distinction between absent invitation and invalid invitation; `URLSearchParams.get()` alone cannot detect duplicates.
- Existing private admission satisfies the no-creation requirement: `usePartyRoom.ts:213–218` uses `private:true`; `GameRelayRegistry.kt:298–307` returns `ROOM_NOT_FOUND` for an unknown private code. The ordinary nonprivate branch can create a room, so new entry routes must call the party join path.
- Server issuance already uses `SecureRandom` (`GameRelayRegistry.kt:153`), collision-checked insertion (`:567–580`), and existing message limits (`:585–591`). SR-4 correctly avoids describing a room code as authorization.
- Names remain outside URLs (`spec.md:29`); existing v1 handoff uses same-origin localStorage (`party.ts:4–10,48–59`) and invitation links carry only the code (`partyRelay.ts:94–96`). Local draw must omit optional `room`; party roster synchronization remains an explicitly separate network flow (`usePartyRoom.ts:91`).
- Clipboard/share are user-initiated and cancellation/failure behavior is specified (`spec.md:32,39`). No new secrets, authentication, financial data or server storage are introduced.

Required implementation evidence: root absent/empty/invalid/duplicate r, valid formatting and pasted links; wrong/expired valid code calls private join without host/create; non-game host root remains unchanged; names absent from all generated URLs. These are implementation checks, not additional spec changes.

Evidence paths are relative to the project root: `portal-fe/src/pages/party/`, `portal-fe/src/pages/games/party.ts`, and `game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt` as named above. Verdict concerns specification adequacy, not a claim that unimplemented checks pass.
