# ADR-0013 Product-Inventory 재고 SSOT 정의

## Status
Accepted

## Context

현재 재고 데이터가 두 곳에 존재한다:

1. **Product 서비스**: `Product.stock` 필드 (단순 정수, 예약 개념 없음)
2. **Inventory 서비스**: `Inventory.available_qty` + `reserved_qty` (예약 기반, Optimistic Lock)

두 데이터 소스 간 동기화 메커니즘이 없어서:
- Product API(`/api/products/{id}`)의 `stock` 값이 실제 가용 재고와 불일치
- `Product.decreaseStock()` 메서드가 존재하지만 어디서도 호출되지 않음
- 주문 시 재고 사전 검증이 없음 (주문 완료 후 Inventory에서 예약 시도)

## Decision

### 1. Inventory 서비스를 재고 SSOT로 지정

- 모든 재고 변동(예약/차감/입고/해제)은 Inventory 서비스에서만 수행
- Inventory의 `available_qty`가 실제 판매 가능 수량의 진실 공급원

### 2. Product.stock → 조회용 캐시(Denormalized Read Model)로 재정의

Product의 `stock` 필드는 Inventory 이벤트를 수신하여 동기화되는 **읽기 전용 비정규화 데이터**로 재정의한다.

- `Product.decreaseStock()` 메서드 제거
- `Product.syncStock(availableQty)` 메서드 추가 (Inventory 이벤트 기반 동기화)
- Product API 응답의 `stock`은 "대략적 가용 재고" 의미로 유지 (실시간 정확성 불보장 명시)

### 3. 이벤트 흐름 추가

```
Inventory 서비스
  ├─ StockReserved  ─→ product.stock 감소
  ├─ StockReleased  ─→ product.stock 증가
  ├─ StockConfirmed ─→ (변동 없음, 이미 reserved에서 차감됨)
  └─ StockReceived  ─→ product.stock 증가
```

Product 서비스에 Kafka Consumer 추가:
- 토픽: `inventory.stock.reserved`, `inventory.stock.released`, `inventory.stock.received`
- 처리: Product.stock 업데이트 (available_qty 값으로 덮어쓰기 or 증감분 적용)

### 4. Kafka 토픽 보강

kafka-convention.md에 다음 수신 관계 추가:

| 토픽 | 발행 서비스 | 수신 서비스 |
|------|------------|------------|
| `inventory.stock.reserved` | inventory | fulfillment, **product** |
| `inventory.stock.released` | inventory | **product** |
| `inventory.stock.received` | inventory | **product** |

### 5. Phase 2 고려사항

- 주문 시 재고 사전 검증: Gateway 또는 Order 서비스에서 Inventory API 호출로 가용 재고 확인 (Phase 2)
- Redis 캐시를 통한 실시간 재고 조회 (Phase 2, ADR-0011 Redis fast-path와 연계)

## Alternatives Considered

1. **Product.stock 필드 완전 제거**: API 호출자가 Inventory API를 직접 호출. 기존 클라이언트 호환성 깨짐.
2. **동기 API 호출로 실시간 조회**: Product → Inventory API 호출. 서비스 간 결합도 증가, 장애 전파 위험.
3. **현행 유지 (분리된 두 값)**: SSOT 모호, 데이터 불일치 지속.

## Consequences

**긍정적:**
- 재고 SSOT 명확화 → 데이터 불일치 해소
- Product API에서 대략적 재고 조회 가능 유지 (UX 보존)
- 이벤트 기반 동기화로 서비스 간 느슨한 결합 유지

**부정적:**
- 이벤트 지연으로 인한 일시적 불일치 (Eventual Consistency)
- Product 서비스에 Kafka Consumer 추가 필요
- 주문 시 실시간 재고 검증은 Phase 2로 미룸
