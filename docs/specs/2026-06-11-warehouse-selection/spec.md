# Spec — 재고 예약 창고 자동 선택 (warehouseId 하드코딩 제거)

> Status: Implemented (2026-06-11)
> Origin: 플랫폼 전반 갭 감사 (Track A — 커머스 코어). ADR-0032 구현 완료 후 잔여 갭.

## Problem

`InventoryEventConsumer.reserveItems` 가 `order.order.completed` 이벤트로 재고를 예약할 때
`warehouseId = 1L` 을 하드코딩했다. 결과:

- 멀티 창고 환경에서 모든 주문이 창고 1 의 재고만 차감 → 다른 창고 재고가 있어도 `InsufficientStockException`
- 풀필먼트가 항상 창고 1 로 생성 (`inventory.stock.reserved` 이벤트의 warehouseId 가 그대로 전파됨)

## Decision

**창고 선택을 inventory BC 내부의 도메인 정책으로 구현** (warehouse 서비스 동기 호출 없음 —
inventory 테이블이 이미 `(productId, warehouseId)` 별 가용 수량을 보유하므로 외부 의존 불필요).

### 선택 정책 — `WarehouseSelector` (domain)

1. 요청 수량을 단일 창고에서 전부 충족하는 창고만 후보 (분할 출고 미지원 — 향후 별도 스펙)
2. 가용 재고 최다 창고 우선 (소진 속도 평준화)
3. 동률 시 낮은 warehouseId (결정성)

### API 변경

- `ReserveStockUseCase.Command.warehouseId: Long` → `Long?`
  - null = 자동 선택 (주문 이벤트 경로), non-null = 명시 창고 (기존 REST API 경로, 동작 불변)
- 선택과 차감은 같은 `@Transactional` 안 — 선택 후 재고 변동 race 는 `@Version` optimistic lock 으로 방어

### 에러 시맨틱 (자동 선택 경로)

| 상황 | 예외 |
|---|---|
| 재고 row 자체 없음 | `BusinessException(NOT_FOUND)` |
| row 는 있으나 전 창고 수량 부족 | `InsufficientStockException` (최다 가용 창고 기준 메시지) |

## Changed Files

- `inventory/domain/.../inventory/service/WarehouseSelector.kt` (신규)
- `inventory/domain/src/test/.../WarehouseSelectorTest.kt` (신규)
- `inventory/app/.../usecase/ReserveStockUseCase.kt` — Command.warehouseId nullable
- `inventory/app/.../service/InventoryService.kt` — `resolveInventoryForReserve` / `selectWarehouseInventory`
- `inventory/app/.../messaging/InventoryEventConsumer.kt` — `warehouseId = 1L` → `null`
- `inventory/app/src/test/.../InventoryServiceTest.kt` — 자동 선택 시나리오 3건 추가

## Non-Goals

- 분할 출고 (한 주문 item 을 여러 창고에서 나눠 예약)
- 지역/배송지 기반 최근접 창고 선택 (warehouse 좌표 활용 — 배송지 정보가 order 이벤트에 없음, 별도 스펙)
- warehouse 서비스와의 우선순위 연동

## Verification

- `./gradlew :inventory:domain:test :inventory:app:test` → BUILD SUCCESSFUL (2026-06-11)
