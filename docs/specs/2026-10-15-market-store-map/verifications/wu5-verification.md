# WU-5 — 운영자 시장 편집 API 검증

Canonical requirements: `../prd.md` FR-5~7, §6, AC-4/5. Scope: place domain/feature + 최소 gateway admin route. UI·상인회 라우트·배포는 이 작업에 포함하지 않는다.

## 실행 증거 (2026-10-15)

| 명령 | 마지막 실행 결과 |
|---|---|
| `./gradlew :place:feature:compileKotlin` | `BUILD SUCCESSFUL in 8s` · `15 actionable tasks: 1 executed, 14 up-to-date` |
| `./gradlew :place:feature:test --tests '*Market*'` | `BUILD SUCCESSFUL in 27s` · `19 actionable tasks: 3 executed, 16 up-to-date` |
| `./gradlew :gateway:compileKotlin` | `BUILD SUCCESSFUL in 11s` · `13 actionable tasks: 1 executed, 12 up-to-date` |

최종 JUnit XML 합계: **62 tests, 0 failures, 0 errors, 0 skipped** (9 classes).
WU-5 신규 테스트: MarketEditorServiceTest 17, MarketIngestProtectionTest 1, MarketRowRestorerTest 1, MarketAdminControllerTest 2.
`git diff --check` 출력 없음. 컴파일 시 Kotlin daemon sandbox 경로 접근 경고 뒤 fallback compiler가 실행됐다. JDK 25→24 target 및 Gradle deprecation 경고가 있으나 명령은 성공했다.

원본 로컬 로그: `wu5-place-compile.log`, `wu5-market-test.log` (레포의 `*.log` ignore 정책으로 미추적). gateway 결과는 도구 출력에서 위의 종료 증거를 옮겼다.

## API 계약

모든 경로 prefix: `/api/v1/admin/place/markets`. gateway는 `adminConfig()`의 ROLE_ADMIN을 확인하고 content 서비스로 원래 경로를 전달한다. 컨트롤러는 양의 `X-User-Id`를 ADMIN actor로 만들어 usecase에 전달한다.

| Method | 경로 (prefix 제외) | 용도 / 바디 |
|---|---|---|
| GET | 빈 경로 | `name`, `page=0`, `size=20`; 이름 부분 검색·페이지 |
| GET | `/{id}` | 원천·합성 표시값·override·OUT/UNKNOWN·수동 행·모든 구역 |
| PUT | `/{id}/stores/{storeId}/override` | `{values, clear, reason}`; set/clear 모두 이유 필수 |
| POST | `/{id}/stores` | 수동 가게 생성; EXACT 좌표 또는 REFERENCE 참조·상대위치·메모 |
| PUT | `/{id}/stores/{storeId}` | MANUAL 가게 수정 (입력 필드 전체 교체; 최초 작성 출처 유지) |
| DELETE | `/{id}/stores/{storeId}` | MANUAL 가게 삭제; 참조 또는 override가 남으면 거부 |
| PUT | `/{id}/zones` | MANUAL 구역 생성 |
| PUT | `/{id}/zones/{zoneId}` | 이름·종류·parentId·polygonWkt·buildingName·dong·floor·sortOrder 수정 |
| DELETE | `/{id}/zones/{zoneId}` | 참조 없는 AUTO/MANUAL 구역 삭제 |
| PUT | `/{id}/zones/order` | 시장의 모든 구역 ID를 한 번씩 담은 JSON 배열 |
| GET | `/{id}/changes` | `page=0`, `size=20`; 최신 ID 순 append-only 변경 이력 |
| POST | `/{id}/changes/{logId}/revert` | 현재 상태가 해당 이력의 after와 같을 때 before 복원·REVERT 이력 추가 |

override whitelist: `name`, `items`, `zoneId`, `membership`, `latitude`, `longitude`. 좌표는 set 또는 clear에서 항상 쌍을 받으며 명시적 null 쌍도 허용한다. `pinKind`, 가격, 원천 필드는 수정할 수 없다. 유효하지 않은 편집은 scoped advice가 400, stale revert 또는 원천 구역 키 재생성 충돌은 409로 응답한다. 시장 scope/ADMIN 전용 정책 위반은 403이다.

## 정합성·회귀 검증

- 모든 mutation은 `placeTransactionManager`의 한 트랜잭션에서 시장 행을 잠그고 편집과 전후 JSON/memberId/actorKind 로그를 함께 저장한다. ingest도 같은 시장 잠금에 참여한다.
- ONNURI/SANGGA 가게 직접 수정·삭제를 거부한다. MANUAL 수정은 최초 actor/member를 보존한다.
- REFERENCE는 같은 시장의 서로 다른 EXACT·IN·좌표 있는 참조 가게만 받는다. 공개 projection은 참조 가게 좌표로 표시하며 원천 좌표는 null로 유지한다. UNKNOWN/OUT 참조의 핀은 노출하지 않는다.
- 구역 parent cycle/타 시장 parent를 거부한다. WKT는 2D geographic POLYGON, 폐합·유한 범위·면적·자가교차·hole 포함/교차를 검증한다 (최대 총 2,001 vertices).
- zone assignment·override assignment·child·reference store가 남은 삭제/삭제 되돌리기를 거부한다. zone override `030`, `+30`도 숫자로 비교해 dangling reference를 막는다.
- 되돌리기는 현재 editorial state를 비교한다. DB DATETIME(6) 정밀도 차이에 따른 false conflict를 피하도록 createdAt을 비교에서 제외한다. 원천 키가 다른 ID로 재생성되었으면 원본 ID 복원을 거부한다.
- 삭제 복원은 place datasource의 JdbcTemplate으로 원래 ID·키·출처·nullable 값·enum 문자열을 parameter binding INSERT한다. 같은 place transaction에 참여한다.
- AC-5: 실제 editor와 ingest를 동일 MarketRepositoryAdapter 및 상태를 보관하는 MockK JPA repository들에 연결했다. 전후 MANUAL store **1→1**, MANUAL zone **1→1**, override **3→3**을 검사하고 행 전체 값, 자동 구역 이름·폴리곤·정렬이 유지되는지 확인했다. 원천 이름은 새 값으로 바뀌고 표시 이름은 override 그대로다.

## 검증 한계

Native restoration SQL은 mock JDBC의 INSERT 문장·bound ID·enum 문자열로 검증했다. 이번 지정된 Market 단위 테스트는 실제 MySQL에서 삭제→원래 ID 복원 또는 동시 트랜잭션 잠금/rollback을 실행하지 않는다. 운영 DB 마이그레이션·배포는 수행하지 않았다.
원천 AUTO 구역 삭제 후 ingest가 동일 source key를 다시 만들 수 있으며, 이때 과거 삭제 이력 되돌리기는 명시적으로 409이다.
