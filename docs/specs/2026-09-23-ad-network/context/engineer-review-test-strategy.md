# Engineer Review — test-strategy

- 대상: `docs/specs/2026-09-23-ad-network/spec.md` · `planning/test-quality.md` · `planning/requirements.md` · ADR-0098
- 기준: `docs/standards/test-rules.md` · 기존 폴드 모듈 테스트(engagement·content·atlas 컨텍스트 로드, blog·deal·game 스키마 통합, inventory 서비스 테스트) · CI 테스트 게이트
- KB: [[modular-monolith-fold]] (updated 2026-09-11) · [[gate-failure-modes]] (updated 2026-09-11)

## 잘 된 점

- 불변식부터 적었고 ★ 로 돈이 걸린 경로를 골라 두었다 (test-quality.md:4-5).
- 회귀 주입 목록이 있다 (test-quality.md:52-57). [[gate-failure-modes]] 「회귀를 주입해 빨간불을 본 뒤에 켰다고 말한다」를 따른다.
- 원장 불균형을 검사하지 않고 팩토리로 만들 수 없게 막았다 (spec.md:82, ADR-0098 §8). U1 도 그 전제로 짜여 있다.
- 운영 검증에 사람 UA와 저장된 행 수를 쓰도록 적었다 (test-quality.md:43).
- 레포 관례와 맞다: 폴드 모듈은 Testcontainers MySQL 을 쓰고 Docker 가 없으면 건너뛴다 (`blog/feature/build.gradle.kts:36-37`, `engagement/app/build.gradle.kts:24-25`, `EngagementContextLoadSpec.kt:28-32`). H2나 임베디드 DB는 쓰지 않는다.

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트가 있나 | **미흡** — R1, R2 |
| 2 | 테스트 레이어 배정 | **미흡** — R4, R5 |
| 3 | Mock 경계 | **미흡** — R3 |
| 4 | 테스트 데이터 전략 | **없음** — R6 |
| 5 | 음성·경계 케이스 | **미흡** — R2, R7 |
| 6 | 네이밍 규칙 | 경미 — R8 |

## 이슈

### R1 [체크 1] AC 가운데 테스트가 없거나 수동 검증뿐인 것이 있다

test-quality.md 표에 AC 열이 없어 대응 관계를 확인할 수 없다. 대조해 보면 아래가 비어 있다.

| AC / SR | 요구 | 현재 | 제안 |
|---|---|---|---|
| AC-1 (requirements.md:79) | 등록 시 `ad_advertiser` 행 생성, 전역 Role 불변 | 없음 | 서비스 테스트: 등록 후 member Role 을 바꾸는 포트 호출이 0회인지 `verify(exactly = 0)` 로 확인 |
| AC-3 (requirements.md:81) · SR-10 (spec.md:90) | 잔액이 0이면 다음 인덱스 갱신에서 후보에서 빠진다 | 없음 (U7 은 정지·기간·반려만 본다, test-quality.md:17) | U7 에 「지갑 0」 행 추가 + I6 과 같은 방식의 통합 테스트 |
| SR-3 (spec.md:38) | 입찰가가 지면 최저가 이상, 일예산이 1회 과금액 이상일 때만 저장 | 없음 | U 행 추가 (경계값 정확히 / −1) |
| AC-4 · SR-3 (spec.md:36) | 소재를 고치면 다시 `PENDING` | 없음 | U 행 추가 |
| AC-5 · SR-5 (spec.md:49) | 빈도 제한 도달, 지면·카테고리 불일치, Redis 실시간 지출로 예산 소진 시 후보 탈락 | U7 에 빠짐 | U7/I 에 행 추가. 예산 소진 차단은 SR-10:91 「정산이 늦어도 과다 게재가 되지 않는다」의 유일한 근거라 ★ |
| SR-5 (spec.md:53) | 같은 캠페인이 한 페이지에서 두 지면을 동시에 이기지 않는다 | 없음 | U 행 추가 (지면 2개 · 후보 1개 → 한 지면만 채움) |
| AC-6 (requirements.md:84) | FE 채움 순서: 유료 → AdSense → HOUSE → 숨김 | E2 CDP 수동 검증뿐 (test-quality.md:48) | portal-fe vitest 에 `AdSlot` 채움 순서 테스트. 이미 `frontend-gate` 가 돌린다 (`.github/workflows/ci.yml:207`) |
| AC-13 (requirements.md:91) | 리포트 수치가 정산 표와 같다 | E1 수동 비교뿐 (test-quality.md:47) | 통합 테스트: 같은 DeliveryHourly·원장 입력으로 리포트 쿼리 결과가 정산 합과 같은지 |
| AC-14 (requirements.md:92) | 반려 사유가 광고주에게 보이고, 광고주를 정지하면 모든 캠페인이 1분 안에 빠진다 | 승인만 있음 (I6, test-quality.md:30) | I6 에 정지·반려 사유 조회 행 추가 |
| AC-16 (requirements.md:94) | game 표·코드 제거 | E3 수동 검증뿐 | ① `ContentContextLoadSpec` 이 제거 뒤에도 뜬다 ② game 의 `ads` 테스트(`game/domain/.../ads/model/RewardGrantTest.kt`)를 함께 지운다 ③ 제거 마이그레이션을 적용한 뒤 `GameSchemaIntegrationSpec` 이 통과한다 |
| AC-17 · SR-14 (spec.md:111) | 발행 내용이 `entity_type=AD`, `action=IMPRESSION\|CLICK`, 지면 계층 | I10 은 실패만 본다 (test-quality.md:34) | 발행 페이로드 필드 단언 1행 (OQ-001 보류 시 함께 보류) |
| SR-16 (spec.md:121) · concepts F9 | `/privacy` 의 90일과 상수가 같다 | 없음 | `portal-fe/src/pages/__tests__/privacyRetention.test.ts:18-21` 의 `RETENTION_RUNNERS` 에 ads 보존 러너를 더하고 광고 이벤트 항목 단언 추가. 이 검사는 두 파일을 텍스트로 읽어 비교하므로 러너를 목록에 넣지 않으면 **ads 는 검사 대상이 아니다** |

수정안: test-quality.md 각 표에 `AC/SR` 열을 더하고, 위 행을 채운다.

### R2 [체크 1·5] ★ 돈이 새는 경로 둘이 테스트 계획에 없다

