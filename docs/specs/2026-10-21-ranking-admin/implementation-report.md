# Ranking admin P1 — implementation and verification report

2026-10-21. Status: **SHIP after final fresh-context code review**. All F1–F17 findings and focused round 2 follow-ups are resolved. Production readiness and visual/runtime checks are not asserted.

## Scope and architecture

Approved contract: `plan.md` §3–9, all five §9 decisions, `screens.md` S1–S8, ADR-0114. Work stayed in the supplied wt-cafe workspace. No commit, push, deployment, production DB change, manual migration execution, computer use, lockfile edit or build configuration change was performed. Admin dependencies were installed locally with an explicit writable npm cache, without dependency changes.

Source `cafe_drink` rows remain immutable under admin changes. Natural-key field corrections, brand state, previews, journals, audit and operation results persist separately in `ranking_admin_record`, independent of source IDs/cascades. Each correction retains its own evidence URL/date/reason, source snapshot and structured dependency baseline, even after audit retention. Missing keys retain their latest source snapshot; reappearance requires review.

`cafe_drink_effective` is a separate persisted public read model. Public filters/order/counts/pagination use typed Querydsl queries over this table; public requests do not load the whole catalog. ACTIVE correction fields apply independently; CONFLICT fields expose current source. SET_UNKNOWN supports nullable nutrients and adminNote, without source coalescing. Volume UNKNOWN blocks every inference and 100ml value; RESET alone resumes inference; verified SET uses ADMIN_VERIFIED. ZERO caffeine accepts only SET(0) and rejects UNKNOWN; UNDISCLOSED numeric correction is rejected.

The same ranking TM and DB pessimistic locks cover source replacement, corrections, effective projection, generation, audit and successful operation/run results. A control row additionally serializes lock/operation creation, and brand locks are acquired in slug order. Completed idempotent result lookup precedes revisions/generations/preview expiry. Source key validation inherits actual DB column collations and rejects DB-equivalent request/source/retained-brand/full retained correction-key aliases before deletion. Source decimal scale/range checks run before writes.

All S1–S8 screens use typed forms/worklists. Raw source and gas payload are read-only detail sections. Submitted filter changes clear selections; pages preserve them. Up to 200 all-filtered keys are fetched explicitly from the server. Draft-derived nutrients/cup volume/source/per100ml are previewed before save. Detail/conflict/brand 409 reloads preserve drafts and require explicit resubmission. A ranking-wide 403 boundary unmounts cached data and selected forms. Dirty navigation guards router push/replace/go, browser history, tab close and links. Bulk and revert previews show per-target before/after/outcome/block reasons, and one stale target blocks whole-operation revert.

Public rows expose original official source URL/date separately from correction evidence; rawNutrition remains available in source/admin round trips but is excluded from public transport. Portal detail and nearby UI label original source and correction evidence separately.

## API and screen paths

Admin API prefix: `/api/v1/admin/ranking`; every controller request checks trusted gateway member/ROLE_ADMIN identity, with gateway adminConfig in front. Pages are `items,total,page,size`, with summary counts on the drink worklist.

| Method | Path |
|---|---|
| GET | `/cafe/drinks`, `/cafe/drinks/{drinkKey}`, `/cafe/groups`, `/cafe/brands` |
| PATCH | `/cafe/drinks/{drinkKey}/corrections`, `/cafe/brands/{brandSlug}/verification` |
| POST | `/cafe/group-corrections/preview`, `/cafe/group-corrections` |
| GET | `/ingest-runs`, `/ingest-runs/{runId}`, `/conflicts`, `/audit-events`, `/operations/{operationId}` |
| GET | `/operations/{operationId}/revert-preview` — read-only, operation-wide target inspection |
| POST | `/conflicts/{conflictId}/resolve`, `/operations/{operationId}/revert` |
| GET | `/gas/boards`, `/gas/boards/{boardId}/snapshots`, `/gas/snapshots/{snapshotId}` |

The gateway route is exactly `ranking-admin` + adminConfig + stripPrefix(0) + CONTENT_URI. Internal bulk remains outside public routes. Collector parentRunId links brand attempts. Run output includes job, actor, generation before/after under the lock, source checkedAt range, elapsed time and sanitized error summary. FAILED/INTERRUPTED without any success never produces PARTIAL. orphanedKeys counts distinct keys, not corrected fields. Repeated unresolved conflicts preserve initial detection time/run.

Screen paths include `/ranking/cafe/drinks`, `/:drinkKey`, `/ranking/cafe/group-corrections`, `/ranking/ingest-runs` and `/:runId`, `/ranking/conflicts`, `/ranking/cafe/brands`, `/ranking/audit`, `/ranking/gas/boards` and `/:boardId`. Existing `/ranking/cafe/groups` and `/ranking/gas` remain aliases.

