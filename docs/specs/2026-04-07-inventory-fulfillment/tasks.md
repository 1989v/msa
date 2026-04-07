# Implementation Tasks — Inventory + Fulfillment

## Group 1: 프로젝트 스캐폴딩 (병렬 불가)

- [ ] T1.1: settings.gradle.kts에 inventory:domain, inventory:app, fulfillment:domain, fulfillment:app 추가
- [ ] T1.2: inventory/domain/build.gradle.kts, inventory/app/build.gradle.kts 생성
- [ ] T1.3: fulfillment/domain/build.gradle.kts, fulfillment/app/build.gradle.kts 생성
- [ ] T1.4: Application 클래스 + application.yml 생성 (inventory, fulfillment)
- [ ] T1.5: Gradle sync 확인 (`./gradlew :inventory:app:compileKotlin :fulfillment:app:compileKotlin`)

## Group 2: Inventory Domain (병렬 가능 — Fulfillment Domain과 독립)

- [ ] T2.1: Inventory aggregate (model/Inventory.kt, Quantity, InventoryId)
- [ ] T2.2: Reservation entity (model/Reservation.kt, ReservationStatus)
- [ ] T2.3: Domain events (InventoryEvent.kt, ReservationEvent.kt — sealed class)
- [ ] T2.4: Domain exceptions (InsufficientStockException, InvalidReservationStateException)
- [ ] T2.5: Domain tests — InventoryTest, ReservationTest (Kotest BehaviorSpec)

## Group 3: Fulfillment Domain (병렬 가능 — Inventory Domain과 독립)

- [ ] T3.1: FulfillmentOrder aggregate (model/FulfillmentOrder.kt)
- [ ] T3.2: FulfillmentStatus enum + 상태 머신 로직
- [ ] T3.3: Domain events (FulfillmentEvent.kt — sealed class)
- [ ] T3.4: Domain exceptions
- [ ] T3.5: Domain tests — FulfillmentOrderTest, FulfillmentStatusTest

## Group 4: Inventory App — Infrastructure (Group 2 완료 후)

- [ ] T4.1: JPA entities (InventoryJpaEntity, ReservationJpaEntity, OutboxJpaEntity)
- [ ] T4.2: JPA repositories + adapters (InventoryRepositoryAdapter, ReservationRepositoryAdapter)
- [ ] T4.3: Outbox adapter (OutboxAdapter)
- [ ] T4.4: DataSource config (master/replica)
- [ ] T4.5: Kafka config (producer + consumer)

## Group 5: Fulfillment App — Infrastructure (Group 3 완료 후)

- [ ] T5.1: JPA entities (FulfillmentOrderJpaEntity, OutboxJpaEntity)
- [ ] T5.2: JPA repositories + adapters
- [ ] T5.3: Outbox adapter
- [ ] T5.4: DataSource config (master/replica)
- [ ] T5.5: Kafka config (producer + consumer)

## Group 6: Application Layer (Group 4, 5 완료 후, 병렬 가능)

- [ ] T6.1: Inventory UseCases (Reserve, Release, Confirm, Receive, Get)
- [ ] T6.2: Inventory Service 구현
- [ ] T6.3: Fulfillment UseCases (Create, Transition, Get)
- [ ] T6.4: Fulfillment Service 구현
- [ ] T6.5: Application tests — InventoryServiceTest, FulfillmentServiceTest (MockK)

## Group 7: Presentation + Messaging (Group 6 완료 후)

- [ ] T7.1: Inventory REST Controller + Request/Response DTOs
- [ ] T7.2: Fulfillment REST Controller + Request/Response DTOs
- [ ] T7.3: Inventory Kafka Consumer (order.order.completed → reserve)
- [ ] T7.4: Fulfillment Kafka Consumer (inventory.stock.reserved → create fulfillment)
- [ ] T7.5: Inventory Kafka Consumer (fulfillment.order.shipped → confirm, fulfillment.order.cancelled → release)
- [ ] T7.6: Outbox Polling Publisher (inventory + fulfillment 공통 패턴)

## Group 8: 인프라 + 통합 (Group 7 완료 후)

- [ ] T8.1: docker-compose.infra.yml — inventory DB, fulfillment DB 추가
- [ ] T8.2: docker-compose.yml — inventory, fulfillment 서비스 추가
- [ ] T8.3: Gateway 라우팅 추가
- [ ] T8.4: Kafka topic 컨벤션 문서 업데이트
- [ ] T8.5: 전체 빌드 검증 (`./gradlew build`)

## Group 9: 예약 만료 스케줄러

- [ ] T9.1: ReservationExpiryService + @Scheduled
- [ ] T9.2: 만료 시 재고 release + 이벤트 발행
