# Fulfillment Service

출고 상태 머신 — `FulfillmentOrder` 가 생성→출고→배송 완료/취소 전이를 소유한다 (ADR-0011).
Saga choreography 의 출고 단계이고, `commerce:app` 에 폴드된 라이브러리다 (ADR-0058).

## Modules

| Gradle path | 역할 |
|---|---|
| `:fulfillment:domain` | Pure Kotlin 도메인 — `FulfillmentOrder` 상태 머신 |
| `:fulfillment:feature` | 비-bootable 라이브러리 — 전용 datasource `fulfillment_db` (`fulfillmentEntityManagerFactory` / `fulfillmentTransactionManager`, master/replica 라우팅), Flyway `fulfillmentdb/migration` + `ScopedFlywayMigrator` |

`fulfillment/app/` 디렉토리는 비어 있다 (폴드 전 잔재, settings 에 없음) — 새 파일을 거기 만들지 않는다.

## Commands

```bash
./gradlew :fulfillment:domain:test
./gradlew :fulfillment:feature:test
./gradlew :commerce:app:build         # 배포 단위(폴드 앱)
```

## 구조 상태 (ADR-0083)

표준 준수 — UseCase 인터페이스 3(`Create`/`Get`/`Transition`), `FulfillmentRepositoryPort`, adapter. Outbox·멱등 원장은 common 바인딩(`FulfillmentOutboxRepository`·`FulfillmentProcessedEventRepository`).
Outbox 는 common 서브인터페이스 `FulfillmentOutboxRepository : OutboxRepository` 로 fulfillment EMF 에 바인딩 —
**이것이 폴드 앱에서 Outbox 를 붙이는 정본 패턴**이다 (inventory 의 자체 구현이 아니라). 부채 없음.

## Key Rules

- **Kafka 발행**: `fulfillment.order.created` · `shipped` · `delivered` · `cancelled`. **소비**: `inventory.stock.reserved`
  (예약 확정 시 출고 생성) — `docs/architecture/kafka-convention.md`
- 상태 전이는 도메인이 판정한다 — 서비스/컨트롤러에서 `if status ==` 를 쓰지 않는다
- 컨슈머 멱등은 common `IdempotentEventHandler`, `FulfillmentMessagingConfig` 가 fulfillment 전용 어댑터로 등록
- `@Transactional("fulfillmentTransactionManager")` 명시. outbox INSERT 가 상태 변경과 같은 fulfillment_db 트랜잭션에 묶인다
- inventory 와 같은 JVM 이지만 **Kafka 유지** (ADR-0058 불변식 2)

## Docs

- 용어: `fulfillment/glossary.md`
- ADR: `docs/adr/ADR-0011-inventory-fulfillment-service.md`, `ADR-0058-service-consolidation.md`
- 폴드 호스트: `commerce/CLAUDE.md`
