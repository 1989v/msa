# WU-7 — 상인회 신청·권한 API 검증

Canonical requirements: `../prd.md` FR-8~11, §3/6; `../tasks.md` WU-7; ADR-0109 §7. Scope: place domain/feature, authenticated gateway routes, scoped tests. 상인회 UI는 WU-8 범위다.

## 실행 증거 (2026-10-15)

| 명령 | 마지막 실행 결과 |
|---|---|
| `./gradlew --no-daemon :place:feature:compileKotlin` | `BUILD SUCCESSFUL in 14s` · `15 actionable tasks: 1 executed, 14 up-to-date` |
| `./gradlew --no-daemon :place:feature:test --tests '*Market*' --tests '*Steward*'` | `BUILD SUCCESSFUL in 35s` · `19 actionable tasks: 3 executed, 16 up-to-date` |
| `./gradlew --no-daemon :gateway:compileKotlin` | `BUILD SUCCESSFUL in 10s` · `13 actionable tasks: 1 executed, 12 up-to-date` |

JUnit XML 합계: **71 tests, 0 failures, 0 errors, 0 skipped** (11 classes). WU-7 신규: `MarketStewardServiceTest` 6, `MarketStewardControllerTest` 3. 기존 Market 테스트 62개도 실행했다. `git diff --check` 출력 없음.

로컬 원본 로그: `wu7-compile.log`, `wu7-tests.log`, `wu7-gateway.log`. Gradle은 single-use daemon을 종료했으며 Kotlin daemon sandbox 경로 접근 경고 뒤 fallback compiler로 성공했다. JDK 25→24 target, 기존 deprecated API·Gradle 경고가 있다.

## API 계약

| Method | 경로 | 인증 / 동작 |
|---|---|---|
| POST | `/api/v1/place/markets/{marketId}/steward-applications` | 로그인, `{orgName, contact}` → PENDING 행 |
| GET | 위 경로 + `/me` | 로그인, 자기 시장 신청/권한 상태, 신청 없으면 data=null |
| GET | `/api/v1/admin/place/stewards` | ROLE_ADMIN, `status` 선택, `page=0`, `size=20` (최대100), 최신 ID 순 |
| PUT | `/api/v1/admin/place/stewards/{id}` | ROLE_ADMIN, `{action: APPROVE/REJECT/SUSPEND/RESTORE}` |
| GET | `/api/v1/place/markets/{id}/manage` | 로그인 + 현재 DB ACTIVE, editor 상세 |
| PUT | manage + `/stores/{storeId}/override` | WU-5 `{values, clear, reason}` 바디·필드 whitelist |
| POST / PUT / DELETE | manage + `/stores[/{storeId}]` | WU-5 MANUAL 생성·수정·삭제 정책 |
| PUT | manage + `/zones[/{zoneId}]`, `/zones/order` | WU-5 구역 생성·수정·정렬 정책 |
| GET | manage + `/changes` | 현재 DB ACTIVE, `page/size` 변경 이력 |
| POST / DELETE | manage + `/changes/{logId}/revert`, `/zones/{zoneId}` | 금지 경로: DB grant 확인 후 403, editor 호출 없음 |

기존 `place-market-admin` gateway 경로에 `/api/v1/admin/place/stewards[/…]`를 추가했다. `place-market-member`가 신청·`/me`·manage 전체를 `userConfig()` 인증 및 신뢰되는 `X-User-Id`로 처리한다. 이 specific route는 공개 GET `/api/v1/place/markets/**`보다 앞에 있어 상태/상세/이력이 공개 경로로 빠지지 않는다. ROLE_ADMIN route는 그대로 재사용한다.

## 상태·동시성 정책

- 동일 `(marketId, memberId)`의 PENDING/ACTIVE 재신청은 409. REJECTED 재신청은 동일 ID·createdAt을 보존하여 PENDING으로 수정하고 단체명·연락처를 새 입력으로 교체한다. SUSPENDED 재신청도 409이며 admin RESTORE만 허용한다.
- 유효 전이는 PENDING→APPROVE→ACTIVE, PENDING→REJECT→REJECTED, ACTIVE→SUSPEND→SUSPENDED, SUSPENDED→RESTORE→ACTIVE뿐이다. 나머지는 저장 없이 409.
- APPROVE/RESTORE는 현재 admin의 ID·시각을 승인 메타데이터에 기록한다. SUSPEND는 기존 승인 메타데이터를 보존한다. REJECT는 PENDING에서만 가능하며 과거 승인값이 없는 정상 신청을 반려한다.
- apply/decide는 `placeTransactionManager` 트랜잭션에서 시장 행을 먼저 잠근다. 신규 신청도 기존 시장 행으로 직렬화한다. decide는 scalar market ID 조회 후 시장 잠금 → steward `PESSIMISTIC_WRITE` current read 순서다. 잠금 전 steward entity를 로드하지 않으며 JPA managed stale row와 REPEATABLE_READ snapshot으로 이전 PENDING을 덮는 것을 방지한다.
- manage의 모든 handler는 `MarketStewardUseCase.actor(memberId, marketId)`를 요청마다 호출하여 DB 행의 회원·시장·ACTIVE를 확인한다. JWT 시장 목록·캐시를 사용하지 않는다. 정지 후 다음 요청과 다른 시장·다른 회원은 403.

