# Fulfillment Service

출고 상태 머신 — `FulfillmentOrder`(창고별 이행 + 라인)가 생성→출고→배송 완료/취소 전이를 소유한다 (ADR-0011).
주문 사가의 **이행 참여자**다 — order 코디네이터의 명령을 받아 답한다 (ADR-0099). `commerce:app` 에 폴드된 라이브러리 (ADR-0058).

## Modules

| Gradle path | 역할 |
|---|---|
| `:fulfillment:domain` | Pure Kotlin 도메인 — `FulfillmentOrder` 상태 머신 · `FulfillmentLine`(ACTIVE · CANCELLED, 라인 취소) |
| `:fulfillment:feature` | 비-bootable 라이브러리 — 전용 datasource `fulfillment_db` (`fulfillmentEntityManagerFactory` / `fulfillmentTransactionManager`, master/replica 라우팅), Flyway `fulfillmentdb/migration` + `ScopedFlywayMigrator` |

`fulfillment/app/` 디렉토리는 비어 있다 (폴드 전 잔재, settings 에 없음) — 새 파일을 거기 만들지 않는다.

## Commands

```bash
./gradlew :fulfillment:domain:test
./gradlew :fulfillment:feature:test   # 명령 처리(생성 멱등 · 라인 취소 · 출고 뒤 거절)
./gradlew :commerce:app:build         # 배포 단위(폴드 앱)
```

## 구조 상태 (ADR-0083)

표준 준수 — UseCase 인터페이스 4(`Create`/`Get`/`Transition`/`ProcessFulfillmentCommand`), `FulfillmentRepositoryPort`, adapter.
Outbox·멱등 원장은 common 바인딩(`FulfillmentOutboxRepository`·`FulfillmentProcessedEventRepository`) — **폴드 앱에서 Outbox 를 붙이는 정본 패턴**.
`FulfillmentEventPublisher` 가 명령 경로와 REST 수동 전이 양쪽의 이벤트를 같은 모양으로 낸다.

## Key Rules

- **명령**(키 = orderId, 그룹 `fulfillment-service`): `fulfillment.command.create`(라인별 창고) — 창고마다 이행 하나,
  (order_id, warehouse_id) 유니크. 이미 있으면 지금 상태로 `created` 를 다시 낸다.
  `fulfillment.command.cancel`(라인 지정 또는 전체) — 대상 중 하나라도 SHIPPED·DELIVERED 면 **아무것도 취소하지 않고**
  `fulfillment.order.cancel-rejected`(클레임이 판매자 결정으로 넘어간다), 아니면 라인 취소 후 `fulfillment.order.cancelled`.
- **발행**(아웃박스, 키 = orderId): `fulfillment.order.{created,shipped,delivered,cancelled,cancel-rejected}` → order(사가·클레임·자동 구매 확정 기준 시각),
  `fulfillment.order.status-changed`(REST 수동 전이, 현재 수신자 없음). 명령 하나 = fulfillment_db 트랜잭션 하나(이행·라인·아웃박스 행).
- **은퇴한 구독**: `inventory.stock.reserved` 로 이행을 만들던 코레오그래피는 없다 — 되살리지 않는다.
- 상태 전이는 도메인이 판정한다 — 서비스/컨트롤러에서 `if status ==` 를 쓰지 않는다
- 컨슈머 멱등은 common `IdempotentEventHandler`, `FulfillmentMessagingConfig` 가 fulfillment 전용 어댑터로 등록
- `@Transactional` 은 `fulfillmentTransactionManager` 한정자(클래스 레벨 `@Qualifier`)
- **DLT**: 1초 간격 3회 재시도 뒤 `<원 토픽>.DLT`, `fulfillment-dlt-ops` 가 운영 이슈로 적재 — `/api/v1/admin/fulfillments/ops-issues` 재시도 = 원 토픽 재발행
- 운영 `fulfillment_order.status` 는 Hibernate 가 만든 ENUM 이었다 — VARCHAR(20) 로 바꿨다. 상태를 늘릴 때 운영 컬럼 타입을 먼저 본다.
- inventory 와 같은 JVM 이지만 **Kafka 유지** (ADR-0058 불변식 2)
- **REST 소유 판정** (`/api/fulfillments/**`): 어드민은 전부. 판매자(ACTIVE 행)는 전이·취소는 이행의 **라인 전부**가 자기 상품일 때만,
  조회는 라인 **하나라도** 자기 상품이면(주문별 목록은 그런 이행만 거른다). 수동 생성은 어드민만. 신원 헤더 없으면 401.
  근거는 inventory 와 같은 모양의 자체 읽기 모델(`product_owner` · `owner_seller`, 그룹 `fulfillment-ownership`).

## Docs

- 용어: `fulfillment/glossary.md` · 토픽: `docs/architecture/kafka-convention.md`
- ADR: `docs/adr/ADR-0011-inventory-fulfillment-service.md`, `ADR-0058-service-consolidation.md`, `ADR-0099-commerce-orchestrated-saga-marketplace.md`
- 폴드 호스트: `commerce/CLAUDE.md`
