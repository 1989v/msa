# Order Service

## Overview

주문 도메인을 소유한다. 장바구니·주문서로 금액을 서버에서 정하고, 주문 사가를 오케스트레이션하며(ADR-0099),
클레임·구매 확정과 정산용 이벤트를 낸다. 흐름·규칙 요약은 `order/CLAUDE.md`.

## Module Structure

| Gradle path | Filesystem | Role |
|---|---|---|
| `:order:domain` | `order/domain/` | 순수 도메인 (Spring/JPA 없음) |
| `:order:feature` | `order/feature/` | 비-bootable 라이브러리 — `commerce:app` 이 폴드 (ADR-0058) |

## Domain Model

| 패키지 | 모델 |
|---|---|
| `order` | `Order`(Aggregate — 상태 전이·라인 취소·구매 확정·환불 누계) · `OrderItem`(라인 스냅샷, `OrderLineStatus`) · `OrderStatus` · `OrderFailureReason` · `Money`(원 단위 `Long`) · `StatusChange` · `PurchaseConfirmation` |
| `saga` | `OrderSaga`(단계·상태·시도·기한, `@Version`) · `SagaStep`(피벗 전·후·보상) · `SagaStatus` · `SagaTiming` |
| `claim` | `Claim`(REQUESTED → APPROVED → REFUNDED · REJECTED, `ClaimStep`) · `ClaimRefundPlan`(환불 계산) |
| `sheet` | `OrderSheet`(견적 스냅샷, 만료 15분) · `OrderSheetLine` · `ShippingLine` · `Allocation`(안분) · `Commission`(수수료) |
| `cart` · `catalog` · `benefit` | `CartItem` · 읽기 모델 `ProductView`·`SellerView`·`CouponDefinitionView`·`UserCouponView`·`PointBalanceView` |
| `idempotency` · `opsissue` | `IdempotencyKey`(리스 60초·보관 24시간) · `OpsIssue`(`SAGA_STUCK`·`CLAIM_STUCK`) |

## Ports (outbound, `application/{entity}/port`)

`OrderRepositoryPort` · `OrderEventPort`(정산 이벤트) · `IdempotencyKeyRepositoryPort` · `SagaPorts`(사가 저장소·명령 발행·운영 이슈) ·
`ClaimPorts` · `OrderSheetRepositoryPort` · `CartRepositoryPort` · `ReadModelRepositoryPorts`

## Infrastructure Adapters

- `persistence/{order,saga,claim,sheet,cart,readmodel,idempotency,opsissue}` — JPA 어댑터 (order EMF)
- `messaging/` — 사가·클레임·읽기 모델 컨슈머, 명령·이벤트 아웃박스 어댑터, DLT 컨슈머
- `scheduler/` — 사가 기한·체류, 클레임 기한, 자동 구매 확정, 멱등 키 정리
- `metrics/OrderSagaMetrics` — 사가 게이지

외부 HTTP 호출이 없다. 상품·판매자·혜택은 읽기 모델로, 결제는 payment 명령으로 다룬다.

## Data Ownership

`order_db` (MySQL, Master/Replica) — `orders`·`order_items`·`order_shipping`·`order_status_history` · `order_saga` · `order_claim` · `order_sheet`(+ `_line`·`_shipping`) · `cart_item` ·
읽기 모델 다섯 · `idempotency_key` · `outbox_event` · `processed_event` · `ops_issue`.

## Kafka

토픽 전체 표는 `docs/architecture/kafka-convention.md`. 명령·답·정산 이벤트 모두 키 = orderId, 읽기 모델은 엔티티 id.

## API Endpoints

| Method | Path | 인증 | Description |
|--------|------|------|-------------|
| POST | `/api/v1/order-sheets` · GET `/{id}` | ROLE_USER | 주문서 생성·조회 |
| GET·PUT·DELETE | `/api/v1/cart`, `/api/v1/cart/items/{productId}` | ROLE_USER | 장바구니 |
| POST | `/api/v1/orders` (`Idempotency-Key`) | ROLE_USER | 주문 접수 → 202 + `Location` |
| GET | `/api/v1/orders/my` · `/api/v1/orders/{id}` | ROLE_USER | 내 주문 · 단건 |
| POST | `/api/v1/orders/{id}/cancel` | ROLE_USER | 피벗 전 취소 (PAYMENT_PENDING 은 409) |
| POST | `/api/v1/orders/{id}/purchase-confirm` | ROLE_USER | 구매 확정 |
| GET `/preview` · POST · GET | `/api/v1/claims` | ROLE_USER | 클레임 미리보기·요청·목록 |
| GET · POST `/{id}/approve` · `/{id}/reject` | `/api/v1/seller/claims` | ROLE_SELLER | 출고 뒤 클레임 판매자 결정 |
| GET | `/api/v1/admin/orders/stats/**` | ROLE_ADMIN | 매출 통계 |
| GET · POST `/{id}/retry` · `/{id}/close` | `/api/v1/admin/orders/ops-issues` | ROLE_ADMIN | 운영 이슈 |

## Build

```bash
./gradlew :order:domain:test
./gradlew :order:feature:test
./gradlew :commerce:app:build
```
