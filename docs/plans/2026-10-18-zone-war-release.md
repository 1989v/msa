# 영역 전쟁 · zone-war release

## Scope and approval

Release only the final territory client/backend, `zone-war` catalog registration,
and the approved OCI content single-owner rollout exception (ADR-0104). The user
approved a brief outage of content-hosted game/place/blog APIs and a world reset.
Client URL stays `/games/territory/index.html`; API and WS names stay `territory`.
Catalog status is BETA, without a score/save SDK integration claim.

V110 adds the new game and its stats/tag mappings, preserves existing collection
picks, and pins the game in both `editors-pick` and `new-games`. Explicit pins are
required because NEW otherwise deduplicates games already present in MANUAL.
No production database command was run during preparation. Flyway applies V110
when the new content image starts; older migrations are unchanged.

## Isolation and publication order

Root checkout: `/private/tmp/msa-zone-war-release`, branch
`release/zone-war-20261018`, based on remote main `579456950`.
Games checkout: `/private/tmp/games-zone-war-release`, same branch name, based
on remote main `1fc9b430`. Both exclude unrelated unpublished local commits.
Auth/gifticon build submodules use their existing remote-main pinned revisions.
Publish the games commit before the root pointer. Fetch/rebase latest remote main
and any image-manifest commit-back before publication; never force-push main.
Parent session owns publication/deployment and post-deployment checks.

## Verification evidence

- `node --test territory/tests/client.test.mjs`: 9 tests, 9 pass, 0 fail.
- Release Gradle command: `./gradlew :game:domain:test :game:feature:test --tests '*Territory*' --tests '*GameQueryServiceTest' --tests '*GameCatalogAdaptersTest' :gateway:test --tests '*GatewayRoutingSpec' verifyArchitecture --console=plain`:
  `BUILD SUCCESSFUL in 1m 47s`, 45 executed tasks. XML totals: domain 92 tests,
  feature 26 tests (including 100 real local WS clients), gateway 20 tests;
  zero failures/errors/skips. Kotlin daemon sandbox access failed, then the
  compiler's normal fallback completed successfully.
- Fresh local MySQL 8.4: all preceding committed migrations, then V110 twice.
  One zone-war game and one stats row, both requested collection memberships,
  and preservation of all prior picks verified. No production DB access.
- `kubectl kustomize k8s/overlays/oci-arm`: renders. Content has replicas 1,
  strategy Recreate; gateway/portal-fe retain RollingUpdate surge 1/unavailable 0.
- Fresh-context review of migration, rollout patch, ADR and cover: SHIP.
- `./gradlew :content:app:bootJar :gateway:bootJar --console=plain`:
  `BUILD SUCCESSFUL in 39s`, 49 tasks (27 executed, 22 up-to-date).
- Production capacity and UI behavior are not established by these local checks.

## Post-deployment API checks

Use the public same-origin `https://game.1989v.com`. Read catalog detail at
`GET /api/v1/games/zone-war`, newest list at `GET /api/v1/games?sort=NEW`,
and collection memberships at `GET /api/v1/games/collections`. Confirm the
entry URL and cover `/games/territory/cover.svg` return actual game assets.

Create two separate guest profiles using `PUT /api/v1/games/profile/me` with
`{"nickname":"배포검증A"}` and a distinct B name, retaining each response's
guest cookie independently. POST `/api/v1/games/territory/tickets` with each
cookie and same-origin Origin header; never print cookies or tickets. Connect
two ordinary protocol WS clients to the returned wsPath, sending first frame
`{"t":"join","version":1,"ticket":"..."}` with Origin set to the game host.
Assert distinct welcome self IDs, state self names, population at least two,
finite coordinates and increasing ticks. Send numbered moving:false input and
assert acknowledgements; use a short movement within initial land then stop.
Close both connections in finally and check that the remaining connection sees
the population decrement after the first leaves. No production load benchmark.

Watch content memory/restarts after rollout: existing 1Gi limit/CPU 1 remains
unchanged. A small successful smoke does not prove 100-player capacity under
that limit. Do not scale content above one; restart resets in-memory territory.
Recreate serializes Deployment upgrades, but manual overlapping deployments or
node/network failure fencing are outside this single-process design.

## 2026-10-18 publication refresh

Rebased onto published main `579456950` after the site and landslide releases.
The unapplied zone-war seed is V110 so it follows production migrations V108/V109;
no existing migration was changed. No Kotlin source conflicts occurred.

## CI fixture correction — 2026-10-18

Images run 39134354531 stopped before publishing images: the 100-client test
expected 100 active movers and failed. The fixture advanced its orbit angle by
an assumed 50ms per batch, while sending 100 sockets plus sleeping took longer.
A controlled reproduction changed only the batch sleep to 100ms: all 100 clients
received sequence 61 and stayed alive, but all entered `CAPTURE_PENDING` after
their drifting paths left their 7×7 safe plots. This was a fixture trajectory
failure rather than evidence of 100 lost connections. Reproduction evidence:
`/private/tmp/zone-war-timing-repro.log` and `zone-war-timing-repro.xml`.

The test now steers each client toward a lookahead point on its original orbit
using its actual position. It never teleports players or changes land after the
measured traffic starts. Both the original 50ms and delayed 100ms schedules run
with 100 independent real WS clients. Final input receipt is synchronized and
asserted for every client; the existing requirement that all 100 remain alive,
moving and outside capture remains unchanged. Failure diagnostics print grouped
life/movement/capture/status/sequence states. Production code is unchanged.