## 표준·drift 점검

- Domain은 순수 Kotlin 상태 전이, application은 UseCase 인터페이스와 outbound port, persistence는 adapter/JPA repository로 분리했다. Controller는 UseCase만 주입한다. 다른 서비스 DB·member entity를 참조하지 않는다.
- 공유 WU-5 editor를 그대로 사용하여 override 검증·원천 보존·MANUAL 출처·전후 이력·트랜잭션을 유지한다. 승인된 상인회 입력 및 이력은 STEWARD/member ID를 기록한다. 가격 필드 추가 없음.
- REVERT·zone 삭제를 수행하는 steward handler는 없다. 대응 금지 경로는 explicit 403만 반환한다. 공유 editor의 polygon removal ADMIN 검사도 유지한다.
- 요청 바디/리스트와 오류는 ApiResponse. 단체명300·연락처500 제한, 양의 회원 ID·페이지 범위를 검증한다. 신청 중복·전이 충돌409, 범위/정지403, 입력400, 없는 시장/신청404.
- 개인정보를 로깅하지 않고 결정 ID·action·admin만 kotlin-logging 람다로 기록한다. 외부 IO·캐시·새 테이블·migration 추가 없음.
- FR-8~11 및 §6 계약과 WU-7 범위를 대조했다. UI/배지 표시는 후속 WU-8이며 API는 출처 데이터를 제공한다. 기존 서비스 안내 문서의 API 표는 이전 범위이므로 후속 문서 동기화에서 신규 경로를 반영할 수 있다.

## 검증 한계

MockK port와 실제 lifecycle/editor + MockMvc를 사용했다. 중복409, 전이 행렬, 재신청 ID 유지, 승인 메타데이터, 승인 후 MANUAL/history STEWARD, 다른 시장403, 정지 후 다음 편집403, revert/zone-delete403 및 editor 미호출을 검사했다. 잠금 순서·current row 상태를 사용하는 회귀 테스트는 있지만 실제 MySQL 동시 트랜잭션·rollback, 실제 JWT/gateway 통합 호출은 실행하지 않았다. Gateway 인증 경로는 소스 순서 검토와 compile로 확인했다. 전체 suite·운영 DB migration·배포·computer use·git commit/push는 수행하지 않았다.

## 변경 파일 목록

- `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt`
- `place/domain/src/main/kotlin/com/kgd/place/domain/market/model/MarketSteward.kt`
- `place/feature/src/main/kotlin/com/kgd/place/application/market/port/MarketStewardPort.kt`
- `place/feature/src/main/kotlin/com/kgd/place/application/market/service/MarketStewardService.kt`
- `place/feature/src/main/kotlin/com/kgd/place/application/market/usecase/MarketStewardUseCase.kt`
- `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/market/adapter/MarketStewardRepositoryAdapter.kt`
- `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/market/repository/MarketJpaRepositories.kt`
- `place/feature/src/main/kotlin/com/kgd/place/presentation/market/controller/MarketAdminExceptionHandler.kt`
- `place/feature/src/main/kotlin/com/kgd/place/presentation/market/controller/MarketManageController.kt`
- `place/feature/src/main/kotlin/com/kgd/place/presentation/market/controller/MarketStewardAdminController.kt`
- `place/feature/src/main/kotlin/com/kgd/place/presentation/market/controller/MarketStewardController.kt`
- `place/feature/src/test/kotlin/com/kgd/place/application/market/service/MarketStewardServiceTest.kt`
- `place/feature/src/test/kotlin/com/kgd/place/presentation/market/controller/MarketStewardControllerTest.kt`
- `docs/specs/2026-10-15-market-store-map/verifications/wu7-verification.md`
