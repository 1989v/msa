# Commerce App — 폴드 호스트

자기 도메인이 없는 **부트스트랩 전용 앱**이다 (ADR-0058/0093/0099). order · inventory · fulfillment · warehouse · product · deal ·
seller · payment · promotion · settlement 열 `:feature` 라이브러리를 한 JVM(port 8085)으로 띄운다.
코드는 `CommerceApplication.kt` 한 파일과 `application.yml`·`application-kubernetes.yml` 뿐이다.

## Modules

| Gradle path | 역할 |
|---|---|
| `:commerce:app` | `@SpringBootApplication(scanBasePackages = [10 도메인 + common.exception/response])` + `@EnableScheduling` + bootJar `commerce` |

## Commands

```bash
./gradlew :commerce:app:build      # 10 feature 포함 빌드
./gradlew :commerce:app:test       # 컨텍스트 로드 + 통합(Testcontainers MySQL·Kafka) + 사가·클레임·정산 E2E
./gradlew :commerce:app:check      # 위 + 구조 게이트(트랜잭션 한정자 등)
```

테스트 JVM 힙은 1g(`maxHeapSize`) — E2E 가 열 도메인 컨텍스트와 컨테이너를 함께 띄워 기본 512m 에서 GC 로 멈춘다.

## 폴드된 도메인 · datasource

| 도메인 | 스키마 | datasource 키 | 비고 |
|---|---|---|---|
| inventory | `inventory_db` | `spring.datasource.master`/`replica` | **@Primary** — 한정자 없는 `@Transactional` 은 여기로 붙는다 |
| warehouse | `warehouse_db` | `spring.datasource.warehouse` | |
| fulfillment | `fulfillment_db` | `spring.datasource.fulfillment` | |
| order | `order_db` | `spring.datasource.order` | 사가 코디네이터 |
| product | `product_db` | `spring.datasource.product` | 카탈로그 SSOT |
| deal | `deal_db` | `spring.datasource.deal` | 혜택 링크 허브 (ADR-0093 ②) |
| seller | `seller_db` | `spring.datasource.seller` | Hikari 최대 3 |
| payment | `payment_db` | `spring.datasource.payment` | Hikari 최대 3 |
| promotion | `promotion_db` | `spring.datasource.promotion` | Hikari 최대 3 |
| settlement | `settlement_db` | `spring.datasource.settlement` | Hikari 최대 3 |

seller·payment·promotion·settlement 은 order 와 같은 MySQL 인스턴스(`mysql-order-master`)에 스키마만 분리한다.
**Hikari 풀은 모든 도메인이 최대 3 · 최소 유휴 1** 이다. 풀 키는 `master`/`replica` 바로 아래에 둔다 — `hikari.` 하위에 두면
DataSourceBuilder 가 만든 풀에 바인딩되지 않고 조용히 기본값 10 으로 뜬다(deal 만 `DataSourceProperties` 라 `hikari.` 하위를 따로 바인딩).
`CommerceContextLoadSpec` 이 떠 있는 풀 전부의 `maximumPoolSize` 를 읽어 확인한다.
Boot 의 Flyway 자동설정은 꺼져 있다(`spring.flyway.enabled: false`) — 스키마는 도메인별 `ScopedFlywayMigrator` 만 돌린다.
`application.yml` 에 남은 `member`·`wishlist` 블록은 account 호스트로 옮긴 뒤(ADR-0093)의 잔재로, 스캔 대상이 아니라 읽히지 않는다.

## 구조 상태 (ADR-0083)

레이어 규칙 **비대상** — 부트스트랩 1파일뿐이고 도메인이 없다. 폴드된 도메인의 상태는 각자의 `CLAUDE.md` 에 있다 (inventory 가 견본).

## 도메인을 폴드할 때 고치는 곳

code-dictionary 와 다르다 — 여기서는 **각 feature 가 자기 `{Svc}DataSourceConfig` 로 EMF/TM/Flyway 를 갖는다.**

| 파일 | 무엇 | 빠뜨리면 |
|---|---|---|
| `CommerceApplication.kt` | `scanBasePackages` 에 `com.kgd.{svc}` | **조용한 404** — 기동은 되고 그 도메인만 매핑이 없다 |
| `build.gradle.kts` | `implementation(project(":{svc}:feature"))` | 컴파일은 되고 빈이 없다 |
| `application.yml` · `application-kubernetes.yml` | `spring.datasource.{svc}` 블록 + `{svc}.flyway.enabled` | 기동 실패 — 또는 운영에서 localhost 로 붙어 컨텍스트가 죽는다(2026-09-11 product 사례) |
| `./gradlew generateTopology` | CI 가 그 도메인 변경에 commerce 테스트·이미지를 만들게 | PR 게이트가 그 도메인 테스트를 안 돌리고 이미지가 안 나온다 |

