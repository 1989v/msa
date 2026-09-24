# Order Service

주문 — 장바구니·주문서·주문 접수, **주문 사가 코디네이터**(재고 → 혜택 → 결제 → 확정 → 이행), 클레임(전체·부분 취소)과
구매 확정. `commerce:app` 에 폴드된 라이브러리 (ADR-0058). 사가는 order 안의 코디네이터가 오케스트레이션한다 (ADR-0099 —
ADR-0032 의 코레오그래피를 대체).

## Modules

| Gradle path | 역할 |
|---|---|
| `:order:domain` | Pure Kotlin 도메인 — `Order`·`OrderItem`(라인 상태)·`OrderStatus`·`Money`(원 단위 `Long`) · `OrderSaga`·`SagaStep` · `Claim`·`ClaimRefundPlan` · `OrderSheet`·`Allocation`·`Commission` · `IdempotencyKey` · 읽기 모델(`ProductView`·`SellerView`·쿠폰·포인트) |
| `:order:feature` | 비-bootable 라이브러리 — **commerce:app 이 폴드**. 전용 datasource `order_db` (`orderEntityManagerFactory` / `orderTransactionManager`), Flyway `orderdb/migration` |

## Commands

```bash
./gradlew :order:domain:test                                        # 상태 전이표·사가 기한 판정·안분·수수료·환불 계산
./gradlew :order:feature:test                                       # 코디네이터·클레임·주문서·장바구니·멱등 키·읽기 모델 컨슈머
./gradlew :commerce:app:test --tests '*OrderSagaE2E*'               # 실 MySQL·실 Kafka·모의 PG — 정상·거절·재고 부족·UNKNOWN·보류 만료·STUCK
./gradlew :commerce:app:test --tests '*ClaimE2E*' --tests '*OrderSagaIdempotency*'
```

## 구조 상태 (ADR-0083)

표준 준수. 유스케이스 인터페이스 + `application/{entity}/port` + infrastructure 어댑터. Outbox·멱등 원장은 common 서브인터페이스
(`OrderOutboxRepository`·`OrderProcessedEventRepository`).

- `application/saga` — `OrderSagaCoordinator`(답 처리·기한·체류 감지·재개) · `SagaCommandPort`
- `application/claim` — `ClaimCoordinator`(작은 사가) · 조회
- `application/order` — 주문 접수(`OrderPlacementService`, Idempotency-Key) · 조회 · 구매 확정 · 통계
- `application/sheet` · `application/cart` · `application/readmodel`
- `infrastructure/messaging` — `OrderSagaConsumer`(`order-saga`) · `OrderClaimConsumer`(`order-claim`) · `OrderReadModelConsumer`(`order-read-model`) ·
  `SagaCommandOutboxAdapter`·`ClaimCommandOutboxAdapter`(명령) · `OrderOutboxEventAdapter`(정산 이벤트) · `OrderDltConsumer`
- `infrastructure/scheduler` — 사가 기한(5초) · 사가 체류(1분) · 클레임 기한(5초) · 자동 구매 확정(10분) · 멱등 키 정리(1시간)

## 주문 사가

`POST /api/v1/orders {orderSheetId}` + `Idempotency-Key` → 202 + `Location`. 주문·사가 행·첫 명령 아웃박스 행이 한 트랜잭션.

| 단계 | 명령 (order → 참여자) | 답 (참여자 → order) |
|---|---|---|
| 재고 예약 | `inventory.command.reserve` | `inventory.reservation.reserved` · `failed` |
| 혜택 예약 | `promotion.command.reserve` | `promotion.hold.reserved` · `failed` |
| **결제 승인 (피벗)** | `payment.command.authorize` | `payment.payment.authorized` · `failed` · `unknown` |
| 재고 확정 | `inventory.command.confirm` | `inventory.reservation.confirmed` · `failed(EXPIRED)` |
| 혜택 확정 | `promotion.command.confirm` | `promotion.hold.confirmed` · `failed(EXPIRED)` |
| 매입 | `payment.command.capture` | `payment.payment.captured` |
| 이행 생성 | `fulfillment.command.create` | `fulfillment.order.created` → 주문 FULFILLING, 사가 COMPLETED |
| 보상 | `payment.command.void` · `promotion.command.cancel`·`restore` · `inventory.command.release`·`restock` | `payment.payment.voided` · `promotion.hold.cancelled`·`restored` · `inventory.reservation.released`·`restocked` |

- **주문 상태**: CREATED → PAYMENT_PENDING → PAID → CONFIRMED → FULFILLING → COMPLETED(구매 확정). 실패는 FAILED(사유
  `OrderFailureReason`), 피벗 전 구매자 취소·전체 취소 클레임은 CANCELLED. 결제액 0원이면 결제 단계 셋을 건너뛴다(CREATED → CONFIRMED).
  전이는 `OrderStatus` 표뿐이고 전이마다 `order_status_history` 한 행.
- **피벗 전 실패**는 역순 보상 후 FAILED. **피벗 뒤**는 보상하지 않고 기한마다 같은 명령을 재발행(멱등), `order.saga.max-retries`(10) 초과 STUCK + 운영 이슈 `SAGA_STUCK`.
- **보류 만료 예외**: 재고·혜택 보류는 30분(`commerce.hold-minutes`), 사가 피벗 전 기한 10분 + UNKNOWN 재조회 최대 10분보다 길다.
  그래도 만료가 먼저 오면 결제가 AUTHORIZED 면 VOID + 확정분 restock/restore 후 FAILED(`HOLD_EXPIRED`), 결과 미상이면 VOID 를 예약해 둔다.
  매입 뒤에는 이 경로가 닫힌다.
