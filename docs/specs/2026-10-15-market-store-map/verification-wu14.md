# WU-14 검증 기록 — 상인회 골목 구조 변경 요청

2026-10-15. 작업 위치: `wt-p4-steward` 현재 worktree만 수정. 커밋·스테이징·배포·브라우저/컴퓨터 사용 없음.

## 구현 결정

- V38 `market_geometry_request`, 순수 도메인 모델, UseCase/Port/Adapter 및 독립된 상인회·운영자 컨트롤러를 추가했다.
- ACTIVE 담당자 가드를 매번 재사용한다. 제출은 시장 행 잠금을 먼저 획득하고 담당자 행을 잠가 정지 처리와 직렬화한다. 운영자 결정은 요청 행의 비관적 잠금 아래 PENDING만 처리한다.
- nullable 그림은 설명만으로 제출할 수 있다. 그림이 있으면 좌표 범위·유한값·두 원소 배열·종류별 최소/중복 지점·최대 2,000점을 검증한다. 출입구·메모는 한 점이다. 설명 5,000자, 결정 사유 2,000자 이내이며 빈 사유는 400이다.
- 승인은 요청 상태·결정 메타데이터만 갱신한다. 요청은 승인 후에도 재판정에 영향을 주지 않는다. applied_change_log_id는 NULL이다. 운영자 편집기와 이력 저장은 별도 후속 흐름이다.
- 포털은 기존 SVG 시장 지도와 같은 지역 평면 투영으로 가게 점을 표시하고 클릭 좌표를 [lat,lng]로 역변환한다. 좌표 입력을 함께 제공한다. 운영자 화면은 상태 필터·KST 일시·SVG 미리보기·필수 사유·페이지 내 확인·승인 후 편집 링크를 제공한다.
- 편집 링크는 계약의 `/admin/place/markets/{marketId}?geometryRequest={id}`이며 이번 작업은 대상 편집기를 구현하지 않는다.

## JVM — 변경한 두 클래스만 실행

```sh
./gradlew :place:feature:test --tests '*MarketGeometryRequestControllerTest' --tests '*MarketGeometryRequestRepositoryAdapterTest' --no-daemon -Pkotlin.compiler.execution.strategy=in-process
```

최종 출력:

```text
BUILD SUCCESSFUL in 44s
19 actionable tasks: 2 executed, 17 up-to-date
```

JUnit XML 결과:

```text
MarketGeometryRequestControllerTest: tests=5 skipped=0 failures=0 errors=0
MarketGeometryRequestRepositoryAdapterTest: tests=1 skipped=0 failures=0 errors=0
PASS Then: ACTIVE submits PENDING and reads own market; other market and suspended read/write return403
PASS Then: missing/blank reason400, decision metadata, filtered list, and repeated decision409
PASS Then: neither pending nor approved drawings affect rejudgement or write editor history
PASS Then: rejects malformed coordinates, insufficient points and blank descriptions; accepts nullable drawings
PASS Then: rechecks grant under the lock if suspension wins the race
PASS Then: roundtrips JSON coordinates, nullable drawings and decision metadata, and uses locking reads
```

첫 실행의 Jackson3 JsonNode.map 오버로드 컴파일 오류는 기존 indexed-array 파싱 패턴으로 수정했다. 다음 실행은 새 ONNURI 테스트 fixture의 필수 원천 JSON 누락으로 실패하여 `{}` 원천을 추가했다. 위 최종 실행에서 모두 통과했다. Kotlin 컴파일 데몬의 작업공간 밖 marker 파일 쓰기를 피하려고 in-process 옵션을 사용했다. Gradle 데몬은 모든 실행에서 --no-daemon이다.

## 포털 — 변경 관련 테스트와 실제 프로젝트 타입 검사

`portal-fe/`에서:

```sh
node scripts/render-content.mjs
npx vitest run --no-cache src/pages/place/__tests__/MarketGeometryRequests.test.tsx src/pages/place/__tests__/MarketManagePage.test.tsx
npx tsc -b
```

```text
✓ src/pages/place/__tests__/MarketGeometryRequests.test.tsx (3 tests)
✓ src/pages/place/__tests__/MarketManagePage.test.tsx (3 tests)
Test Files  2 passed (2)
Tests  6 passed (6)
npx tsc -b exit 0 (only tsBuildInfoFile temporarily redirected to /tmp)
```