## Migration and retention

V6 creates the independent record table/index and control lock. It creates and backfills cafe_drink_effective with display and official/correction provenance columns. Automated isolated MySQL Flyway + Hibernate validate ran; no deployed migration was performed.

Existing content retention CronJob activates the retention profile and runs RankingRetentionRunner. The use case consumes AUDIT_RETENTION_DAYS=365 for audit/operation cleanup; `/privacy` §6 is compared against that same constant by a drift test. Preview cleanup is separate. Corrections and their evidence/source snapshots are retained independently; audit expiry does not erase an unresolved correction's basis. Privacy text identifies member ID retention, one-year period and no name/email duplication.

## Latest verification evidence

| Check | Command/output | Evidence |
|---|---|---|
| Scoped JVM + architecture | `./gradlew :ranking:domain:test :ranking:feature:test :gateway:test verifyArchitecture --no-daemon --console=plain` → `BUILD SUCCESSFUL in 37s`; 37 actionable tasks | `/tmp/ranking-p1-round2.log` |
| JVM XML totals | domain132 / feature78 / gateway148; failures0, errors0, skipped0 in every module | module `build/test-results/test/TEST-*.xml` |
| New transactional acceptance | RankingAdminAcceptanceTest24; failures/errors/skips0 | feature XML |
| Controller HTTP | RankingAdminHttpTest3; every read/write 401/403/admin200, field400 code | feature XML |
| Real MySQL schema + aliases | RankingSchemaIntegrationSpec2, not skipped; case/accent/NFC-NFD alias rejection preserves source/projection/correction/generation | feature XML |
| Admin behavior | `npx vitest run src/pages/ranking/__tests__/RankingPage.test.tsx` → `Test Files 1 passed (1)`, `Tests 21 passed (21)` | `/tmp/ranking-admin-round2.log` |
| Admin types | `npx tsc -b` → exit0, no diagnostics | `/tmp/ranking-admin-round2-tsc.log` |
| Portal related behavior | `npx vitest run src/pages/rank/__tests__/CafePage.test.tsx src/pages/rank/__tests__/CafeNearby.test.tsx src/pages/rank/__tests__/CafeSources.test.tsx src/pages/__tests__/privacyRetention.test.ts` → `Test Files 4 passed (4)`, `Tests 34 passed (34)` | `/tmp/ranking-portal-round1-verified.log` |
| Portal types | after existing content generation, `npx tsc -b` → exit0, no diagnostics | `/tmp/ranking-portal-round1-tsc.log` |
| Loader | `python3 -m tests.test_cafe_load` → `Ran 1 test`, `OK` | `/tmp/ranking-ingest-test.log` |
| Diff whitespace | `git diff --check` → exit0 | command output |

Repair verification failures were corrected rather than hidden: nullable orphan sort comparator compile error; missing explicit query bean in expanded MySQL test context; exact UI message matcher after new 403 boundary; overly broad provenance fixture type; bulk-preview test matcher that omitted its BLOCKED outcome prefix. No test was disabled, removed or loosened to omit the behavior under test. Kotlin daemon fallback warnings and pre-existing portal React act warnings remain in successful logs.

## Final review outcome

Parent-coordinated fresh review initially returned BLOCK; an independent verdict retained all17 findings. Round1 repaired them and added regressions. Focused re-review retained four remaining edge cases (full orphan alias identity, exact conflict refresh beyond200, board detail offset, recovery GET403) plus the current-source link. Round2 repaired all five. Final reviewer returned **SHIP**; no finding remains dismissed, deferred as a code omission, or unresolved.

## F1–F17 repair evidence

