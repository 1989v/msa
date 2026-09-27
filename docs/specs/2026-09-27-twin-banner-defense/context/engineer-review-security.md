# Security review — 2026-09-27

Verdict: **SHIP** (round 2). SEC-1 resolved by SR-4.2's inbound type/length validation and textContent contract, with HTML-like input cases in planning/test-quality.md. The round-1 findings below are preserved as review history.

## Scope and seed discovery
- Read `spec.md`, `tasks.md`, `planning/test-quality.md`, `context/key-decisions.md`, security checklist and shared review protocol.
- Standards: `docs/standards/online-versus-lobby.md`, `docs/standards/agent-behavior.md`. No `docs/checks/`, `.claude/rules/`, portal-local CLAUDE.md/AGENTS.md, or configured HNS_KB_PATH was found.
- Verified the shared relay component exists at `game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt`. Did not read other games' source; relay behavior is reviewed against the permitted lobby standard.
- Threat model: untrusted guest messages, display strings, and saved data cross the browser boundary; simulation trusts the host for casual cooperation. Accounts, payment, verified score, and competitive anti-cheat are excluded by SR-4.8 and Out of Scope. Do not add authentication, anti-cheat, or server authority to resolve this review.

## Finding SEC-1 — define the display-string trust boundary
**Check:** input validation / XSS. **Severity:** REVISE.

SR-4.2 introduces nicknames and chat from another browser but specifies only lengths (`spec.md:37`); SR-4.3 validates gameplay commands (`spec.md:38`) without saying how the lobby renders incoming strings. The relay standard explicitly treats `move.d` as opaque (`docs/standards/online-versus-lobby.md`, §5), so the sender's UI character limit cannot protect the receiver. This is relevant to safely showing the friend's chat while playing, not to protecting competitive scores.

**Fix:** specify that nickname, chat, public-room host names, and error-related user input are untrusted plain text, rendered through `textContent`/equivalent escaped text without HTML parsing; reject non-string values and cap inbound nickname/chat lengths to 16/120 as well as outbound input. Add a component test displaying an HTML-like nickname/chat literally, plus overlength/non-string inbound cases.

## Satisfactory boundaries
- Relay envelope seat is authoritative for sender identity, payload seat ignored, duplicate sequence and command ranges checked (SR-4.3).
- Message/frequency bounds and partial/stale snapshot rejection are explicit (SR-4.4).
- Arbitrary remote relay override is excluded; only loopback development override is permitted (SR-4.8).
- No secrets or credential storage, backend API changes, payment, or sensitive logging are introduced. The current review does not certify deployment transport or the production relay; production is explicitly unverified/out of scope.
