# Inventory Service

재고 예약/확정/해제/재입고 — **재고(stock) 의 SSOT** (ADR-0013). Product 는 카탈로그만 갖고 재고는 여기서 묻는다.
`commerce:app` 에 폴드된 라이브러리 (ADR-0058). 주문 사가의 **재고 참여자**다 — order 코디네이터의 명령을 받아 답한다 (ADR-0099).

## Modules

| Gradle path | 역할 |
|---|---|
| `:inventory:domain` | Pure Kotlin 도메인 — `Inventory`(available/reserved 분리), `Reservation`(ACTIVE → CONFIRMED · EXPIRED · CANCELLED, 재입고 수량), `InventoryEvent` sealed |
| `:inventory:feature` | 비-bootable 라이브러리 — 전용 datasource `inventory_db` (`inventoryEntityManagerFactory` / `inventoryTransactionManager`, **@Primary**), Flyway `inventorydb/migration` + `ScopedFlywayMigrator` |

## Commands

```bash
./gradlew :inventory:domain:test      # 도메인 테스트 (Spring context 없음)
./gradlew :inventory:feature:test     # 명령 처리(예약 원자성·만료 확정·재입고) · 서비스 (Port MockK)
./gradlew :commerce:app:test --tests '*RetiredChoreography*'   # 옛 구독이 사라졌고 명령 리스너가 실제로 켜지는지 (실 MySQL·Kafka)
```

## 구조 상태 (ADR-0083)

**레이어 표준의 견본이다.** 신규 도메인은 이 모듈을 복사해서 시작한다 (`docs/standards/new-domain-checklist.md`).
Outbox·멱등 원장은 common 바인딩(`InventoryOutboxRepository`·`InventoryProcessedEventRepository`) — 서비스는
`@Qualifier("inventoryOutboxPort")` 로 common `OutboxPort` 를 받는다.

- `application/inventory` — 재고 유스케이스(예약·확정·해제·입고, 주문 단위 `ReserveOrderStock`·`ConfirmStockByOrder`·`ReleaseStockByOrder`) · 대사
- `application/reservation` — `ProcessInventoryCommandUseCase`(`InventoryCommandService`) · 만료 · 옛 예약 전환
- `infrastructure/messaging` — `InventoryCommandConsumer`(그룹 `inventory-service`) · `InventoryDltConsumer`
- `infrastructure/persistence/command` — 답 원장 `inventory_command_answer` · 전환 표식 `inventory_migration_marker`

## Key Rules

- **명령 → 답**(키 = orderId): `inventory.command.{reserve,confirm,release,restock}` →
  `inventory.reservation.{reserved,failed,confirmed,released,restocked}`. 명령 하나 = inventory_db 트랜잭션 하나(예약·재고 행 ·
  동기화 이벤트 · 답 · 답 원장). 답 원장 (orderId, commandKey) 유니크 — 같은 명령이 다시 오면 **처음 답을 그대로 다시 낸다**.
- **예약은 주문 단위로 전부 또는 전무**: 재고 행을 inventory id 오름차순으로 한 행씩 `FOR UPDATE`(교착·낙관락 충돌 방지).
  부족은 예외가 아니라 `inventory.reservation.failed(INSUFFICIENT_STOCK, shortages)`.
- **확정**: 한 라인이라도 만료·해제됐거나 기한이 지났으면 확정하지 않고 남은 ACTIVE 도 풀고 `failed(EXPIRED)` — 예외가 아니다(DLT 로 새지 않는다).
  이미 CONFIRMED 인 예약에 release 가 오면 `failed(ALREADY_CONFIRMED)` — 사가가 재입고로 되돌린다.
- **재입고**(클레임·보류 만료 보상): 라인 지정 시 `restockKey` 필수(키별 멱등), 확정 수량을 넘으면 `failed(NOT_RESTOCKABLE)`.
- **보류 만료**: 예약 기한 30분(`commerce.hold-minutes`), 1분 주기 스케줄러가 만료시키고 `inventory.reservation.expired`. 사가가 받아 처리한다.
- **재고 동기화 이벤트**(product 가 소비): `inventory.stock.{reserved,released,confirmed,received,restocked}` — 예약·해제·확정·입고·재입고 전부.
- **옛 흐름 예약 전환**: 기동 시 phase 0 `SmartLifecycle` 이 사가 밖에서 생긴 ACTIVE 예약을 한 번 확정한다(만료 스케줄러·리스너보다 먼저).
- **은퇴한 구독**: `order.order.completed`·`cancelled`, `fulfillment.order.shipped`·`cancelled` 를 더는 받지 않는다 — 되살리지 않는다.
- **`@EnableKafka` 는 호스트 `CommerceApplication` 에 있다**(여기 두면 이 도메인을 빼는 순간 호스트 전체 리스너가 꺼진다). 지우면 폴드된
  모든 도메인의 리스너가 조용히 사라진다(컴파일·기동은 통과). `RetiredChoreographyCommandIntegrationSpec` 이 잡는다.
- **REST 소유 판정** (`/api/inventories/**`): 어드민은 전부, 판매자는 ACTIVE 판매자 행 + **자기 상품**만(아니면 403), 신원 헤더 없으면 401.
  근거는 자체 읽기 모델 두 개 — `product_owner`(`product.item.{created,updated}` → 상품의 판매자) · `owner_seller`(`seller.seller.*` →
  회원·상태), 그룹 `inventory-ownership`, `occurredAt` 으로 옛 이벤트를 버린다. 소유를 모르는 상품은 거부한다.
  새로 붙은 그룹이라 7일 보관을 넘긴 상품 이벤트는 못 받는다 — 배포 뒤 `POST /api/v1/admin/products/republish` 를 한 번 부른다.
- 컨슈머 멱등은 common `IdempotentEventHandler` — `InventoryMessagingConfig` 가 inventory 전용 빈을 등록한다.
- **DLT**: 1초 간격 3회 재시도 뒤 `<원 토픽>.DLT`. `inventory-dlt-ops` 그룹이 inventory 가 실패한 것만 운영 이슈로 적재 —
  `/api/v1/admin/inventories/ops-issues` 재시도 = 원 토픽 재발행.
- 같은 JVM 의 order/fulfillment 와도 **Kafka 로만** 통신 (ADR-0058 불변식 2). in-process 이벤트 전환 금지
- `@Transactional("inventoryTransactionManager")` 한정자 명시
- 예약 요청 admission control: `AdmissionControlFilter` 가 Redis 카운터로 동시 예약을 제한(초과 429).
  Redis 가 없으면 fail-open — 로컬에서 429 가 안 나온다고 필터가 없는 게 아니다
- 스키마 변경은 Flyway 단독(`ddl-auto=validate`). 커밋한 마이그레이션은 불변. 재고 (product_id, warehouse_id) · 예약 (order_id, product_id, warehouse_id) 유니크

## Docs

- 용어: `inventory/glossary.md` · 토픽: `docs/architecture/kafka-convention.md`
- ADR: `docs/adr/ADR-0011-inventory-fulfillment-service.md`, `ADR-0013-product-inventory-ssot.md`, `ADR-0058-service-consolidation.md`, `ADR-0099-commerce-orchestrated-saga-marketplace.md`
- 멱등: `docs/conventions/idempotent-consumer.md` · 폴드 호스트: `commerce/CLAUDE.md`