| Finding | Repair and regression evidence |
|---|---|
| F1 | DB-native inherited-column-collation checks before deletion for request natural keys, existing source keys, current/retained brand spellings and full retained correction natural keys after source disappearance. Public find additionally requires `CafeDrinkKey.of(actual) == requested`. Real MySQL aliases (case, accent and composed/decomposed Unicode) reject atomically and preserve source/effective/correction/generation. |
| F2 | Source numeric nonnegative/DECIMAL(14,4)/positive-volume validation before replacement. Lossy scale, overflow and negative fixtures reject and journal FAILED without mutations. |
| F3 | ZERO only permits caffeine SET(0); positive and UNKNOWN reject. UNDISCLOSED numeric changes reject. |
| F4 | Nullable nutrients/adminNote UNKNOWN supported through persisted fields, projection, filters and UI. No null coalescing to source; RESET resumes source. Draft blank SET never previews zero. |
| F5 | Detail, conflict and brand have explicit latest reload on409; drafts persist, buttons lock stale submit, new revision/generation used only after explicit resubmit. Tests exercise all three; conflict refresh uses exact conflictId instead of truncating at200, with a beyond200 regression. |
| F6 | Selection binds to applied query excluding page/size; filter/query/sort changes clear old keys and announce it; page selection remains. Submitted-search/all-filtered tests cover this. |
| F7 | Field evidence/date/reason, complete source snapshot, structured dependencies and latest known orphan source survive audit expiry. Conflict UI compares previous/current dependencies and original evidence and a clickable current official-source link; orphan detail shows preserved source. |
| F8 | orphanedKeys is distinct keys. Parent PARTIAL requires success plus non-success; failed+interrupted remains INTERRUPTED. Tests cover multi-field orphan and zero-success parent. |
| F9 | Job/actor, generation before/after captured under lock, checkedAt range, elapsed and safe error summary are persisted/displayed; job filter is tested. |
| F10 | Typed persisted projection carries official URL/date and per-field correction evidence. Public rawNutrition serialization omitted; admin/source raw unchanged. Public detail/nearby labels are independently tested. |
| F11 | Approved S3/S4/S8 exact routes and links exist; direct run/board route tests load requested details. Board detail drops the collection page offset and forces its single-board query to page0, including a page1 collection-link regression. |
| F12 | PreviewTarget exposes server per-target source/variant/before/after/outcome/reason. RevertTarget shows current/restored correction/brand state and block reason; operation-wide reversible flag disables whole execution if any target differs. Backend and UI tests cover it. |
| F13 | S1 summary, submitted search/filter, supported sort,20/50/100/200 page sizes, fixed server-returned all-filtered keys≤200, overflow guidance and default brand/natural-variant sort implemented. |
| F14 | S2 draft preview recalculates cup volume/source and each100ml metric; UNKNOWN/RESET and blank input behavior tested before saving. |
| F15 | Server field400 codes, inline/summary messages and invalid-input focus implemented. Dirty brand URL/date/note changes, router navigation, programmatic history/replace and tab close are guarded. Helper buttons explicitly avoid accidental form submit. |
| F16 | Any late403 triggers a central ranking boundary that clears selected/cached detail/conflict/brand forms and removes sensitive content/actions. Brand and conflict late403 tests cover it; write response loss followed by recovery GET403 also clears the boundary and never offers retry. |
| F17 | Same unresolved conflict retains original detectedAt/runId; latest source/dependencies remain separately readable. Repeated ingest regression verifies identity retention. |

## AC1–AC14 status and runtime limits

| AC | Automated evidence / runtime limit |
|---|---|
| AC1 | Two-brand source replacement, other-brand preservation, empty no-delete, independent corrections/audit. |
| AC2 | Two reingests with new source IDs preserve ACTIVE correction; null/empty variants and normal/decaf do not mix; real MySQL DB-equivalent aliases reject. |
| AC3 | Per-field numeric/serving dependency conflict, unrelated URL/date changes, disappearance/reappearance, original conflict detection identity and structured comparisons. |
| AC4 | Source serialized object/raw/notes unchanged under admin edits; UNKNOWN/RESET/SET0 differ; invalid precision/negative/immutable/ZERO/UNDISCLOSED cases reject; no g→ml inference. |
| AC5 | Effective SQL list/detail/filter/groups/brands/names/variants and exact pre-rounded sorting; volume UNKNOWN nulls concentrations. Nearby uses the same effective repository and related UI tests pass; live nearby operating data was not exercised. |
| AC6 |157 explicit keys apply/revert atomically, unselected158th unchanged, stale preview cancels whole operation; frontend157 selections across four pages;200 preview boundary accepted,201 rejected. |
| AC7 | Server actor/time/evidence/reason audits for writes and SYSTEM reingest; injected audit persistence failure rolls all effects back; durable correction evidence remains after audit expiry. |
| AC8 | Single/bulk/brand/resolve/revert replay, completed-result priority after generation/preview expiry, changed-body409, result persistence rollback, stale revert refusal, exact UUID/body recovery in UI. |
| AC9 | Gateway and actual controller HTTP all admin paths401/403/admin acceptance; forged headers fail at gateway; internal404. Deployed ingress isolation/header trust/cookie-origin behavior are not runtime-probed here. |
| AC10 | Success/invalid/failed/interrupted/parent partial journal semantics, unique orphan counts, metadata/job filtering. DB transaction rollback is tested through injected audit/result failures; no production failure injection performed. |
| AC11 | Multiple brand URLs, row checkedAt preservation, replay/revert, UI distinguishes verification and rights unknown. |
| AC12 | Healthy/stale/missing pointer/broken pointer/count+duplicate rank/new-entry/null/absent past fixtures; gas UI has no writes. |
| AC13 | DOM tests cover workflows, draft/error focus and authority-state removal. Actual1280×800/200%/responsive geometry, real browser focus/scroll/keyboard and screen-reader inspection remain unverified; no computer-use approval exists. |
| AC14 | Ten H2 concurrent ingest/correction races remain coherent; real MySQL alias/schema tests pass. MySQL multi-instance concurrency and operating-data P95 targets (max200<3s/single<1s) are not measured. |