1. **Redis 카운터 → DeliveryHourly 반영의 멱등** — spec.md:71 「이미 더한 몫은 다시 더하지 않는다」. 정산(I2)은 DeliveryHourly 를 입력으로 받으므로, 이 반영이 두 번 되면 I2 가 초록인 채로 이중 청구가 난다. I1(토큰 중복)과 I2(정산 재실행) 사이의 구간이다.
   - 제안: ★I11 「반영 작업을 두 번 연속 실행하고, 중간 실패 뒤 재시도 → DeliveryHourly 합 = Redis 에 들어온 수」. 회귀 주입 목록에 「반영 뒤 차감(GETDEL/오프셋 기록)을 지우면 두 배가 잡히는지」를 추가한다.
2. **수익 배분 반올림** — spec.md:89 (퍼블리셔 68% / 네트워크 수수료), spec.md:32 (정수 마이크로). 홀수 청구액에서 두 몫의 합이 청구액과 1 마이크로 어긋나면 U1 의 팩토리가 거래를 거부한다. 거부되면 정산이 그 시각에서 멈춘다.
   - 제안: U10 「청구액 1·3·999,999 마이크로 → 두 몫의 합 = 청구액, 나머지는 정해진 쪽에 붙는다」.
   - 같은 이유로 CPM 과금 `입찰가/1000` (spec.md:70)의 정수 나눗셈 손실을 어느 단계에서 누적·절사하는지도 U 행 하나로 고정한다.

부수적으로, 하루 한 번 도는 원장 합 0 검사(spec.md:84)는 회귀 주입 목록(test-quality.md:57)에만 있고 테스트 표에는 없다. I 행으로 올린다.

### R3 [체크 3] Redis 테스트 방식이 정해지지 않았다. Mock 이면 ★ 게이트가 자기 근거를 잰다

- test-quality.md:21 은 「Testcontainers MySQL·Redis **또는** 기존 테스트 방식」이다. 레포 카탈로그에는 Redis Testcontainers 모듈이 없다 (`gradle/libs.versions.toml:111-114`: junit·mysql·clickhouse·kafka뿐). 테스트 소스에도 Redis 컨테이너 사용처가 없고, 기존 방식은 `StringRedisTemplate` 을 MockK 로 바꾸는 것이다 (`common/src/test/kotlin/com/kgd/common/quota/ExternalApiQuotaLedgerSpec.kt:26-27`).
- ★I1 (test-quality.md:25)의 근거는 Redis `SETNX` 의 원자성이다. 이 부분을 Mock 으로 하면 회귀 주입 「SETNX 를 지우고 이중 과금이 잡히는지」(test-quality.md:55)는 **테스트가 짠 Mock 응답**을 재게 된다 ([[gate-failure-modes]] ④). 빈도 제한·실시간 예산 차단(SR-5:55)도 같다.
- ★I3 (test-quality.md:27) 「동시 정산 + 셀프 충전에서 갱신 유실 없음」은 실제 MySQL 에서 여러 스레드로만 성립한다. Port 를 Mock 으로 두면 동시성을 검증하지 못한다.
- 수정안:
  - 규칙을 한 줄로 고정한다 — 「I1·I3·I4·빈도/예산 차단은 **실제 Redis·MySQL** 컨테이너, 나머지 서비스 로직은 Port MockK」.
  - Redis 는 `testcontainers` core 의 `GenericContainer("redis:7")` 로 띄운다(`testcontainers-junit` 이 core 를 끌어온다). 새 카탈로그 항목을 추가해야 하면 그렇게 적는다.
  - Docker 가 없으면 건너뛰는 방식은 `EngagementContextLoadSpec.kt:28-32` 와 같게 한다.
  - I4 (Redis 중단)는 컨테이너를 멈추거나 닫힌 포트로 연결하는 방식이 Mock 으로 예외를 던지는 방식보다 실제 타임아웃·예외 모양에 가깝다. 어느 쪽을 쓸지 적는다.

### R4 [체크 2] C1 이 기존 폴드 검증 관례보다 약하다

- 현재 `EngagementContextLoadSpec` 은 `spring.flyway.enabled=false`, `ddl-auto=create` 로 뜨고 컨트롤러 등록을 확인하지 않는다 (`engagement/app/src/test/kotlin/com/kgd/engagement/EngagementContextLoadSpec.kt:37-47, 59-86`). C1 이 「기존 컨텍스트 테스트 통과」(test-quality.md:40)라면 ads 의 스캔 누락(조용한 404)을 잡지 못한다.
- 수정안 (셋 다 기존 선례가 있다):
  1. `EngagementContextLoadSpec` 에 「ads 컨트롤러가 빈으로 등록된다」를 추가한다. 선례: `content/app/src/test/kotlin/com/kgd/content/ContentContextLoadSpec.kt:89`, `atlas/app/.../AtlasContextLoadSpec.kt:86`. 같은 곳에서 `adsDataSource` 가 MySQL 이고 experiment 의 연결과 다른지도 확인한다 (기존 :72-78 과 같은 방식).
  2. `AdsSchemaIntegrationSpec` 을 만든다. 전용 Flyway(`adsdb/migration`) + `ddl-auto=validate` 조합이고, 선례는 `blog/feature/.../BlogSchemaIntegrationSpec.kt:44-52` 다. 운영은 `none` 이라 엔티티와 스키마 불일치가 거기서는 드러나지 않는다 ([[modular-monolith-fold]] 「검증 방법」).
  3. **값으로 판정하는 쓰기 테스트**를 하나 둔다. `@Transactional("adsTransactionManager")` 한정자가 빠지면 experiment 의 primary TM 에 붙어 쓰기가 조용히 사라진다 ([[modular-monolith-fold]] 4번, deal 클릭 수가 며칠간 0이던 사례). 충전 뒤 지갑 잔액이 실제로 늘었는지를 본다. I5 를 실제 어댑터로 돌리면 이 역할을 겸한다.
- 덧붙여 OQ-003 에 따라 `ADS_TOKEN_SECRET` 이 없으면 기동이 실패하도록 할 것이므로, 컨텍스트 로드 테스트 properties 에 테스트 키를 넣어야 한다. 「키가 없으면 기동 실패」 자체도 U/I 한 행으로 증명한다 (주입: 키 검사를 지우면 빨간불).

### R5 [체크 2] ads 테스트가 CI 에서 실제로 도는지 확인하는 항목이 없다

