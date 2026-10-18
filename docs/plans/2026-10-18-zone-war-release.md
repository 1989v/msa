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
