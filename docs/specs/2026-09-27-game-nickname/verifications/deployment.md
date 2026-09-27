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

- Images workflow [36337639771](https://github.com/1989v/msa/actions/runs/36337639771): **success**. Changed targets exactly content, gateway, portal-fe. CI server tests BUILD SUCCESSFUL in 4m25s, image build37s.
- Manifest b248041b set all three target images to **9b5989c**. All three `kubectl rollout status` commands returned **successfully rolled out**. Final check: each READY1 / AVAILABLE1; Argo Synced / operation Succeeded.
- Production MySQL `game_db.flyway_schema_history`: V102 `game player profile`, success1. V96 remained unchanged.
- Real browser at https://game.1989v.com: global nickname modal, guest creation, duplicate rejection400, rename preserving playerId, HttpOnly+Secure+SameSite=Lax scoped cookie, mobile390px no overflow, Escape close. Runtime exceptions0. See production-browser-report.json / production-mobile.png.
- Public API smoke: guest GET200/null, malformed bearer401, sibling-origin write403, automation score200 with excluded=true/applied=false/rank0. No ranking test row inserted.
- Two smoke guest profiles (including initial harness retry) removed by their exact generated player IDs with guest-only predicates; SQL reported removed2 / remaining0. Browser test profile stopped/cleaned.

## Follow-up checks

The full-repository CI detected an ontology source reference that still quoted the old gateway token-selection expression. Updated that one reference to the actual cookie extraction line in af49c196. `:code-dictionary:feature:test --tests '*OntologyFilesSpec'`: BUILD SUCCESSFUL in59s (4 tests, zero failures). Its automatic follow-up CI/image workflow is separate from the successfully deployed nickname images and was pending at this report snapshot.

Docs Health initially found an existing link to an unpublished local Skybound handoff. Clarified that reference in88c10b12; [Docs Health36337951200](https://github.com/1989v/msa/actions/runs/36337951200) succeeded. Concurrent Twin Banner release commits retained the nickname widget ancestors; the shared development tree was not reset or overwritten.