- 이미지 게이트는 생성물(`scripts/ci/topology.sh:30`)이 태스크 목록을 정한다. 지금 engagement 목록은 experiment·recommendation 뿐이다. `generateTopology` 를 다시 돌려 `:ads:domain:test :ads:feature:test` 가 들어가야 하고, `verifyTopologyGenerated` 가 그것을 지킨다.
- PR 게이트 `.github/workflows/ci.yml:159-199` 는 손으로 쓴 매핑이다. `ads/*` 도 `engagement` 도 없어서 **ads 를 바꾼 PR 에서 ads 테스트가 한 건도 돌지 않는다** ([[gate-failure-modes]] ⑨ 「태스크 목록이 대상을 안 담는다」).
- 수정안: 테스트 계획에 「CI 로그의 `Gradle test tasks:` 줄에 `:ads:feature:test` 가 있다」를 검증 항목으로 넣는다. ci.yml 에 `ads/*` 매핑을 더하는 것은 ads 가 성립하려면 필요하므로 이번 범위다.
- (보고만) 같은 ci.yml 매핑은 이미 engagement 폴드를 따라가지 못하고 있다. `experiment/*` 가 없는 `:experiment:app:test` 로 매핑된다 (ci.yml:169, 199). ads 와 무관한 부채라 진행 여부를 따로 묻는다.

### R6 [체크 4] 테스트 데이터와 시계 전략이 없다

- 픽스처·빌더에 대한 언급이 없다. 금액이 전부 정수 마이크로이고(spec.md:32) 엔티티가 7종 이상이라, 테스트마다 직접 조립하면 단위 실수(크레딧과 마이크로 혼동)가 테스트 안에서 난다. 선례: `quant/feature/src/test/kotlin/com/kgd/quant/application/backtest/BacktestFixtures.kt`.
- 시간에 의존하는 규칙이 여섯이다: KST 자정 충전 한도(spec.md:30), 페이싱 경과 비율(spec.md:52), 토큰 30분 만료(spec.md:66), 클릭 10분 창(spec.md:76), 매시 정산(spec.md:87), 인덱스 1분 갱신(test-quality.md:30 「새로고침 주기 뒤」). `sleep` 에 기대면 느리고 결과가 들쭉날쭉하다.
- 수정안: ① 도메인·서비스는 `Clock`(또는 시각 인자)을 주입받는다고 스펙에 명시한다 ② I6 은 대기하지 말고 갱신을 직접 호출한다 ③ `AdsFixtures`(광고주·캠페인·소재·지면·마이크로 금액 상수)를 test-quality.md 에 적는다.

### R7 [체크 5] 경계 케이스 보강

| 근거 | 케이스 |
|---|---|
| spec.md:30 · I5 | 충전 한도의 **KST 자정 경계**: 23:59:59 와 00:00:00 에 한도가 초기화되는지. UTC 로 잘못 자르면 9시간 어긋난다 (time-in-kst) |
| spec.md:88 · U2 | 「그날 일예산 잔여」가 **앞 시각들의 정산 누계**에서 나오는지. 두 시각을 연속 정산해 합이 일예산을 넘지 않는지. U2 는 잔여를 입력으로 받아 이 계산을 거치지 않는다 |
| spec.md:68 | 일회성 표식의 TTL 이 토큰 수명보다 짧으면 재사용이 통과한다. 표식 TTL ≥ 토큰 만료를 설정값끼리 비교하는 테스트 |
| spec.md:68 | `sendBeacon` 묶음 안에 유효·위조·중복이 섞였을 때 **부분 수락**. 유효한 것만 과금되고 사유별 카운트가 맞는지 |
| spec.md:101 | HOUSE 캠페인은 예산·과금 검사를 건너뛰고 원장 행을 만들지 않는다 |
| spec.md:50 | eCPM 계산이 `Double` 이면 CPC 끼리 동점 판정이 흔들린다. 동점 결정성 테스트는 같은 입력을 여러 번 넣고 결과 순서가 같은지로 본다 |
| spec.md:67 | 가시 노출 판정은 「`tracker.ts` 와 **같은 것**을 쓴다」. 광고 쪽 테스트가 판정 함수를 복사하지 않고 같은 함수를 import 하는지 (`portal-fe/src/analytics/__tests__/tracker.test.ts` 옆에 두면 된다) |

### R8 [체크 6] 테스트 파일 이름을 정해 둔다 (경미)

`test-rules.md:17` 은 「구현체 이름 + `Test`」다. 폴드 통합 검사는 `*Spec` 을 쓴다 (`EngagementContextLoadSpec`, `BlogSchemaIntegrationSpec`). test-quality.md 에는 파일 이름이 하나도 없어 구현 때 섞일 수 있다. 제안: 단위·서비스는 `{구현체}Test`, 컨텍스트·스키마·컨테이너 통합은 `{대상}Spec` 으로 적는다. 새 파일을 만들지 않고 기존 `EngagementContextLoadSpec` 에 추가한다는 점도 명시한다.

## 결론

설계 결정과 코드·문서가 충돌하는 곳은 없다. 테스트 계획을 보강하면 되는 비차단 이슈 8건이다. 그중 R2·R3 은 돈이 걸린 ★ 경로라 구현 전에 반영해야 한다.

VERDICT: REVISE

---

# Round 2 — 개정 2 재검토 (2026-09-23)

- 대상: spec.md 개정 2 · planning/test-quality.md 개정 2 · planning/requirements.md · context/open-questions.yml · ADR-0098
- 코드 대조: `gradle/libs.versions.toml:16,111-114` · `engagement/app/build.gradle.kts:24-25` · `EngagementContextLoadSpec.kt` · `WishlistDataSourceConfig.kt:64-73` · `ScopedFlywayMigrator.kt:23-39` · 루트 `build.gradle.kts:700-731, 835, 904` · `.github/workflows/ci.yml:159-205` · `GatewayRoutingSpec.kt` · `GatewayRouteConfig.kt:215-218` · `privacyRetention.test.ts` · `useImpression.ts:13-15`

## 1. Round 1 이슈 해소 확인

