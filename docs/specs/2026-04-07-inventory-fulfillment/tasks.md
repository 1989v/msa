# Implementation Tasks — Inventory + Fulfillment

## Group 1: 프로젝트 스캐폴딩 (병렬 불가) ✅

- [x] T1.1: settings.gradle.kts에 inventory:domain, inventory:app, fulfillment:domain, fulfillment:app 추가
- [x] T1.2: inventory/domain/build.gradle.kts, inventory/app/build.gradle.kts 생성
- [x] T1.3: fulfillment/domain/build.gradle.kts, fulfillment/app/build.gradle.kts 생성
- [x] T1.4: Application 클래스 + application.yml 생성 (inventory, fulfillment)
- [x] T1.5: Gradle sync 확인

## Group 2: Inventory Domain ✅

- [x] T2.1: Inventory aggregate (model/Inventory.kt)
- [x] T2.2: Reservation entity (model/Reservation.kt, ReservationStatus)
- [x] T2.3: Domain events (InventoryEvent.kt, ReservationEvent.kt — sealed class)
- [x] T2.4: Domain exceptions (InsufficientStockException, InvalidReservationStateException)
- [x] T2.5: Domain tests — InventoryTest, ReservationTest (Kotest BehaviorSpec)

## Group 3: Fulfillment Domain ✅

- [x] T3.1: FulfillmentOrder aggregate (model/FulfillmentOrder.kt)
- [x] T3.2: FulfillmentStatus enum + 상태 머신 로직
- [x] T3.3: Domain events (FulfillmentEvent.kt — sealed class)
- [x] T3.4: Domain exceptions
- [x] T3.5: Domain tests — FulfillmentOrderTest, FulfillmentStatusTest

## Group 4: Inventory App — Infrastructure ✅

- [x] T4.1: JPA entities (InventoryJpaEntity, ReservationJpaEntity, OutboxJpaEntity)
- [x] T4.2: JPA repositories + adapters (InventoryRepositoryAdapter, ReservationRepositoryAdapter)
- [x] T4.3: Outbox adapter (OutboxAdapter)
- [x] T4.4: DataSource config (master/replica)
- [x] T4.5: Kafka config (producer + consumer)

## Group 5: Fulfillment App — Infrastructure ✅

- [x] T5.1: JPA entities (FulfillmentOrderJpaEntity, OutboxJpaEntity)
- [x] T5.2: JPA repositories + adapters
- [x] T5.3: Outbox adapter
- [x] T5.4: DataSource config (master/replica)
- [x] T5.5: Kafka config (producer + consumer)

## Group 6: Application Layer ✅

- [x] T6.1: Inventory UseCases (Reserve, Release, Confirm, Receive, Get, ConfirmByOrder, ReleaseByOrder)
- [x] T6.2: Inventory Service 구현
- [x] T6.3: Fulfillment UseCases (Create, Transition, Get)
- [x] T6.4: Fulfillment Service 구현
- [x] T6.5: Application tests — InventoryServiceTest, FulfillmentServiceTest (MockK)

## Group 7: Presentation + Messaging ✅

- [x] T7.1: Inventory REST Controller + Request/Response DTOs
- [x] T7.2: Fulfillment REST Controller + Request/Response DTOs
- [x] T7.3: Inventory Kafka Consumer (order.order.completed → reserve, items 포함)
- [x] T7.4: Fulfillment Kafka Consumer (inventory.stock.reserved → create fulfillment)
- [x] T7.5: Inventory Kafka Consumer (fulfillment.order.shipped → confirmByOrder, fulfillment.order.cancelled → releaseByOrder)
- [x] T7.6: Outbox Polling Publisher (inventory + fulfillment 공통 패턴)

## Group 8: 인프라 + 통합 ✅

- [x] T8.1: docker-compose.infra.yml — inventory DB, fulfillment DB 추가
- [x] T8.2: docker-compose.yml — inventory, fulfillment 서비스 추가
- [ ] T8.3: Gateway 라우팅 추가 (Phase 2로 연기)
- [x] T8.4: Kafka topic 컨벤션 문서 업데이트
- [x] T8.5: 전체 빌드 검증 (`./gradlew build` — BUILD SUCCESSFUL)

## Group 9: 예약 만료 스케줄러 ✅

- [x] T9.1: ReservationExpiryService + @Scheduled
- [x] T9.2: 만료 시 재고 release + 이벤트 발행

## Group 10: 이벤트 연동 보완 (추가 작업) ✅

- [x] T10.1: Order 이벤트에 items 추가 (OrderCompletedEvent + OrderItemEvent)
- [x] T10.2: Inventory Consumer 실제 예약 로직 구현 (warehouseId=1 기본)
- [x] T10.3: Inventory Consumer — fulfillment.order.shipped → ConfirmStockByOrderUseCase
- [x] T10.4: Inventory Consumer — fulfillment.order.cancelled → ReleaseStockByOrderUseCase
- [x] T10.5: Order Consumer — inventory.reservation.expired → 주문 취소

## 문서 동기화 ✅

- [x] module-structure.md — inventory/fulfillment 모듈 추가
- [x] kafka-convention.md — 8개 신규 토픽 + consumer group
- [x] common-features.md — 서비스별 적용 현황 업데이트
- [x] spec.md — 이벤트 흐름 다이어그램, 포트 수정, Phase 1 제약 명시
- [x] open-questions.yml — OQ-5, OQ-6 추가
- [x] tasks.md — 완료 상태 반영
