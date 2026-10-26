# Specification: Roblox Infinity Step — first course

## Goal
Create an editable Roblox climbing prototype that retains Infinity Step's charge-and-commit jumps, with optional paid revival to the last platform safely landed on before a fall.

## User Stories
- A player judges distance, holds jump for one of five strengths, releases, and lives with the trajectory until landing.
- A player who falls can continue freely or explicitly spend one revival ticket to return to the last platform before the fall.
- A purchaser retains an unused ticket through disconnects, receipt retries, and cancellation of a revival choice.

## Specific Requirements
### SR-1 Course and movement
- Three short, deterministic urban regions (alley, exterior, roof) with solid visible platforms, labeled regional entrances, a start spawn and a finish marker. All necessary jumps are reachable with the configured five strengths, without payment.
- Scale original movement by four Roblox studs per source unit: gravity 104, vertical launch speeds 30–64 and horizontal speeds 6–40; five linear steps. Use the source code's current 0.12-second charge steps, not older prose values; cap hold at 1.2 seconds.
- Input: WASD/default mobile stick plus Space/on-screen held jump. Charging slows walking. Charged flight locks horizontal direction until collision/landing; collisions never push through solid parts. Default Roblox jumping is disabled.
- Server validates charge start/release, duration, grounded state and finite direction; clients cannot name a jump strength or teleport target. Movement and region/fall transitions have server validation appropriate to this prototype; do not advertise competitive anti-cheat certification.
- Falling is not capped at a regional boundary. No automatic regional respawn. A void/death recovery goes to the ground start for free.

### SR-2 Last-platform revival
- Region and the last safe platform are established by stable landing on a known course platform, not height alone. Each platform has an authored stable ID and a safe return center resolved only by the server.
- Snapshot the last safe platform ID and departure height when a fall begins; offer a revival after a substantial height loss or death. Ground-only falls do not offer a meaningless paid revival.
- A fall keeps the original snapshot even after crossing/landing in lower regions. A successful new ascent, explicit dismissal, restart, character lifecycle transition or use handles the old offer explicitly; no stale offer may teleport a newly progressed character backwards.
- Dismissal suppresses further offers for the same uninterrupted fall; it cannot immediately reconstruct an offer from unchanged last-safe state. Lower landing does not silently retarget an existing offer.
- Death preserves the fall snapshot separately from character-bound UI/actions. After free ground spawning, issue a fresh character-bound offer from that snapshot; ordinary character transitions invalidate old requests. A voluntary restart/dismissal clears the uncommitted snapshot. Reserved delivery is a separate durable obligation.
- Show destination and balance. Use consumes one ticket exactly once, restores zero velocity, and places the avatar safely above the target. Dismissal/ordinary continuation costs nothing.

### SR-3 Purchases and persistence
- A repeatable Developer Product grants one revival ticket. Server `MarketplaceService.ProcessReceipt` handles all receipts once; durable grant and purchase-ID deduplication share one atomic DataStore update. Return `NotProcessedYet` on failure/unknown product/offline user. Never grant from a client purchase-finished callback.
- Receipt delivery grants inventory only; it never auto-teleports. Cancellation, delayed delivery, disconnect, no pending fall and duplicate delivery do not lose or double-grant a purchased ticket.
- Durable use atomically decrements a positive balance once using a server-generated operation ID. Serialize per-player requests and invalidate offers on character changes; failure leaves position unchanged. Snapshot-safe handling prevents a yielding persistence operation from teleporting a replacement character.
- Persist a pending revival delivery (operation ID, course version and authored platform ID) in the same atomic decrement. Resolve position from the server course, never a client CFrame. If a disconnect/server failure interrupts teleport or acknowledgement, recover that delivery on the next character/session without charging again. Clear it only after delivering safely; concurrent sessions cannot reserve a second use while a delivery is pending. Stored records are updated atomically without stale whole-record saves.
- Complete reserved delivery before controls/progress resume on spawn. If teleport succeeds but acknowledgement fails, keep the character safely frozen and retry automatically; reconnect recovers the same delivery. Receipt grants may interleave without being overwritten by acknowledgement. No second debit on retry.
- Purchases stay unavailable with product ID zero, failed data load, Studio mock storage, or unavailable product information. Prices are fetched from Roblox at runtime; no invented or hard-coded Robux price.
- Studio local mode provides explicit test tickets and labels them as test inventory. It cannot enable real purchases. Persistence errors are visible and never overwrite real records with default values.

### SR-4 Delivery and experience
- Create sources under `roblox/infinity-step/`, independently from the browser games submodule. Include a project mapping and a dependency-light place builder or an equivalent verified packaging path.
- A `.rbxlx` place includes the exact checked-in scripts, services, a visible initial world/spawn and a usable camera. README explains opening and Play, controls, mock inventory, configuration, receipt verification, and publishing prerequisites.
- HUD shows region, current/best session height, five charge segments, ticket balance, and an explicit revival/continue choice. Touch targets are at least 44px with Roblox safe insets; keep movement controls clear. UI colors derive from root DESIGN.md tokens via a named Luau theme; no scattered hex literals.
- Verify gameplay logic, fall snapshots, single-use/deferred/duplicate purchases, persistence failures and artifact contents with executable checks. Studio physics, touch feel and real receipts require actual Roblox runtime checks and must be labeled unverified if unavailable.
- Automated execution uses the official Luau CLI against actual source modules with injected store/clock/delivery boundaries, not a parallel Python/JS reimplementation. Use `LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/infinity-step/tools/verify.py`; the same verifier compiles all Luau with a sibling `luau-compile` and checks the generated XML. Runner provenance: official luau-lang/luau release 0.744.

## Existing Code to Leverage
- `portal-fe/public/games/_src/infinity-step/Assets/Scripts/Sim/Leap.cs`: actual five-level charge constants and reach equations; reference, not a Luau dependency.
- `portal-fe/public/games/_src/infinity-step/Assets/Scripts/Actors/Climber.cs`: control semantics.
- `docs/specs/2026-09-02-infinity-step-prd.md`: original identity and fall cost; optional paid revival is an intentional Roblox-only user-requested adaptation.
- Root `DESIGN.md`: semantic UI tokens.

## Out of Scope
Full original infinite tower, all seven regions, wall climbing, moving/breakable platforms, global rankings, trading/gifting, web account integration, production publication, live product creation, final price and real purchases. This is a standalone Roblox project, with no platform MSA schema or service changes.

## Open Questions
Destination resolved by explicit user answer: “떨어지기 직전 밟았던 발판으로 복귀”. Price and product ID are deferred release configuration. No unknowns block building the prototype.

## Amendment — 2026-10-26 User-selected destination
The user selected the last platform instead of the agent's earlier region-entrance default. SR-2 and the pending-delivery target in SR-3 reflect this explicit correction. The first-course scope and free continuation remain as authorized. The user also requested a reusable Roblox porting prompt and a Roblox development reference document; these are parent-authored documentation under `docs/research/2026-10-26-roblox-development/`.

## Local terminology
See `planning/glossary.md` for the standalone Roblox vocabulary and lifecycle distinctions; this introduces no cross-service bounded context.

## Sources
- https://create.roblox.com/docs/luau
- https://create.roblox.com/docs/production/monetization/developer-products
- https://create.roblox.com/docs/cloud-services/data-stores/player-data-purchasing