| # | 판정 | 근거 (새 줄) |
|---|---|---|
| R1 | **일부 해소** | AC 열과 대응표가 생겼다 (test-quality.md:18-110). U9 가 소재 수정 뒤 PENDING 복귀를(:28), U4 가 같은 캠페인의 두 지면 낙찰 금지를(:23), F1 이 채움 순서를(:70), I16 이 리포트와 정산의 일치를(:53), I6 이 정지·반려를(:43) 다룬다. AC-17 페이로드 검사(:107)와 F5(:74)도 들어왔다. **남은 것 → R2-1·R2-2·R2-3** |
| R2 | **일부 해소** | 절대값 UPSERT 로 설계를 바꾸고 ★I5 를 뒀다 (spec.md:98, test-quality.md:42, 회귀 주입 :119). U3 는 floor + 나머지를 검사하고(:22, spec.md:109), I17 은 원장 합 0 검사기를 검사한다(:54). **CPM 1회 과금액의 절사 → R2-4** |
| R3 | **해소** | 실제 Redis·MySQL 로 돌린다고 적었다 (test-quality.md:10). `GenericContainer` 는 추가 카탈로그 없이 쓸 수 있다: `testcontainers-junit`(`org.testcontainers:junit-jupiter` 1.20.4, libs.versions.toml:111)이 core `org.testcontainers:testcontainers` 를 전이 의존으로 가져오고, engagement 는 이미 그것을 쓴다(build.gradle.kts:24) |
| R4 | **거의 해소** | C1 은 ads 컨트롤러 빈 등록과 쓰기 값을 보고(test-quality.md:61), C2 는 `AdsSchemaIntegrationSpec` 이다(:62). 테스트 properties 에 키를 넣는다(:14). ads Flyway 는 `ScopedFlywayMigrator` 의 자체 토글을 쓰므로 스펙의 `spring.flyway.enabled=false`(EngagementContextLoadSpec.kt:40)와 무관하게 돈다(`ScopedFlywayMigrator.kt:26,31`, 선례 `WishlistDataSourceConfig.kt:67`). **판정 값과 기동 실패 증명 → R2-5** |
| R5 | **일부 해소** | `generateTopology` 를 다시 돌리고(spec.md:23) ci.yml 에 `ads/*` 를 추가한다(spec.md:153). 기존 부채는 OQ-004 로 분리했다(open-questions.yml:29-36). **매핑 내용과 CI 로그 확인 → R2-6** |
| R6 | **해소** | `Clock` 주입과 인덱스 직접 호출, 페이싱 난수 주입을 적었다(test-quality.md:11). `AdsFixtures` 도 있다(:12). 스펙에도 같은 내용이 있다(spec.md:41, :68) |
| R7 | **거의 해소** | KST 자정(U12 :31), 누계 일예산(U2 :21), 부분 수락(I11 :48), HOUSE 원장 0(I13 :50), 동점 결정성(U4 :23)이 들어왔다. 일회성 표식 TTL(I12 :49)과 가시 노출 사본 금지(F4 :73)는 **판정 방식에 문제가 있다 → R2-9·R2-11** |
| R8 | **해소** | 이름 규칙과 기존 스펙 확장을 적었다 (test-quality.md:13) |

## 2. 남은 이슈 (Round 1 에서 이어짐)

### R2-1 ★ [체크 1·5] AC-5·AC-3 의 후보 차단 경로 넷이 여전히 비어 있다

AC-5(requirements.md:83)와 SR-6 후보 자격(spec.md:64-65) 가운데 아래 넷은 대응 테스트가 없다. U5(test-quality.md:24)는 최저가와 형식 불일치만 보고, I15(:52)는 시간당 상한만 본다.

| 차단 조건 | 근거 | 현재 |
|---|---|---|
| 방문자 빈도 제한 도달 | spec.md:64 | 없음. I13(:50)은 HOUSE 가 빈도와 무관하다는 반대쪽만 본다 |
| 카테고리 불일치, 매핑 없으면 호스트 기본 카테고리 | spec.md:58, :64 | 없음 |
| Redis 실시간 지출로 일예산·총예산 소진 | spec.md:64 | 없음 |
| 지갑 여유 = 스냅샷 잔액 − Redis 미정산 지출 ≤ 0 | spec.md:65 | 없음. 대응표는 AC-3 을 U8·E1 에 매핑했지만(:91) U8 은 캠페인 상태 전이 테스트다. 「잔액이 비면 게재가 멈춘다」(requirements.md:81)를 검사하는 테스트가 없다 |

원칙 줄(test-quality.md:10)은 「차단 경로는 실제 Redis」라고 하지만, 정작 그 경로를 도는 I 행이 없다.
수정안: ★I19 한 행에 넷을 담는다. 조건마다 Redis 에 값을 심고 결정을 부르면 그 캠페인이 탈락해야 한다. 빈도 제한은 한도 N 에서 N−1 이면 통과, N 이면 탈락하는 경계로 본다. 회귀 주입도 하나 둔다: 스크립트에서 미정산 지출 차감을 빼면 지갑이 빈 광고주가 낙찰되는 것이 잡혀야 한다.

### R2-2 [체크 1·5] 저장 불변식을 검사하는 행이 없다

spec.md:49 의 불변식은 「입찰가 ≥ 타기팅한 **모든** 지면의 최저가, 일예산 ≥ 1회 과금액」이다. U5(:24)는 **저장 뒤** 최저가가 오른 경우만 결정 단계에서 본다. 저장할 때 거부하는 경로를 검사하는 행이 없다.
수정안: U 행을 추가한다. 경계는 둘이다. 지면 두 개 가운데 한 곳의 최저가에만 1 마이크로 모자라면 거부된다. 최저가와 정확히 같으면 저장된다.

### R2-3 [체크 1] 작은 공백 셋

- AC-1(requirements.md:79)의 「전역 Role 불변」을 대응표는 「I14 스위트 안」에 맡겼다(test-quality.md:89). 그런데 I14 행(:51)의 시나리오에는 등록도 Role 도 없다. 행에 적어 둔다: 등록 뒤 `ad_advertiser` 행이 1개 생기고, member Role 변경 포트는 0회 불린다.
- AC-14 「반려 사유가 광고주에게 보인다」(requirements.md:93) — I6(:43)은 후보에서 빠지는지만 본다. 광고주 API 로 소재를 조회해 사유 코드가 오는지 확인하는 단언 하나가 필요하다.
- `ADS_TOKEN_SECRET` 이 없으면 기동이 실패한다(OQ-003). 이 동작을 증명하는 행이 없다. 키 없이 설정 빈을 만들면 예외가 나는지를 U 한 행으로 본다.

