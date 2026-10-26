# Verification strategy

Critical paths: hold/release → five-level trajectory; landing → last-platform snapshot → large fall → single ticket → safe return; receipt → durable one-time inventory grant → later use.

- Unit: charge thresholds, reachability, input rejection, fall snapshots, free continuation without a repeated same-fall offer, same fall duplicate use, stale offer handling, grant retries and durable decrement rejection.
- Component with injected persistence: duplicate purchase ID, delayed receipt without offer, failed load/update, simultaneous use, replacement character during update.
- Component recovery: interrupt after debit/before teleport and after teleport/before acknowledgement; recover on next spawn/session with no additional debit; block competing-session reservation; preserve an interleaved receipt grant during acknowledgement. Assert balance, pending operation and replay outcome.
- Regression: two delivery runners holding a cached operation cannot replay a completed delivery; character replacement after acknowledgement commits but before the storage call returns does not lose the delivery handoff; all remote actions including sync/release are rate-limited.
- Lifecycle: death snapshot → free ground respawn → fresh offer → free continue or single use; old character requests are rejected. Pending acknowledgement failure freezes progression, retries, then unlocks.
- Packaging: parse generated XML; scripts/classes/source paths match repository, service placement, theme mapping, visible course/spawn, deterministic regeneration.
- Studio manual: full course traversal, underside/side collisions, grounded detection, camera, two clients, mobile stick plus held jump, falling onto lower platforms, mock revival. Real receipt tests require a configured published private test experience and separate explicit authorization.

Pure logic tests do not establish Roblox physics or Marketplace integration success.

## Executable path

Use official Luau CLI 0.744 (downloaded from `https://github.com/luau-lang/luau/releases/download/0.744/luau-macos.zip`, extracted under `/private/tmp/roblox-infinity-step-tools/`). Tests require the actual source modules. Roblox DataStore/clock/teleport boundaries are injected; no duplicated model is accepted.

`LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/infinity-step/tools/verify.py`

The verifier must execute the Luau test entry point, compile every shipped script using sibling `luau-compile`, rebuild/validate XML and assert exact script source packaging. It must fail on a missing runner instead of reporting a skipped pass.