그리고 `CommerceContextLoadSpec` 에 "그 도메인 컨트롤러가 빈으로 등록된다 + 행 쓰기·읽기" 한 줄 — 첫 줄 누락을 잡는 자동 장치.

## Key Rules (ADR-0058 불변식)

- feature 끼리 **직접 빈 주입 금지** — `build.gradle.kts` 에서 feature 가 다른 feature 를 의존하지 않는다 (교차 import 는 컴파일 에러)
- 같은 JVM 이라도 BC 간 통신은 **Kafka**. 주문 흐름은 order 코디네이터가 명령 토픽으로 오케스트레이션한다 (ADR-0099) —
  명령·답은 전부 아웃박스로 나가고 키는 orderId. 토픽 표는 `docs/architecture/kafka-convention.md`
- datasource · EMF · TM · outbox · `ProcessedEvent` · `ops_issue` 는 **도메인별**. `@Transactional` 은 자기 TM 한정자 필수
  (`verifyTransactionQualifiers` 가 `check` 에서 막는다). 한정자 없는 `@Transactional` 은 `@Primary`(inventory)로 잘못 붙는다
- 멱등 핸들러도 도메인별 — 각 `{Svc}MessagingConfig` 가 자기 `IdempotentEventHandler` 빈을 등록한다
- **`@EnableKafka` 는 inventory `KafkaConfig` 한 곳**에 있고 호스트 전체 리스너를 켠다. 없으면 모든 `@KafkaListener` 가 조용히
  등록되지 않는다(2026-09-24 까지 운영에서 실제로 그랬다 — 읽기 모델·명령 컨슈머 전부 무동작). 옮길 때는 통합 spec 이 잡는지 먼저 본다
- **DLT 는 `<원 토픽>.DLT`** — Spring Kafka 4 기본값 `-dlt` 가 아니다. common `DltKafka.deadLetterRecoverer` 로 이름을 명시한다.
  도메인마다 `{svc}-dlt-ops` 그룹이 `.*\.DLT` 를 패턴 구독하고 원 컨슈머 그룹 헤더로 자기 것만 운영 이슈로 적재한다
- 스케줄러 스레드 풀 4(`spring.task.scheduling.pool.size`) — 정산 배치가 아웃박스 발행을 막지 않게
- 재분리는 ADR-0058 "재분리 체크리스트" 4단계 — feature·DB·토픽 무변경

## 운영

- k8s `k8s/base/commerce` — 이미지 태그 하나가 열 도메인을 함께 올린다. 한 도메인의 테스트 실패가 전체 배포를 막는다
- 필수 Secret: `SELLER_ACCOUNT_ENC_KEY`(없으면 기동 실패). `PAYMENT_PG=toss` 일 때만 `TOSS_SECRET_KEY`(웹훅은 재조회 신호라 비밀이 없다). 둘 다 설정 파일에 기본값이 없다
- 새 스키마·계정은 운영 MySQL init 이 재실행되지 않으므로 배포 전 `oci-mysql` 로 만들고 init 파일도 같이 고친다
- 헬스: datasource 중 하나라도 replica 서비스가 없으면 DOWN 이 난다 (2026-08-06 member/wishlist replica 부재 사례)
- 운영 큐: admin-fe 가 여덟 도메인(order·inventory·fulfillment·product·payment·seller·promotion·settlement)의
  `/api/v1/admin/{domain}/ops-issues` 를 합쳐 한 목록으로 보여 준다
- 추적: Micrometer Tracing(brave) — HTTP·Kafka `traceparent`, 아웃박스 행에 헤더를 저장했다가 발행 때 복원한다

## Docs

- ADR: `docs/adr/ADR-0058-service-consolidation.md` · `ADR-0093-service-topology-regrouping.md` · `ADR-0099-commerce-orchestrated-saga-marketplace.md` · 폴드 도메인 각각의 `CLAUDE.md`
- 신규 도메인 폴드 절차: `docs/standards/new-domain-checklist.md` §3