### R2-4 ★ [체크 5] CPM 1회 과금액의 정수 절사가 스펙에서 사라졌고 테스트도 없다

개정 1 에는 `입찰가/1000` 이 있었다(옛 spec.md:70). 개정 2 에는 순위용 eCPM(spec.md:66)만 남았다. requirements.md:62 도 「천 회」라고만 한다. 입찰가는 천 회당 마이크로인데, 노출 하나의 지출(spec.md:94 카운터)을 정수로 어떻게 만드는지 정해져 있지 않다. 1회 절사를 택하면 1,500,500 마이크로 입찰이 노출당 1,500 이 되어 천 회에 500 마이크로가 빈다. 시간 단위로 `노출수 × 입찰가 / 1000` 을 한 번 절사하는 방식과는 청구액이 다르다. 일예산 ≥ 1회 과금액 불변식(spec.md:49)과 토큰의 「가격」 필드(spec.md:74)도 이 값에 기대고 있다.
수정안: 스펙에 한 줄로 정한다. 예: 「토큰 가격 = 1회 과금액 = floor(입찰가/1000), 입찰가는 1000 의 배수만 허용」처럼 절사 손실을 아예 없애는 쪽. 그리고 U 행 하나로 고정한다.

### R2-5 ★ [체크 2] C1 의 판정 값을 정하지 않으면 회귀 주입이 빨간불을 못 볼 수 있다

- test-quality.md:61 의 기대값은 「행 존재」다. 루트 게이트는 조용히 사라지는 쓰기를 `@Modifying` 이라고 짚는다(`build.gradle.kts:701-702`). 호스트 스펙이 `com.kgd.ads.application.` 진입점을 부르는지도 문자열로 본다(:724-729). 새 행 INSERT 를 `repository.save` 로 하면 SimpleJpaRepository 가 자기 TM 으로 커밋한다. 그러면 한정자를 지워도 행이 남아 회귀 주입(test-quality.md:120)이 초록으로 끝난다. 이것은 「안 무는 검사」다.
- 수정안: C1 의 진입점을 **충전 UseCase**(또는 5분 UPSERT)로 못박는다. 판정은 「지갑 계정 행의 잔액이 충전액만큼 늘었다」 또는 「집계 행 값」으로 한다. 행이 있는지만 보지 않는다. 주입 시험은 `./gradlew :engagement:app:test --tests '*EngagementContextLoadSpec'` 로 돌린다. `verifyTransactionQualifiers` 는 `check` 에만 걸려 있어(`build.gradle.kts:904`) 이 명령에서는 먼저 막지 않는다. 그러니 C1 자체가 빨간불을 내는지 이 명령으로 확인할 수 있다.

### R2-6 ★ [체크 2] ci.yml `ads/*` 매핑이 기본 분기로 가면 CI 가 없는 태스크를 부른다

- spec.md:153 은 「`ads/*` 추가」라고만 적었다. ci.yml 의 기본 분기는 `:${svc}:app:test :${svc}:domain:test` 다(ci.yml:199). `ads/*) SVCS+=" ads"` 로 넣으면 `:ads:app:test` 가 불린다. 그 태스크는 없어서 ads PR 이 전부 실패한다. commerce 가 같은 이유로 태스크를 따로 적었다(ci.yml:196-198).
- ads 를 바꾼 PR 에서 **C1(EngagementContextLoadSpec)** 도 돌아야 한다. 한정자 결함을 잡는 검사는 이것뿐이다.
- 수정안: spec.md:153 에 태스크를 명시한다 — `ads/*) → :ads:domain:test :ads:feature:test :engagement:app:test`. 테스트 계획의 검증 항목에는 「첫 ads PR 의 CI 로그 `── Gradle test tasks:` 줄(ci.yml:203)에 위 셋이 있다」를 더한다. Round 1 에서 요청한 항목인데 test-quality.md 에 아직 없다.

## 3. 개정으로 새로 생긴 이슈

### R2-7 [체크 2·3] ads 스케줄러가 컨텍스트 테스트와 통합 테스트에서 켜진다

- SR-1 은 ads 가 `@EnableScheduling` 을 켠다고 한다(spec.md:26). 토글은 없다. 지금 engagement 에는 `@Scheduled` 가 하나도 없어서 이 설정으로 켜지는 것은 ads 작업뿐이다(recommendation·experiment·engagement 소스 grep 0건). 그 작업은 인덱스 1분 갱신, 5분 UPSERT, 매시 정산, 일일 합 검사다.
- `EngagementContextLoadSpec` 은 Redis 를 `localhost` 기본 포트로 향하게 하고 컨테이너는 띄우지 않는다(`EngagementContextLoadSpec.kt:41-42`). 기동 때 인덱스를 적재하거나 fixedDelay 작업이 바로 돌면 연결 오류가 난다. 적재가 동기라면 컨텍스트 자체가 뜨지 않는다.
- ★I2·I5 는 작업을 직접 두 번 부르는 테스트다(test-quality.md:39,42). 스케줄러가 같이 돌면 실행 횟수를 테스트가 통제하지 못하고 결과가 들쭉날쭉해진다.
- MySQL 컨테이너는 `experiment_db` 하나만 만든다(`EngagementContextLoadSpec.kt:95`). `ads.datasource.*`(test-quality.md:14)가 가리킬 `ads_db` 를 어떻게 만드는지도 정해야 한다. JDBC URL 에 `createDatabaseIfNotExist=true` 를 붙이거나 같은 DB 를 쓰는 방법이 있다.
- 수정안: 스케줄링 설정 클래스에 `@ConditionalOnProperty("ads.scheduling.enabled", matchIfMissing = true)` 를 붙인다. 테스트 properties 에서는 `false` 로 둔다. test-quality.md:11 원칙에 「배치는 테스트에서 끄고 직접 호출한다」를 한 줄로 더한다.

### R2-8 [체크 5] I4 의 「250ms 안에」는 설정한 타임아웃과 같은 값이라 들쭉날쭉하다

