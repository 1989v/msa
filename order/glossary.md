# Order — Domain Glossary

## 1. Bounded Context Overview

Order BC 는 **주문과 그 진행(사가)의 권위**다. 금액은 주문서 스냅샷에서만 오고, 사가 코디네이터가 재고·혜택·결제·이행 도메인에
명령을 보내 답으로 주문을 옮긴다(ADR-0099). 상품·판매자·쿠폰·포인트는 이벤트로 받은 읽기 모델로만 읽는다.
정산은 order 가 내는 라인 이벤트(`order.order.confirmed`·`order.claim.refunded`·`order.line.purchase-confirmed`)로 받는다.

## 2. 용어

| 용어 | 뜻 | 코드 이름 |
|---|---|---|
| 주문 | 주문서 하나로 만든 거래 단위. 상태는 CREATED → PAYMENT_PENDING → PAID → CONFIRMED → FULFILLING → COMPLETED, 실패 FAILED, 취소 CANCELLED | `Order` · `OrderStatus` |
| 주문 라인 | 주문 한 줄. 상품명·판매가·수량·쿠폰/포인트 안분·쿠폰 부담 주체·수수료율·판매자 스냅샷. 금액은 바뀌지 않는다 | `OrderItem` (LineItem 금지) |
| 라인 상태 | ACTIVE · CANCELLED(부분 취소) · PURCHASE_CONFIRMED | `OrderLineStatus` |
| 배송비 라인 | 판매자별 고정 배송비. 주문서에서 판매자마다 한 번 | `ShippingLine` |
| 금액 | 원 단위 정수(KRW 고정), 0 이상 | `Money(amount: Long)` |
| 주문서 | 서버가 읽기 모델로 계산한 금액·혜택 견적 스냅샷. 만료 15분, 주문 하나에만 쓴다 | `OrderSheet` |
| 견적 | 주문서의 할인·잔액. 최종 판정은 사가의 혜택 예약이 한다 | — |
| 안분 | 주문 단위 할인(쿠폰·포인트)을 라인 결제 대상 금액 비율로 나눔. 원 단위 잔차는 금액이 가장 큰 라인(동률이면 앞) | `Allocation` |
| 수수료 | 반올림(HALF_UP)(라인 순매출 × bp / 10000). 배송비에는 없다 | `Commission` |
| 결제 확정 | 재고·혜택 확정 + 매입이 끝난 주문 | `CONFIRMED` |
| 구매 확정 | 고객 버튼 또는 배송 완료 후 7일 자동. 확정된 라인만 정산 대상. 모든 ACTIVE 라인이 확정되면 주문 COMPLETED | `completePurchase` · `PurchaseConfirmation` |
| 사가 | 주문 하나의 진행 상태(단계·시도·기한). 주문 행과 한 트랜잭션에서 움직인다 | `OrderSaga` · `SagaStep` · `SagaStatus` |
| 피벗 | 결제 승인. 앞 단계는 보상, 뒤 단계는 재시도로 끝낸다 | `SagaPhase.PRE_PIVOT` · `POST_PIVOT` |
| 보상 | 피벗 전 실패 시 역순으로 되돌리는 단계(결제 VOID · 혜택 취소/원복 · 재고 해제/재입고) | `SagaPhase.COMPENSATION` |
| 보류 만료 | 재고·혜택 보류(30분)가 사가보다 먼저 끝난 것. 매입 전이면 VOID 로 되돌리고 FAILED(`HOLD_EXPIRED`) | `markHoldsExpired` |
| 멈춘 사가 | 재시도 한도(10) 초과 또는 10분 넘게 진행 없음. 운영 이슈로 올라가고 어드민이 재개 | `SAGA_STUCK` |
| 실패 사유 | FE 가 안내 문구를 고르는 계약 값 | `OrderFailureReason` |
| 멱등 키 | 주문 접수 요청 키. (사용자, 키) 유니크, 리스 60초, 보관 24시간 | `IdempotencyKey` |
| 클레임 | 주문 후 전체·라인 부분 취소 요청. REQUESTED → APPROVED → REFUNDED · REQUESTED → REJECTED | `Claim` · `ClaimStatus` |
| 클레임 단계 | 이행 취소 → (출고됐으면 판매자 결정) → 재입고 → 혜택 원복 → PG 환불. 주문당 답을 기다리는 클레임은 하나, 나머지 QUEUED | `ClaimStep` |
| 환불 계산 | 라인 결제액(포인트 안분분은 포인트로) + 판매자 라인 전부 출고 전 취소 시 배송비. 쿠폰은 재계산하지 않는다 | `ClaimRefundPlan` |
| 환불 누계 | 부분 환불 합. 「부분 환불」 표시는 이 값 > 0 에서 유도 | `refundedAmount` |
| 읽기 모델 | 다른 도메인 이벤트로 채운 사본 — 상품·판매자·쿠폰 정의·사용자 쿠폰·포인트 잔액 | `ProductView` · `SellerView` · `CouponDefinitionView` · `UserCouponView` · `PointBalanceView` |
| 운영 이슈 | 사람이 봐야 하는 건 — 멈춘 사가·클레임, DLT | `OpsIssue` |

## 3. 다른 BC 와 겹치는 말

| 용어 | 본 BC | 다른 BC |
|---|---|---|
| Order | 고객 주문 | fulfillment `FulfillmentOrder`(창고별 이행), quant `OrderCommand`(거래소 주문) |
| OrderStatus | 위 8상태 | quant 에도 같은 이름(의미 다름) — 패키지로 구분 |
| 확정 | 결제 확정(CONFIRMED) · 구매 확정(COMPLETED) 둘을 구분해 쓴다 | inventory 예약 확정 · promotion 보류 확정은 사가 단계 이름 |
| Money | 원 단위 `Long`, 0 허용 | product `Money` 는 판매가 — `BigDecimal`, 0 불가, 새 값은 원 단위 정수만(`isWholeWon`) |