`./gradlew :game:feature:test --console=plain`: `BUILD SUCCESSFUL in 51s`;
312 tests, zero failures/errors/skips. Both schedules reported all 100 READY,
alive, moving, not pending, and sequence 61 received. This remains a local
transport/fixture check, not proof of production 100-player capacity. Full-suite
evidence: `/private/tmp/zone-war-full-feature-fixed.log` and Gradle XML reports.
Parent will rebuild content, gateway and portal-fe together because the failed
original run published none of them. The separate broad CI DrillExportSpec
generated-data failure is outside this game release and was not changed.

## Entry, shared profile and fullscreen correction — 2026-10-19

The game was playable through direct HTTP/WS smoke, but its embedded entry used
a native form submit handler while the portal iframe deliberately omitted
`allow-forms`. The HTML Standard submission algorithm returns for that sandbox
flag before dispatching `submit`, so that path never reached the join handler.
Parent observed an actual entry click with no UI change before this correction.
Worker used no browser/UI tools. Standard evidence:
https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#form-submission-algorithm

Per approved scope, the global iframe sandbox stays unchanged. Territory entry,
cosmetics and signs use explicit type=button click and input Enter handlers;
IME composition does not trigger entry. The client loads the existing GameRank
profile client for NFKC normalization, 2–16 Unicode codepoints, permitted
characters, unique names, server ownership, session refresh and profile sync.
It preserves an existing name unless the user edits it, retains a typed draft
across a slow read, and exposes duplicate-name/API/WS errors with retry available.
The intro stays visible until welcome; a pending socket has a bounded join wait.

Fullscreen is requested directly in the start gesture before profile/ticket
awaits. Denied/unsupported fullscreen leaves entry/play usable. V111 sets only
zone-war's existing start_fullscreen flag so portal Play also follows its
existing fullscreen policy; BOTH orientation remains unchanged.

Evidence: `node --test territory/tests/*.test.mjs` passed 17/17, including actual
app wiring exercised with inert DOM/canvas/HTTP/WS stubs (no UI automation).
`lib/tests/rank-profile.test.mjs` passed 13/13 against the shared profile client.
Both modified modules passed `node --check`. `./gradlew verifyArchitecture`
reported `BUILD SUCCESSFUL in 16s`. Fresh local MySQL 8.4 applied V111 twice after
V110: zone-war start_fullscreen=1, orientation=BOTH, other games changed=0;
migration versions remain unique. Logs: `/private/tmp/zone-war-entry-node.log`
and `/private/tmp/zone-war-entry-architecture.log`; shared-profile output is in
`/private/tmp/zone-war-entry-shared-profile.log`, and the fresh-schema V111
before/after comparison is in `/private/tmp/zone-war-entry-sql.log`.
Fresh-context read-only review of the entry diff and V111 returned SHIP with
no blocking findings. Parent owns publication,
deployment and separately approved real browser verification.

## Fullscreen toggle, visual correction, duration and respawn focus — 2026-10-19

Pure client scope. A persistent compact fullscreen control observes both the
game document and a containing same-origin portal fullscreen, including Escape;
requests remain inside a click and unsupported/denied requests keep play usable.
A small ranking-adjacent `플레이 mm:ss` (hours supported) uses performance.now
since welcome, continues through menus/death/respawn, freezes on disconnect and
resets only on the next welcome. It creates no interval or API traffic.

The previous camera directly followed the predicted player, which was overwritten
by each 10Hz authoritative snapshot. A deterministic delayed-snapshot trace at
the current 8px scale produced a 3.733px backward step. Small snapshot correction
offsets now decay in display coordinates only (80ms time constant, bounded to four
world units). Camera and self-marker use the same display point. The same trace
has zero backward steps; stopping converges without drift. Large corrections,
death and new life snap immediately. Prediction/input/ownership/collision and all
server simulation code remain unchanged.

The actual app regression reproduced focus remaining on the respawn BUTTON;
the intentional keyboard target filter then ignored movement keys. Existing
settings close already focused canvas, so it was not itself the original root
cause. New-life stopped state and the in-flight dead-snapshot/death-panel race
are corrected. Confirmed respawn dismisses its pending death panel and restores
focus; an explicitly reopened settings editor remains open, as does an actively edited automatically reopened
death panel. Stop/resume,
settings/help close and fullscreen transitions clear held controls and restore
canvas focus when an active input/select/editor does not need it.

Verification: `node --test territory/tests/*.test.mjs`, 28 tests passed, zero
failures, including actual app/controls DOM stubs, Escape/reentry, parent
fullscreen, rejected requests, irregular frame decay, snapshot trace, input
direction/reverse invariance, stop convergence, respawn ordering and editing
focus. Modules passed `node --check`; `git diff --check` passed. Evidence:
`/private/tmp/zone-war-polish-node.log`, pre-fix focus regression in
`/private/tmp/zone-war-focus-before.log`. No worker UI automation was used.

Local preview: `http://127.0.0.1:4178/zone-war-preview` (process launched with
`node /private/tmp/zone-war-polish-preview.mjs`). It serves the games release
checkout in the same form-blocking sandbox and forwards API/WS only to the
existing local verification backend at 127.0.0.1:4180, never production. Parent
owns the separately approved browser checks and publication/deployment.