- test-quality.md:41 은 Redis 가 멈춘 상태에서 250ms 안에 돌아오기를 기대한다. 명령 타임아웃이 바로 250ms 이고 연결 타임아웃은 500ms 다(spec.md:32).
  - 연결을 맺은 뒤 컨테이너를 멈추면 Lettuce 는 명령을 큐에 넣고 **250ms 가 지난 뒤** 실패한다. 여기에 직렬화·스레드 전환이 더해지므로 250ms 를 넘는 것이 정상이다.
  - 처음부터 Redis 가 없으면 연결 타임아웃 500ms 가 적용되어 이 기대값을 절대 맞출 수 없다.
- 수정안: 시나리오를 「연결 뒤 컨테이너 정지」로 고정한다. 공유 컨테이너를 멈추면 같은 스펙의 다른 테스트가 깨지므로 I4 전용 컨테이너를 쓴다. 기대값은 사유 `redis_unavailable`, 200 응답, 수락 0 으로 둔다. 시간 상한을 둔다면 「명령 타임아웃 + 여유(예: ≤ 500ms)」로 잡고, 60초 기본값으로 되돌아간 회귀만 잡게 한다. 지연 SLA 는 E4 가 맡는다.

### R2-9 [체크 5] I12 는 `Clock` 으로 Redis TTL 을 움직일 수 없다

test-quality.md:49 는 「만료 직전 재사용도 거절」을 기대한다. 시간은 `Clock` 주입으로 다룬다(:11). 하지만 Redis 키의 TTL 은 서버 실시간으로 흐른다. 토큰 수명 2시간 직전을 재현하려면 실제로 2시간을 기다려야 한다.
수정안: 판정 근거를 **대상이 내놓은 값**으로 바꾼다. 이벤트를 하나 수락한 뒤 실제 Redis 의 일회성 키 `PTTL` 이 「토큰 수명 − 발급 뒤 경과」 이상인지 본다(spec.md:76 은 3시간 ≥ 2시간). 회귀 주입은 TTL 설정을 1시간으로 낮추는 것이다. 그러면 빨간불이 나야 한다.

### R2-10 ★ [체크 2·3] C3·C4 를 지금 게이트웨이 테스트 기반에서는 적힌 대로 돌릴 수 없다

- `GatewayRoutingSpec` 은 「백엔드로 실제 프록시되는 경로는 이 스펙에서 다루지 않는다」고 스스로 밝힌다(`GatewayRoutingSpec.kt:16-18`). 라우트 목적지는 `http://engagement:8091` 로 고정돼 있어 테스트에서 스텁으로 바꿀 속성이 없다(`GatewayRouteConfig.kt:218`, `application.yml:43`). 그래서 C3 의 「`X-User-Id` 제거·주입」(test-quality.md:63)을 전달된 헤더로 확인할 방법이 없다.
- C4(:64)의 「C3 필터를 거친 요청으로 결정 → 이벤트 제출 → 과금 0」은 gateway JVM 과 engagement JVM 을 모두 거친다. 한 테스트 프로세스에 들어가지 않는다. 이대로 두면 구현 때 C4 를 건너뛰거나, SR-8(spec.md:84)이 금지한 「헤더를 직접 넣는 테스트」로 대신하게 된다.
- 수정안: 세 조각으로 나누고 계획에 그대로 적는다.
  1. C3 는 라우트를 전수로 검사한다. ads 공개 라우트 id 에 `AuthenticationGatewayFilter`(`required=false`)가 걸려 있는지, 캐치올보다 먼저 선언됐는지를 본다. 선례는 `GatewayRoutingSpec.kt:107-116` 이다. 헤더 제거·주입은 기존 `AuthenticationGatewayFilterTest` 에 게스트 설정 케이스를 더해 확인한다.
  2. C4 의 ads 쪽은 서비스 테스트로 한다. 결정 요청 신원이 소유자면 토큰의 과금 여부가 false 로 서명되고, 그 토큰으로 이벤트를 넣으면 `not_billable` 이 나오는지 본다.
  3. 둘을 잇는 증명은 운영 검증 **E5** 로 둔다. 로그인한 광고주가 자기 광고를 본 뒤 `not_billable` 거절 수가 늘고 그 캠페인 지출이 0 인지를 **저장된 값**으로 확인한다(measurement-needs-human-ua).
  - SR-8:84 의 「헤더 직접 주입만으로는 통과시키지 않는다」는 이 조합으로 충족된다고 스펙에 적는다.

### R2-11 [체크 3] F4 의 판정 근거가 자기 사본이 될 수 있다

test-quality.md:73 은 「`useImpression` 의 상수를 import 해서 쓰는지(사본 없음)」를 FE 단위 테스트로 본다. 사본도 값은 같아서(`VISIBLE_RATIO = 0.5`, `DWELL_MS = 1_000`, `useImpression.ts:13-15`) 값을 비교하는 테스트로는 사본을 구별할 수 없다. 테스트가 0.5 를 직접 적어 비교하면 그 검사는 테스트 자신을 재게 된다.
수정안: 사본을 만들 수 없는 구조로 바꾼다. 광고 카드는 자체 IntersectionObserver 없이 **`useImpression` 훅을 그대로** 쓴다(spec.md:87 을 「상수」에서 「훅」으로 고친다). F4 는 동작으로 판정한다. IntersectionObserver 를 모킹해 가시 비율 0.49 로 1초가 지나면 비콘이 없고, 0.5 로 1초가 지나면 비콘이 1회 나가는지 본다. 회귀 주입으로 `useImpression.ts` 의 상수를 바꾸면 이 테스트가 빨간불을 내야 한다.

### R2-12 [체크 1] F5 는 지금 헬퍼로 「25시간」을 읽지 못한다

`privacyRetention.test.ts` 가 값을 읽는 방법은 `RETENTION_RUNNERS` 파일에서 `const val X = (\d+)L` 을 **일 단위**로 뽑는 것 하나다(:18-27). 빈도 키 TTL 25시간(spec.md:101)은 시간 단위이고 러너 파일에 있지도 않다. 「설정값」이라서 yml 에 있다면 이 방식으로는 아예 읽을 수 없다. F5(test-quality.md:74)를 이대로 구현하면 테스트에 25 를 직접 적게 되고, 그러면 자기 근거를 재는 검사가 된다. 이 파일의 주석(:8-10)이 바로 그것을 경고한다.
수정안: 스펙에 상수의 자리와 모양을 정한다. 예: `ads/feature/.../FrequencyCapPolicy.kt` 의 `const val FREQUENCY_KEY_TTL_HOURS = 25L`, 설정으로 빼지 않는다. F5 에는 「그 파일을 읽는 시간 단위 추출기를 추가한다」를 적는다. 회귀 주입은 상수를 24 로 바꾸는 것이고, 빨간불이 나야 한다.

