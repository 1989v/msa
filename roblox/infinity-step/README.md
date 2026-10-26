# Infinity Step / Roblox first course

An editable, standalone Roblox prototype: nine urban platforms across Alley, Exterior and Roof. Charged jumps commit their horizontal trajectory. Falling remains costly; continuing and ground respawning are always free. Optional tickets return to the **last stably landed platform before the fall**, at its authored safe center, as requested. This is independent of the browser game and MSA services.

## Open and play

1. Install Roblox Studio, then open `dist/InfinityStep.rbxlx` using File → Open from File.
2. The place already contains the visible course, spawn, camera and exact editable source scripts. Press Play.
3. Use WASD or the mobile stick to walk and aim. Hold Space or HOLD JUMP, then release. Five segments fill at 0.12-second steps; holding 1.2 seconds launches automatically. Gamepad A also charges. Walking slows while charging. You cannot steer in flight.
4. Reach FINISH. Restart free returns to the start. After a substantial fall, choose Use 1 ticket or Continue free. A receipt adds inventory only; it never teleports you. Falling into the void returns to the ground start for free.

Studio explicitly labels its **three TEST tickets**, stored in memory for that server run. Studio cannot initiate real purchases, even if a product ID is configured. Stop/Play resets test inventory. No live product was created, published or purchased.

Suggested route: each next ledge is 12 studs right and 6 studs up. Try a medium charge from a few studs behind the forward edge. Executable reach checks include avatar body clearance and landing margin, but real movement tuning still needs Studio traversal.

## Files and rebuild

- `src/shared`: actual jump equations, course, fall/offer lifecycle and centralized DESIGN.md theme mapping.
- `src/server`: Roblox adapters, receipt processing, atomic ledger, deferred delivery and ingress limiting.
- `src/client`: PC/touch HUD with safe device insets and 48px minimum actions.
- `default.project.json`: optional Rojo source mapping. Rojo is not required; its mapping covers scripts, while the Python builder authors the static world as well.
- `tools/build_place.py`: deterministic Python standard-library builder, with course geometry and palette read from source.
- `tests/run.luau`: actual source module tests, using injected atomic storage/character/delivery boundaries.

From repository root:

```sh
python3 roblox/infinity-step/tools/build_place.py
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/infinity-step/tools/verify.py
```

The verifier requires official `luau` and sibling `luau-compile` / `luau-analyze` (tested with official luau-lang release 0.744). Set `LUAU_BIN` to your local executable path. It fails if these are missing. It executes actual modules, compiles every Luau source/test, rejects undefined globals outside an explicit Roblox allowlist, checks exact embedded scripts and service classes, and compares deterministic rebuilds. Compilation establishes syntax/bytecode validity, **not** Roblox API type correctness.

## Storage and purchase configuration

`src/server/Main.server.luau` has `PRODUCT_ID=0`; purchases stay unavailable. Live tickets use DataStore `InfinityStepTickets_v1`, with atomic `UpdateAsync` transformations. One receipt purchase ID and its one-ticket grant are committed together. No client purchase-finished callback grants inventory. Failed/unknown/offline receipts return NotProcessedYet.

Use reserves one server-generated operation and atomically debits once, recording a pending destination `{platformId, courseVersion}`. A concurrent session cannot reserve another while delivery is pending. Each recovery atomically claims the current operation with a session owner and 30-second lease; expired sessions cannot replay cached placements. A reconnect may wait for that lease to expire. Disconnect/crash after debit recovers on next spawn without another debit. Controls freeze until delivery and durable acknowledgement succeed; acknowledgement errors retry automatically. Receipt grants interleaved with acknowledgement are preserved. If a character changes after acknowledgement commits but before its yielding call returns, a local handoff places the replacement before unlocking; a not-yet-ready replacement stays frozen for recovery. Failed loads/invalid records never become default live records. Existing pending destinations with a changed course version stop safely with a visible error; author a migration before changing the course version in a published experience.

A fall snapshot survives lower landings and death. Death respawns at ground and issues a fresh character-bound offer. Dismissal suppresses the same descent; new safe landings allow later independent falls. A new ascent clears the old offer. Clients supply input and an offer token only, never strength, platform ID or CFrame.

Before live sales, a separately authorized release must create a repeatable Developer Product granting one ticket, configure its ID, publish a private test experience, enable permitted DataStore access, fetch successful live product information, and verify Roblox receipt retries/cancellation/offline delivery and recovery with separate test accounts. Prices come from `GetProductInfo`; none are hard-coded. Product information, data loading and non-Studio mode must all permit purchases. Do not enable Studio access to production data for this mock mode.

Receipt and used-operation histories are deliberately retained indefinitely for exact deduplication in this bounded prototype. Before a large public release, design partitioning/retention within DataStore size limits without losing receipt deduplication. Server validation, ingress limiting, known-platform grounding and server-owned flights are prototype protections, not competitive anti-cheat certification.

## Verification limits and manual checklist

Automated checks cover five charge strengths, complete authored route reach, malformed inputs, ground-only falls, last-platform snapshots, lower landing/death/dismiss/new-ascent lifecycle, duplicate/deferred receipts, storage failures, repeated/competing reservations, debit crash recovery, failed placement/acknowledgement, interleaved grants and character replacement.

**Not yet verified in Roblox runtime:** opening the XML in Studio, API compatibility, actual humanoid physics/side and underside collision, the default camera, full route traversal, mobile stick/hold feel and safe-inset layout, two live clients, live persistence and Marketplace receipts. No Studio or Roblox executable was available and no computer-use approval was granted. Test those manually before publication; this deliverable does not claim production readiness.
