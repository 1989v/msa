# Test Strategy — Inventory + Fulfillment

## Domain Tests (Mock 금지, 순수 단위 테스트)

### Inventory Domain
- `InventoryTest`: reserve/release/confirm/receive — 수량 변화 검증
- `InventoryTest`: oversell 방지 — available 부족 시 예외
- `ReservationTest`: 상태 전이 — ACTIVE → CONFIRMED, ACTIVE → CANCELLED, ACTIVE → EXPIRED
- `ReservationTest`: 만료 판정 — expiredAt 기준

### Fulfillment Domain
- `FulfillmentOrderTest`: 상태 머신 — 유효 전이만 허용
- `FulfillmentOrderTest`: 잘못된 전이 시 예외
- `FulfillmentStatusTest`: canTransitionTo 규칙 검증

## Application Tests (Port는 MockK)

### Inventory Application
- `ReserveStockServiceTest`: 정상 예약 → outbox 이벤트 저장 검증
- `ReserveStockServiceTest`: 재고 부족 → 예외 + 이벤트 미발행
- `ReleaseStockServiceTest`: 예약 해제 → available 복구
- `ConfirmStockServiceTest`: 확정 차감 → reserved 감소

### Fulfillment Application
- `CreateFulfillmentServiceTest`: 풀필먼트 생성 → PENDING 상태
- `TransitionFulfillmentServiceTest`: 상태 전이 → 이벤트 발행

## Integration Tests (Phase 1 최소)

- Outbox Polling → Kafka 발행 검증 (spring-kafka-test)
- JPA Repository 매핑 검증

## 테스트 프레임워크

- Kotest BehaviorSpec (given/when/then)
- MockK (Mockito 금지)
- 테스트 파일: `{Class}Test.kt`