## 4. 체크리스트 판정 (Round 2)

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트 | 미흡 — R2-1, R2-2, R2-3, R2-12 |
| 2 | 테스트 레이어 배정 | 미흡 — R2-5, R2-6, R2-7, R2-10 |
| 3 | Mock 경계 | 대체로 통과. 판정 근거 문제 R2-10, R2-11 |
| 4 | 테스트 데이터 전략 | 통과 |
| 5 | 음성·경계 케이스 | 미흡 — R2-1, R2-4, R2-8, R2-9 |
| 6 | 네이밍 규칙 | 통과 |

## 결론 (Round 2)

Round 1 의 R3·R6·R8 은 해소됐고 R4·R7 은 거의 해소됐다. 남은 것은 12건이다. 5건은 Round 1 에서 이어졌고 7건은 개정으로 새로 생겼다. 스펙 결정이 코드나 문서와 충돌해 사람의 판단이 필요한 차단 사안은 없다.

★ 는 다섯 건이다. R2-1(후보 차단 경로)과 R2-4(CPM 절사)는 돈이 걸렸다. R2-5(C1 판정 값), R2-6(ci.yml 이 없는 태스크를 부름), R2-10(C3·C4 실행 방법)이 빠지면 게이트가 물지 않거나 CI 가 깨진다.

전부 스펙이나 테스트 계획에 한두 줄을 고치면 되는 수준이다. 체크리스트의 REVISE 는 최대 두 라운드이므로 세 번째 리뷰를 돌리지 않는다. 이 12건은 tasks 단계에서 반영하고 구현 착수 전에 확인할 것을 권한다.

VERDICT: REVISE

---

# Round 3 — 개정 3 최종 재검토 (2026-09-23)

- 대상: spec.md 개정 3 · planning/test-quality.md 개정 3(전면 재작성) · planning/requirements.md · context/open-questions.yml · ADR-0098
- 코드 대조: `KgdMessagingOutboxAutoConfiguration.kt:37-46` · `.github/workflows/ci.yml:159-205` · `EngagementContextLoadSpec.kt:37-111` · `GatewayRoutingSpec.kt:16-18,107-116` · `gateway/src/test/.../filter/AuthenticationGatewayFilterTest.kt`(존재) · `privacyRetention.test.ts:18-30` · `game/feature/src/test/.../GameSchemaIntegrationSpec.kt`(존재)
- 이번 라운드가 마지막이다. 새로 생긴 **중대한** 결함만 적고, 나머지는 tasks 단계 이월 항목으로 둔다.

## 1. Round 2 이슈 해소 확인

| # | 판정 | 근거 (개정 3 줄) |
|---|---|---|
| R2-1 ★ | **해소** | ★I8 이 네 경로(빈도 도달·카테고리 불일치·실시간 지출로 일예산 소진·지갑 여유 ≤ 0)를 실제 Redis 로 본다(test-quality.md:50). 지갑 여유 식은 U17 이 맡는다(:37, spec.md:68). AC-3 대응표도 I8 로 바뀌었다(:109). 빈도 N−1/N 경계와 회귀 주입 한 줄은 빠졌다 → 이월 C-1 |
| R2-2 | **해소** | U10 이 저장 불변식을 본다(test-quality.md:30, spec.md:51) |
| R2-3 | **해소** | I18 이 AC-1 을(:60), I19 가 반려 사유 노출을(:61), C3 가 시크릿 없음·32바이트 미만일 때 기동 실패를(:73) 본다. I18 의 판정 방식은 → 이월 C-5 |
| R2-4 ★ | **해소** | 스펙이 `floor(CPM 입찰 / 1000)` 과 최저가 하한을 정했다(spec.md:52). ★U4 가 999·1000·1001 로 고정한다(test-quality.md:24). 최저가 하한 1000 마이크로를 어디서 강제하는지는 → 이월 C-2 |
| R2-5 ★ | **해소** | C1 이 충전 진입점을 부르고 잔액을 다시 읽어 판정한다(test-quality.md:71). 회귀 주입도 잔액 불일치다(:140). 충전은 지갑 원장 계정 행을 `FOR UPDATE` 로 잠그고 잔액을 고친다(spec.md:40, :115). 한정자가 빠지면 잠금 질의가 트랜잭션 밖에서 실패하거나 더티 체킹이 반영되지 않는다. 어느 쪽이든 빨간불이다 |
| R2-6 ★ | **해소** | 세 태스크를 명시했고(spec.md:161, test-quality.md:132) CI 로그 확인도 적었다. ci.yml 에서는 `commerce` 처럼 TASKS 쪽 case 에 `ads)` 분기를 따로 두어야 한다(ci.yml:196-199) — 스펙 문구가 그 뜻이다 |
| R2-7 | **해소** | `@EnableScheduling` 을 더하지 않고 `ads.scheduling.enabled` 토글을 둔다(spec.md:26). 테스트는 끈다(test-quality.md:12). `ads_db` 는 컨테이너 init 으로 따로 만든다(:13). 스케줄링의 실제 출처는 → 이월 C-3 |
| R2-8 | **해소** | 기대값이 「1초 안」이 되어 타임아웃 값(250/500ms)과 겹치지 않는다(test-quality.md:46) |
| R2-9 | **해소** | TTL 은 `PTTL` 로 판정한다고 원칙에 적었다(test-quality.md:11). I15 가 그 방식이다(:57) |
| R2-10 ★ | **해소** | C4(라우트 표 전수)·C5(필터 단위)·C6(ads 서비스)·E5(실제 게이트웨이 경유, 저장된 값)로 나눴다(test-quality.md:74-78, :100). C5 를 넣을 `AuthenticationGatewayFilterTest` 가 있다. Host 조건 판정 방식은 → 이월 C-4 |
| R2-11 | **해소** | 스펙이 「훅을 그대로 쓴다」로 바뀌었다(spec.md:95). F5 는 IntersectionObserver 모의로 동작을 판정한다(test-quality.md:88). 회귀 주입도 있다(:142) |
| R2-12 | **거의 해소** | F6 이 `VISITOR_FREQUENCY_TTL_HOURS = 25L` 을 읽고, 헬퍼가 시간 단위도 읽도록 확장한다. 테스트에 25 를 적지 않는다(test-quality.md:89). 상수가 있는 파일 경로는 아직 정하지 않았다 → 이월 C-6 |

