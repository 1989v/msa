# Inventory Service

재고 예약/차감/복구 — **재고(stock) 의 SSOT** (ADR-0013). Product 는 카탈로그만 갖고 재고는 여기서 묻는다.
`commerce:app` 에 폴드된 라이브러리 (ADR-0058 — 사가 코드 무변경, Kafka 유지).

## Modules

| Gradle path | 역할 |
|---|---|
| `:inventory:domain` | Pure Kotlin 도메인 — `Inventory`(available/reserved 분리), `Reservation`, `InventoryEvent` sealed |
| `:inventory:feature` | 비-bootable 라이브러리 — 전용 datasource `inventory_db` (`inventoryEntityManagerFactory` / `inventoryTransactionManager`), Flyway `inventorydb/migration` + `ScopedFlywayMigrator` |

## Commands

```bash
./gradlew :inventory:domain:test      # 도메인 테스트 (Spring context 없음)
./gradlew :inventory:feature:test     # 서비스 테스트 (Port MockK) + 컨슈머 멱등
./gradlew :commerce:app:build         # 배포 단위(폴드 앱) 빌드 — CommerceContextLoadSpec 이 컨트롤러 등록을 검증
```

## 구조 상태 (ADR-0083)

**레이어 표준의 견본이다.** 신규 도메인은 이 모듈을 복사해서 시작한다 (`docs/standards/new-domain-checklist.md`).

- `application/inventory/usecase` 인터페이스 7 + `reservation/usecase` 1 — 전부 `Command/Result` 내장
- `application/inventory/port` 5 (`InventoryRepositoryPort` / `ReservationRepositoryPort` / `InventoryCachePort` / `OutboxPort` / `InventoryMetricsPort`)
- `infrastructure/persistence/{inventory,reservation,outbox,idempotency}` adapter, `cache/InventoryCacheAdapter`, `metrics/InventoryMetrics`, `messaging/InventoryEventConsumer`
- 남은 부채: **Outbox 가 자체 구현**(`OutboxJpaEntity`/`OutboxPollingPublisher`)이다 — order/fulfillment 처럼 common `OutboxRepository` 서브인터페이스로 바꾼다 (플랜 P5)

## Key Rules

- `available_qty` / `reserved_qty` 분리, Optimistic Lock(`@Version`) 으로 동시성 (ADR-0011). 예약 만료는
  `ExpireReservationsUseCase` 스케줄 — 만료 시 `inventory.reservation.expired` 발행
- **Kafka 발행**: `inventory.stock.reserved` · `released` · `confirmed` · `received`, `inventory.reservation.expired`.
  **소비**: `order.order.completed` · `cancelled`, `fulfillment.order.shipped` · `cancelled` — 토픽 표는
  `docs/architecture/kafka-convention.md`
- 컨슈머 멱등은 common `IdempotentEventHandler` — `InventoryMessagingConfig` 가 inventory 전용
  `ProcessedEventRepositoryPort` 어댑터(`@Qualifier("jpaProcessedEventRepositoryAdapter")`)로 빈을 등록한다.
  commerce 모놀리스에서 fulfillment 등이 **각자 자기 핸들러를 등록**하므로 common 자동설정에 기대지 않는다
- 같은 JVM 의 order/fulfillment 와도 **Kafka 로만** 통신 (ADR-0058 불변식 2). in-process 이벤트 전환 금지
- `@Transactional("inventoryTransactionManager")` 한정자 명시 — 폴드 앱에 TM 이 6개다
- 예약 요청 admission control: `AdmissionControlFilter` 가 Redis 카운터로 동시 예약을 제한(초과 429).
  Redis 가 없으면 fail-open — 로컬에서 429 가 안 나온다고 필터가 없는 게 아니다
- 스키마 변경은 Flyway 단독(`ddl-auto=validate`). 커밋한 마이그레이션은 불변

## Docs

- 용어: `inventory/glossary.md`
- ADR: `docs/adr/ADR-0011-inventory-fulfillment-service.md`, `ADR-0013-product-inventory-ssot.md`, `ADR-0058-service-consolidation.md`
- 멱등: `docs/conventions/idempotent-consumer.md` · 폴드 호스트: `commerce/CLAUDE.md`
