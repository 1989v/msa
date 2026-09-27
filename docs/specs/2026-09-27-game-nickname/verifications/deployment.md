<!-- source: game/feature/src/main/kotlin/com/kgd/game/presentation/profile/controller/GamePlayerProfileController.kt, gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt, portal-fe/src/api/gameProfileApi.ts -->

# Nickname release — 2026-09-28

User authorized production deployment. Release assembled in `/private/tmp/msa-game-nickname-release` from latest production main `6d1469d0`, with only nickname commits and games pointer changes. Shared development tree retained.

## Integration verification

- Preserved ADR-0101 HttpOnly authentication, existing operator/automation score exclusions, current production game assets.
- `./gradlew -Pkotlin.compiler.execution.strategy=in-process :game:domain:test :game:feature:test :gateway:test verifyArchitecture`: **BUILD SUCCESSFUL in 1m 26s**. Domain72 + feature286 + gateway114 =472, failures/errors/skipped0. Real MySQL schema integration17, skipped0.
- `npx tsc -b` exit0; scoped frontend suite83 passed. Vite build succeeded.
- Widget tests13 passed, including expired cookie GET recovery, explicit mutation retry, account switch while refreshing. Fresh review SHIP for integration and session recovery.
- V102 is additive (three new tables); legacy score tables unchanged. Migration runs via content Flyway at startup.

## Deployment

Target services: gateway, content, portal-fe. GitHub Actions images workflow builds native arm64 images and updates OCI overlay; Argo CD performs production rollout.

Production run and smoke results will be added after rollout.