## 2. 개정 3 에서 새로 생긴 중대 이슈

**없다.** 개정 3 에서 새로 들어온 결정은 여섯이다. 스케줄링을 공용 설정에 맡긴 것, 스케줄러 풀 4, 정산 따라잡기(I6), 수락 단계 상한(I7), 거대 PNG 헤더 거절(U12), Host 조건으로 rt 를 막는 것(C4·E6)이다. 모두 대응 테스트가 있고 판정 근거가 대상의 산출물이다. 스펙 결정과 코드·문서가 충돌하는 곳도 찾지 못했다.

## 3. 이월 항목 (tasks 작성 때 한 줄씩 반영)

| # | 근거 | 내용 |
|---|---|---|
| C-1 | test-quality.md:50, :138-142 | I8 의 빈도 조건은 한도 N−1 이면 통과하고 N 이면 탈락하는지 경계로 본다. 회귀 주입 목록에 「지갑 여유 계산에서 미정산 지출 차감을 빼면 지갑이 빈 광고주가 낙찰된다」를 더한다. 돈이 걸린 차단 경로인데 지금은 주입 증명이 없다 |
| C-2 | spec.md:52, test-quality.md:24 | 「최저가 하한이 ≥ 1 을 보장한다」는 어드민이 지면 최저가를 저장할 때 CPM 최저가를 1000 마이크로 이상으로 강제해야 성립한다. 그 거부를 U 행으로 둔다. U4 의 999 입찰은 「0 원 노출이 저장·낙찰되지 않는다」로 기대값을 적는다. 그러지 않으면 과금 0 인 노출이 나간다(과소 청구 쪽이다) |
| C-3 | spec.md:26, `KgdMessagingOutboxAutoConfiguration.kt:39-45` | 스케줄링은 `outbox.polling.enabled`(기본 true)에 딸린 `@EnableScheduling` 이다. 누군가 engagement 에서 이 값을 끄면(`CommerceContextLoadSpec.kt:39` 가 끈 선례가 있다) ads 정산·인덱스 갱신이 조용히 멈춘다. 테스트는 ads 스케줄을 끄므로 이것을 못 잡는다. C1 에 「`ScheduledAnnotationBeanPostProcessor` 빈이 있다」 단언 한 줄을 넣는다. 운영은 E1 과 「마지막 정산 시각」 메트릭(spec.md:157)이 받친다 |
| C-4 | test-quality.md:74, `GatewayRoutingSpec.kt:107-116` | 기존 전수 검사는 필터의 `toString()` 을 본다. Host 술어는 문자열로 확인하기 어렵다. rt 제외는 **동작**으로 판정한다. `Host: rt.1989v.com` 으로 `/api/v1/ads/decisions` 를 부르면 게이트웨이에서 404 로 끝나는지 본다(백엔드까지 가지 않으므로 이 스펙 범위 안이다) |
| C-5 | test-quality.md:60 | I18 의 「auth 의 Role 조회 결과 불변」은 ads 통합 테스트에서 auth DB 를 볼 수 없어 그대로는 실행할 수 없다. 두 가지로 바꾼다. 첫째, `ad_advertiser` 행이 1개 생기는지 본다. 둘째, ads 에 auth·member 쓰기 포트나 클라이언트가 없음을 구조로 보장한다. 쓸 수 없게 만드는 것이 검사보다 낫다 |
| C-6 | spec.md:159, `privacyRetention.test.ts:18-21` | `VISITOR_FREQUENCY_TTL_HOURS` 를 둘 파일 경로를 스펙에 정하고 `RETENTION_RUNNERS` 에 추가한다. 목록에 없으면 F6 은 `throw` 로 끝나거나, 우회하려고 테스트에 값을 적게 된다 |
| C-7 | spec.md:161, ci.yml:159-179 | `ads/*` 만 매핑하면 ads 배선이 있는 `engagement/app/*` 만 바꾼 PR(스캔·DataSource·풀 크기·C1 자체)에서는 테스트가 돌지 않는다. 같은 줄에 `engagement/*` 를 더한다. OQ-004 의 기존 부채와는 별개로, ads 가 성립하는 데 필요한 범위다 |
| C-8 | test-quality.md:124 (AC-16b) | 제거 릴리스에서 `GameSchemaIntegrationSpec` 이 통과해야 한다. game ads 엔티티가 남은 채 표만 지우면 `validate` 가 잡는다. `RewardGrantTest` 등 game ads 테스트도 함께 지운다 |
| C-9 | spec.md:107, test-quality.md:48 | I6 에 음성 케이스 하나를 더한다. 시각 끝 + 10분이 지났어도 그 뒤 UPSERT 가 실패한 실행에서는 그 시각이 `closed` 가 되지 않아야 한다. 일찍 닫히면 덜 센 집계로 정산되고, 멱등 키 때문에 다시 청구되지 않는다 |

## 4. 체크리스트 판정 (Round 3)

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트 | 통과 — AC-1~AC-20 모두 대응 행이 있다(test-quality.md:105-128). 판정 방식 보완은 C-5·C-6 |
| 2 | 테스트 레이어 배정 | 통과 — C-3·C-7 이월 |
| 3 | Mock 경계 | 통과 — 돈·일회성·차단 경로는 실제 컨테이너를 쓴다(:10). 게이트웨이는 C4~C6 과 E5 로 나눴다 |
| 4 | 테스트 데이터 전략 | 통과 |
| 5 | 음성·경계 케이스 | 통과 — C-1·C-2·C-9 이월 |
| 6 | 네이밍 규칙 | 통과 (:14) |

## 결론 (Round 3)

Round 2 의 12건 가운데 11건이 해소됐다. R2-12 는 거의 해소됐다. ★ 다섯 건(R2-1·4·5·6·10)은 모두 해소됐다. 개정 3 에서 새로 생긴 중대 결함은 없다. 남은 9건은 전부 테스트 행이나 설정 한 줄을 보태는 수준이라 tasks 단계에서 반영한다. 그중 C-1(차단 경로 회귀 주입)·C-3(스케줄링 출처)·C-7(engagement 경로 매핑)은 구현 착수 전에 태스크로 만들어 둘 것을 권한다.

VERDICT: SHIP