- **결제 UNKNOWN** 동안 사가는 대기한다. PAYMENT_PENDING 중 구매자 취소는 409.
- **동시성**: `order_saga` `@Version` — 같은 주문의 답이 동시에 오면 충돌한 쪽이 다시 읽어 처리한다. 명령·답 키는 모두 orderId.
- **체류**: 한 단계에 10분 넘게 진행이 없으면 운영 이슈 `SAGA_STUCK`(열린 것이 있으면 새로 만들지 않는다). 어드민 재시도가 사가를 재개한다.

## 클레임 · 구매 확정

- `POST /api/v1/claims`(전체 또는 라인 지정, `GET /preview` 로 미리 계산) — 이행이 있으면 `fulfillment.command.cancel` →
  `fulfillment.order.cancelled` 면 자동 승인, `cancel-rejected`(이미 출고)면 판매자 결정(`/api/v1/seller/claims/{id}/approve|reject`).
  승인 뒤 재입고(출고 전만) → 혜택 원복(포인트, 전체 취소면 쿠폰) → PG 부분 환불 → REFUNDED + `order.claim.refunded`.
- 환불액 = 라인 결제액(포인트 안분분은 포인트로), 판매자 라인이 전부 출고 전 취소되면 그 배송비도. 부분 취소는 주문 상태가 아니라
  라인 상태(ACTIVE → CANCELLED)와 `refunded_amount` 다.
- 한 주문에서 답을 기다리는 클레임은 하나 — 답에 클레임 id 가 없어서(키 = orderId) 나머지는 QUEUED. 기한 초과 반복은 `CLAIM_STUCK`.
- 구매 확정: `POST /api/v1/orders/{id}/purchase-confirm` 또는 배송 완료 후 `order.purchase-confirm-days`(7)일 자동.
  라인마다 `order.line.purchase-confirmed`(판매자의 마지막 ACTIVE 라인이면 배송비 라인 동봉), 전부 확정되면 주문 COMPLETED.

## Key Rules

- **금액은 서버가 정한다** — 클라이언트는 주문서 id 만 보낸다. 주문서(`POST /api/v1/order-sheets`, 만료 15분)가 읽기 모델로 가격·
  쿠폰·포인트·판매자별 배송비를 계산해 스냅샷하고 주문 1개에만 쓰인다. 만료·재사용·소유자 불일치는 422, 남의 주문서 조회는 404.
- **금액은 원 단위 `Long`**(`Money.amount`). `order_items` 는 `unit_price_won` 을 읽고, 확장 단계라 옛 `unit_price` 에도 같은 값을 쓴다(삭제는 다음 단계).
- **Idempotency-Key**: (사용자, 키) 유니크, 처리 중 리스 60초(409), 완료 뒤 저장 응답 그대로, 24시간 보관. 결제 대기 주문은 사용자당 3건(`order.pending-order-limit`, 초과 429).
- **읽기 모델**(`product_view`·`seller_view`·`coupon_definition_view`·`user_coupon_view`·`point_balance_view`)은
  `OrderReadModelConsumer` 가 이벤트로만 채운다. 늦게 온 옛 이벤트는 `occurred_at` 으로 거른다.
  플랫폼 판매자 1 은 이벤트가 없어 마이그레이션이 시드한다
- **배포 뒤 1회**: 상품 이벤트는 변경 때만 나가므로 기존 상품은 읽기 모델에 없다 —
  어드민 토큰으로 `POST /api/v1/admin/products/republish` 를 한 번 부른다(여러 번 불러도 안전).
  확인: `SELECT COUNT(*) FROM order_db.product_view` = `SELECT COUNT(*) FROM product_db.products`
- **발행**(아웃박스, 키 = orderId): 명령 토픽(위 표) + 정산 이벤트 `order.order.confirmed`(매입 시 라인·배송비) ·
  `order.claim.refunded` · `order.line.purchase-confirmed`. 옛 `order.order.completed`·`cancelled` 는 은퇴했다 — 되살리지 않는다(옛 의미로 읽힌다).
- 사가 코디네이터는 다른 feature 빈을 부르지 않는다 — 같은 JVM 이어도 참여자와는 Kafka 로만 (ADR-0058 불변식 2).
- 경로: `/api/v1/orders/**`·`/api/v1/claims/**`·`/api/v1/cart/**`·`/api/v1/order-sheets/**` ROLE_USER(본인 것만, `X-User-Id` 없으면 401),
  `/api/v1/seller/claims/**` ROLE_SELLER, `/api/v1/admin/orders/{stats,ops-issues}/**` ROLE_ADMIN.
- **운영 이슈** `/api/v1/admin/orders/ops-issues`: 재시도는 종류별 — `DLT` 원 토픽 재발행 · `SAGA_STUCK` 사가 재개 · `CLAIM_STUCK` 클레임 재개.
  `order-dlt-ops` 그룹이 `<원 토픽>.DLT` 중 order 컨슈머 그룹(`order-saga`·`order-claim`·`order-read-model`)이 실패한 것만 적재한다.
- **지표**: `commerce_saga_active{status}` · `commerce_saga_step_dwell_max_seconds` · `commerce_saga_compensations`.
- 운영 `orders.status`·`fulfillment_order.status` 는 Hibernate 가 만든 ENUM 이었다 — VARCHAR(20) 로 바꿨다. 상태를 늘릴 때 운영 컬럼 타입을 먼저 본다.

## Docs

- [서비스 상세](docs/service.md) — 도메인 모델, 포트, 어댑터, API
- 용어: `order/glossary.md` · ADR: `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md` · 토픽: `docs/architecture/kafka-convention.md`