Actual code omissions found by round1 review were repaired; they are not reclassified as runtime checks. Remaining unverified items require operating/UI evidence rather than pretending local unit tests prove them.

## Documentation and operator actions

Main files span ranking domain policy/model, application/admin DTO/Port/UseCase/service, RankingAdminAdapter/effective+record persistence, V6, admin/public controllers, Querydsl, loader parent IDs, retention runner/test, gateway route/auth tests, typed admin pages/API/tests, portal provenance UI/API/tests/privacy and service CLAUDE documentation.

Installed hns doc_scan ran because the root ai submodule script path is absent in this worktree. `/tmp/ranking-doc-scan.log` lists new sources needing index mapping. Doc-index lock was not regenerated under the no-lockfile instruction.

Final fresh-context review has returned SHIP with no unresolved code findings. Before release: apply V6 through reviewed deployment, verify source/effective counts and representative keys, verify trusted ingress and cookie-origin behavior, confirm existing content retention CronJob executes ranking cleanup, visually inspect S1–S8 at specified sizes/zoom with keyboard, and measure MySQL concurrency/operating latency. No production or UI automation action was performed here; such actions require their own authorization.

## Exact changed file inventory

Generated from `git diff --name-only` plus `git ls-files --others --exclude-standard`. ADR-0114 was created by the parent before implementation and is included in this combined working-tree inventory.

- `admin/CLAUDE.md`
- `admin/frontend/src/App.tsx`
- `admin/frontend/src/api/ranking.ts`
- `admin/frontend/src/components/layout/Sidebar.tsx`
- `admin/frontend/src/pages/ranking/RankingOperations.tsx`
- `admin/frontend/src/pages/ranking/RankingPage.tsx`
- `admin/frontend/src/pages/ranking/__tests__/RankingPage.test.tsx`
- `admin/frontend/src/pages/ranking/preview.ts`
- `admin/frontend/src/pages/ranking/shared.tsx`
- `docs/adr/ADR-0114-ranking-natural-key-corrections.md`
- `docs/specs/2026-10-21-ranking-admin/context/progress.md`
- `docs/specs/2026-10-21-ranking-admin/implementation-report.md`
- `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt`
- `gateway/src/test/kotlin/com/kgd/gateway/config/GatewayRouteAuthSpec.kt`
- `k8s/base/retention/cronjob-content.yaml`
- `portal-fe/src/api/rankingApi.ts`
- `portal-fe/src/pages/PrivacyPage.tsx`
- `portal-fe/src/pages/__tests__/privacyRetention.test.ts`
- `portal-fe/src/pages/rank/CafeNearby.tsx`
- `portal-fe/src/pages/rank/CafePage.tsx`
- `portal-fe/src/pages/rank/CafeSources.tsx`
- `portal-fe/src/pages/rank/__tests__/CafeSources.test.tsx`
- `ranking/CLAUDE.md`
- `ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/CafeCorrectionProjection.kt`
- `ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/CafeDrink.kt`
- `ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/CupVolumes.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/admin/dto/RankingAdminDtos.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/admin/port/RankingAdminPort.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/admin/service/RankingAdminService.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/admin/usecase/RankingAdminUseCase.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/dto/CafeDrinkDtos.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/service/CafeDrinkService.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/adapter/RankingAdminAdapter.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/entity/CafeEffectiveDrinkJpaEntity.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/entity/RankingAdminRecord.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/repository/CafeDrinkJpaRepository.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/repository/CafeDrinkQueryRepository.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/repository/RankingAdminRecordRepository.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/retention/RankingRetentionRunner.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/presentation/controller/CafeDrinkController.kt`
- `ranking/feature/src/main/kotlin/com/kgd/ranking/presentation/controller/RankingAdminController.kt`
- `ranking/feature/src/main/resources/rankingdb/migration/V6__ranking_admin_corrections.sql`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/CafeDrinkQueryRepositoryTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/RankingAdminAcceptanceTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/RankingAdminHttpTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/RankingRetentionRunnerTest.kt`
- `ranking/feature/src/test/kotlin/com/kgd/ranking/infrastructure/persistence/RankingSchemaIntegrationSpec.kt`
- `ranking/ingest/src/cafe_load.py`