## 운영자 — 변경 관련 테스트와 실제 프로젝트 타입 검사

`admin/frontend/`에서:

```sh
npx vitest run --no-cache src/pages/markets/__tests__/MarketGeometryRequestsPage.test.tsx
npx tsc -b
```

```text
✓ src/pages/markets/__tests__/MarketGeometryRequestsPage.test.tsx (2 tests)
Test Files  1 passed (1)
Tests  2 passed (2)
npx tsc -b exit 0 (only tsBuildInfoFile temporarily redirected to /tmp)
```

## 캐시 경로와 확인 범위

이 worktree의 node_modules는 다른 checkout으로 연결되어 있어 기본 Vitest 결과 캐시와 TypeScript buildinfo 저장에서 EPERM이 발생했다. Vitest는 --no-cache로 재실행해 정상 exit 0을 확인했다. TypeScript는 각 FE의 tsconfig.app.json·tsconfig.node.json 원문을 메모리에 보관하고 tsBuildInfoFile 경로의 `./node_modules/.tmp/`만 각각 `/tmp/wu14-portal-` 및 `/tmp/wu14-admin-`으로 임시 치환했다. 그 상태에서 subprocess로 **npx tsc -b**를 실행하고 finally에서 네 파일 원문을 복원했다. 검사 대상·옵션·include·references는 그대로다. 네 설정 파일의 git diff가 빈 결과인 것을 확인했다. 캐시 리다이렉트는 저장소 변경물에 포함되지 않는다.

최종 `git diff --check` exit 0. 생성된 콘텐츠와 캐시/타입검사 설정 변경은 git status에 없다. 전체 테스트 스위트는 실행하지 않았다. HTTP 검증은 MockMvc + 실제 서비스와 모킹한 저장 포트를 사용한다. JPA 어댑터 검증도 저장소 mock이므로 V38을 실제 DB에 적용하거나 동시 트랜잭션을 통합 실행한 증거는 아니다. 브라우저 시각 검증은 수행하지 않았다.

## 변경 파일

- `admin/frontend/src/App.tsx`
- `admin/frontend/src/api/geometryRequests.ts`
- `admin/frontend/src/components/layout/Sidebar.tsx`
- `admin/frontend/src/pages/MarketGeometryRequestsPage.tsx`
- `admin/frontend/src/pages/markets/__tests__/MarketGeometryRequestsPage.test.tsx`
- `docs/adr/ADR-0110-market-alley-geometry-osm.md`
- `place/domain/src/main/kotlin/com/kgd/place/domain/market/model/MarketGeometryRequest.kt`
- `place/feature/src/main/kotlin/com/kgd/place/application/market/port/MarketGeometryRequestPort.kt`
- `place/feature/src/main/kotlin/com/kgd/place/application/market/service/MarketGeometryRequestService.kt`
- `place/feature/src/main/kotlin/com/kgd/place/application/market/usecase/MarketGeometryRequestUseCase.kt`
- `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/market/adapter/MarketGeometryRequestRepositoryAdapter.kt`
- `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/market/entity/MarketGeometryRequestJpaEntity.kt`
- `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/market/repository/MarketGeometryRequestJpaRepository.kt`
- `place/feature/src/main/kotlin/com/kgd/place/presentation/market/controller/MarketAdminExceptionHandler.kt`
- `place/feature/src/main/kotlin/com/kgd/place/presentation/market/controller/MarketGeometryRequestController.kt`
- `place/feature/src/main/resources/placedb/migration/V38__market_geometry_request.sql`
- `place/feature/src/test/kotlin/com/kgd/place/infrastructure/persistence/market/adapter/MarketGeometryRequestRepositoryAdapterTest.kt`
- `place/feature/src/test/kotlin/com/kgd/place/presentation/market/controller/MarketGeometryRequestControllerTest.kt`
- `portal-fe/src/api/marketStewardApi.ts`
- `portal-fe/src/pages/place/AttractionMarket.css`
- `portal-fe/src/pages/place/MarketGeometryRequests.tsx`
- `portal-fe/src/pages/place/MarketManagePage.tsx`
- `portal-fe/src/pages/place/__tests__/MarketGeometryRequests.test.tsx`
- `portal-fe/src/pages/place/__tests__/MarketManagePage.test.tsx`
- `docs/specs/2026-10-15-market-store-map/verification-wu14.md`
