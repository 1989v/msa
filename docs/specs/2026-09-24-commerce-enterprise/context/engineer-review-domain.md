# Engineer Review — Domain

- 대상: `docs/specs/2026-09-24-commerce-enterprise/spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md`)
- 차원: domain (체크리스트 `hns/0.15.1/skills/spec-review/reviewers/domain/checklist.md`)
- 리뷰일: 2026-09-24

## Seed Discovery

1. 스펙: spec.md · requirements.md · test-quality.md · ADR-0099 · `context/open-questions.yml`
2. 용어집: `docs/context-map.md`, `order/glossary.md`, `inventory/glossary.md`, `product/glossary.md`, `fulfillment/glossary.md`
3. 서비스 규칙: `order/CLAUDE.md`, `inventory/CLAUDE.md`, `fulfillment/CLAUDE.md`, `docs/adr/ADR-0058-service-consolidation.md` §불변식
4. 코드: `OrderStatus.kt`, `Order.kt`, 두 `Money.kt`, `Reservation.kt`, `FulfillmentStatus.kt`, `InventoryEventConsumer.kt`, `FulfillmentEventConsumer.kt`
5. KB: [[modular-monolith-fold]] — 불변식 1(feature 간 빈 주입 금지)·2(같은 JVM 이라도 Kafka 유지). 스펙은 이 두 불변식을 명시적으로 따른다(ADR-0099:39, requirements.md:30)

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | BC 경계 명확·누수 없음 | 부분 — B2, R6, R8 |
| 2 | 용어집 존재 | 부분 — 기존 BC 는 있음, 새 4 BC 없음 (R1) |
| 3 | 스펙 어휘 = 용어집 | **위반** — B1 (`COMPLETED` 의미 변경), R1 (신조어) |
| 4 | `Avoid:` 동의어 미사용 | 주의 — R2 (「주문 라인」 ↔ `OrderItem` Avoid `LineItem`) |
| 5 | 스펙 ↔ 코드 유비쿼터스 언어 일치 | 부분 — B1, R7 |
| 6 | 애그리거트 불변식 명시·강제 가능 | 부분 — R3, R4, R9 |
| 7 | 도메인 이벤트가 소유 애그리거트 범위 | 부분 — B2, R5 |
| 8 | 애그리거트 간 직접 참조 없음 | 통과 — id 참조 + Kafka (ADR-0099:39, spec.md:43 스냅샷 복사) |
| 9 | VO vs Entity 분류 | 부분 — R7 |

## BLOCK

### B1. `OrderStatus.COMPLETED` 의 의미가 바뀌는데 기존 발행 이벤트와 소비자가 그대로다 (체크 3·5)

- 스펙 결정: spec.md:60 이 `COMPLETED` 를 새 상태 목록에 넣고, requirements.md:66 이 그것을 「COMPLETED(구매 확정)」, 즉 배송 완료 후 7일(spec.md:67)로 정의한다.
- 기존 정의: order/glossary.md:19·25 기준으로 `complete()` 는 PENDING → COMPLETED 이고 결제 직후 `order.order.completed` 를 낸다. 코드도 같다(`OrderStatus.kt:3`, `Order.kt:31-34`).
- 소비자: inventory 가 이 토픽으로 재고를 확정한다(`inventory/feature/.../InventoryEventConsumer.kt:58`, order/glossary.md:69). 의미가 「구매 확정」으로 바뀐 뒤에도 이 구독이 남으면 문제가 생긴다. 사가가 이미 CONFIRMED 로 바꾼 예약을 7일 뒤 다시 확정하려 하고, `Reservation.requireActive` 에서 `InvalidReservationStateException` 이 나 DLT 로 간다(`Reservation.kt:58-60,80-84`).
- 같은 단어의 뜻이 바뀐 경우라 용어집 규칙상 BLOCK 이다. 「확정」도 여러 뜻으로 쓰인다. 재고 확정·혜택 확정·주문 CONFIRMED·구매 확정이 모두 이 말을 쓰고(spec.md:57,60,67), inventory/glossary.md:215 가 이미 Confirm/Cancel 충돌을 경고했다.
- **사람이 정할 것**(하나를 고른다):
  - (a) 구매 확정을 `PURCHASE_CONFIRMED` 같은 새 이름으로 두고 `COMPLETED` 는 폐기한다.
  - (b) `COMPLETED` 의 재정의를 스펙에 명시한다. 이 경우 `order.order.completed` 토픽을 없앨지, 이름을 바꿀지, 의미를 바꿀지도 정하고 기존 소비자(inventory)의 구독 해지를 SR 에 적는다.
  - 두 경우 모두 기존 `PENDING` 행과 `COMPLETED` 행을 새 상태로 옮기는 매핑을 적는다. PENDING 은 새 목록에 없다.
  - 구매 확정은 라인 단위다(spec.md:67 「확정된 라인만 정산 대상」). 주문 상태 COMPLETED 는 주문 단위다. 일부 라인만 확정된 주문이 어떤 상태인지도 정한다.

### B2. 기존 코레오그래피 구독이 새 사가 순서와 충돌하는데 해지 대상으로 적혀 있지 않다 (체크 1·7)

- 스펙 결정: 이행은 사가의 마지막 단계에서 받는 **명령**으로 생성한다(spec.md:57, ADR-0099:29). fulfillment 에 대해서는 「명령 수신만 추가」라고 적었다(spec.md:94).
- 코드: fulfillment 는 지금 `inventory.stock.reserved` 를 받으면 출고를 생성한다(`fulfillment/feature/.../FulfillmentEventConsumer.kt:28`, fulfillment/CLAUDE.md:31). 새 순서에서는 재고 예약이 결제보다 먼저라(spec.md:57) 이 구독이 남으면 **결제 전에 이행이 생긴다**. 결제가 거절돼도 출고 건이 남는다. 이 구독을 지워야 한다는 말이 스펙에 없다.
- inventory 가 `order.order.cancelled` 로 예약을 해제하는 구독(`InventoryEventConsumer.kt:160`)도 사가 보상 명령(재고 해제)과 겹친다.
- ADR-0099:4 는 「코레오그래피 대체」라고 하지만 스펙에는 없앨 구독 목록이 없다.
- **수정안**: SR-4 에 「해지할 기존 구독」 표를 추가한다. 최소한 아래 셋을 넣고, 각각 명령으로 대체되는지 적는다.
  - fulfillment ← `inventory.stock.reserved`
  - inventory ← `order.order.completed`
  - inventory ← `order.order.cancelled`

  spec.md:94 는 「명령 수신 추가 + 기존 `inventory.stock.reserved` 구독 제거」로 고친다.

## REVISE

### R1. 새 BC 4개(payment·seller·promotion·settlement)의 용어집이 없고 신조어가 등록되지 않았다 (체크 2·3)
- `docs/context-map.md:16-33` 의 BC 표에 새 4개 도메인이 없다.
- 신조어 목록: 주문서(OrderSheet) · 장바구니(Cart) · 클레임(Claim) · 사가(order_saga) · 안분 · 부담 주체 · 구매 확정 · 정산서 · 거래(journal)/분개(entry) · 미지급금 · 대사 · 운영 큐 · 상품 스냅샷 읽기 모델 (spec.md:47-71).
- 「거래(journal)」는 order/glossary.md:26 의 Order `Avoid: Transaction` 과 겹친다. settlement 용어집에서 `LedgerTransaction` 이나 `Journal` 로 이름을 고정해 둔다.
- 수정안: context-map 에 4행을 추가하고 `{bc}/glossary.md` 를 만든다. 신조어는 `/hns:glossary --conflict {term}` 으로 처리한다. SR-7(spec.md:86)의 문서 갱신 목록에 「용어집·context-map」을 추가한다.

### R2. 「주문 라인」이 order 용어집의 `Avoid: LineItem, ProductLine` 과 겹칠 수 있다 (체크 4)
- spec.md:49·50·65·66 이 「라인」을 쓰고, `OrderItem` 의 Avoid 는 order/glossary.md:37 에 있다.
- 한국어 산문 자체는 문제가 되지 않는다. 다만 이 표현이 `OrderLine`·`order_line` 같은 식별자로 이어지면 위반이다.
- 수정안: spec 에 「주문 라인 = `OrderItem`」 매핑을 한 줄 넣는다. 라인 스냅샷 필드는 `OrderItem` 에 추가하는 것으로 적는다.

### R3. 상태 전이 표가 없다: 주문 · 결제 · 클레임 · 정산서 (체크 6)
- test-quality.md:8 은 「허용 전이 표 전수 + 금지 전이 예외」를 판정 근거로 쓴다. 그런데 스펙이 전이를 정한 것은 판매자뿐이다(spec.md:39).
  - 주문: spec.md:60 에 상태 목록만 있다. PAYMENT_PENDING·PAID 가 어느 사가 단계(spec.md:57)에서 들어가는지 매핑이 없다. 전액 환불 뒤의 상태(CANCELLED 인지 별도 상태인지)와, PARTIALLY_REFUNDED 가 FULFILLING/COMPLETED 와 어떻게 공존하는지도 정해지지 않았다.
  - 결제: spec.md:30 에 목록만 있다. requirements.md:42 에 일부 그래프가 있지만 UNKNOWN 에서 어디로 갈 수 있는지, FAILED·VOIDED 가 종착인지가 빠졌다.
  - 클레임: spec.md:65 에 있는 REJECTED 가 어느 상태에서 가능한지 없다. 클레임이 Order 안에 있는지, 별도 애그리거트인지(ID 참조)도 정하지 않았다.
  - 정산서: 상태가 아예 정의되지 않았다(spec.md:70). 생성·지급 중·지급 완료·실패 같은 상태와, 모의 송금이 실패했을 때의 전이가 필요하다.
- 수정안: 네 상태 머신의 허용 전이 표를 SR-1·SR-4·SR-5 에 추가한다. 클레임의 애그리거트 경계도 한 줄 적는다.

### R4. 안분 잔차 규칙이 문서끼리 다르다 (체크 6)
- spec.md:50 은 「금액이 가장 큰 라인」, test-quality.md:10 은 「마지막 라인」이라고 한다.
- 이 둘은 테스트의 판정 근거와 도메인 불변식이 서로 다른 값을 보는 상태다. 금액이 같은 라인이 여럿일 때의 순서 규칙(예: 라인 id 오름차순)도 없다.
- 수정안: 한쪽으로 통일하고 동점일 때의 순서를 명시한다. test-quality.md:10 도 같이 고친다.

### R5. settlement 가 판매자별로 분개하려면 라인 데이터가 필요한데, 그것을 실어 나를 이벤트가 정의되지 않았다 (체크 7)
- 원장 기록 시점은 결제 매입과 환불이다(spec.md:69). 그런데 `payment.payment.captured` 는 orderId 를 키로 하는 결제 단위 이벤트다(spec.md:36). payment 는 판매자·라인·수수료율을 모른다.
- 수수료 수익과 판매자 미지급금을 나누려면 order 가 소유한 라인 스냅샷(spec.md:49)이 필요하다. 구매 확정(spec.md:67)과 클레임 환불도 settlement 가 알아야 하는데 order 가 낼 이벤트 이름이 없다.
- 계정 이름도 문서마다 다르다. spec.md:68 은 「판촉 비용」, requirements.md:76 은 「혜택 비용(플랫폼 부담)」이다.
- 수정안: SR-5 에 settlement 가 소비할 order 소유 이벤트를 명시한다. 예: `order.order.confirmed`(라인 스냅샷 포함), `order.item.purchase-confirmed`, `order.claim.refunded`. 이벤트마다 분개 규칙(차변/대변 계정)을 표로 두고 계정 이름을 하나로 정한다.

### R6. 주문서를 동기로 만들 때 다른 BC 데이터를 어떤 경로로 읽는지 정해지지 않았다 (체크 1)
- `POST /order-sheets` 는 한 번의 동기 요청 안에서 쿠폰·포인트 적용 결과, 판매자별 배송비, 수수료율을 스냅샷해야 한다(spec.md:43,48).
- 그런데 SR-0 은 HTTP 자기 호출을 없애고(spec.md:20), ADR-0099:39 는 다른 feature 빈 호출을 금지한다. 상품은 읽기 모델로 해결했지만 promotion·seller 데이터는 경로가 없다.
- 배송비는 판매자 마스터(spec.md:40)에 필드가 없다. 그런데 범위 절은 「판매자당 고정 배송비」를 전제한다(spec.md:106). 소유 BC 가 비어 있는 셈이다.
- 수정안: 둘 중 하나를 SR-3 에 명시한다.
  - order 가 seller 이벤트(수수료율·배송비)와 promotion 이벤트(쿠폰 정의)로 읽기 모델을 유지한다.
  - ADR-0058 불변식 1이 허용하는 HTTP 로 부른다(자기 호출 금지와의 관계를 함께 적는다).

  배송비 필드는 seller 마스터에 추가한다.

### R7. 금액 VO 가 정의되지 않았다 — 기존 두 `Money` 와 「원 단위 정수」가 어긋난다 (체크 5·9)
- spec.md:49 와 ADR-0099:63 은 「원 단위 정수(KRW)」로 정했다. 코드는 두 개의 BigDecimal `Money` 이고 불변식도 서로 다르다.
  - order: `>= 0` (`order/.../Money.kt:6-8`)
  - product: `> 0` (`product/.../Money.kt:6-7`)
- 이 불일치는 이미 용어집 Flagged #1 로 올라가 있다(order/glossary.md:151).
- 쿠폰으로 100% 할인되면 라인 결제액이 0 이 되므로 새 BC 들은 `>= 0` 이어야 한다. 원장 분개 금액은 `> 0` 이 맞다.
- 수정안: 새 BC 의 금액 VO(예: `Won(Long)`)와 BC 별 불변식을 정하고, order `Money` 를 정수로 바꿀지 적는다. 이것으로 Flagged #1 을 닫는다.

### R8. 판매자 소유권을 판정할 근거와 판매자 정지의 도메인 효과가 없다 (체크 1)
- spec.md:42 는 「판매자 API 는 자기 상품만(403)」이라고 한다. 그러려면 product 가 요청한 회원 id 를 sellerId 로 바꿀 수 있어야 한다. 그 매핑의 출처(JWT 클레임인지, seller 이벤트 읽기 모델인지)가 없다.
- 정지 이벤트 이름이 없다. spec.md:41 에는 `approved` 만 있다. SUSPENDED → ACTIVE 로 돌아올 때 역할을 다시 주는지도 적혀 있지 않다.
- 정지된 판매자의 상품이 주문서에서 판매 불가인지를 정하는 불변식도 없다.
- 수정안: `seller.seller.{approved,suspended,reactivated,rejected}` 이벤트를 정의한다. product·order 쪽 반응(역할 부여/회수, 판매 가능 여부)을 SR-2 에 표로 둔다.

### R9. promotion 애그리거트의 불변식이 비어 있다 (체크 6)
- spec.md:51-52 에는 구성 요소만 있다. 아래 불변식이 없다.
  - 포인트 잔액이 0 이상이어야 한다.
  - 사용자 쿠폰은 한 번만 쓸 수 있다.
  - 발행 수를 넘겨 발급할 수 없다.
  - 예약(reserve)된 쿠폰은 다른 주문에서 쓸 수 없다.
  - 부분 환불 때 쿠폰을 되돌리는지 여부. spec.md:66 은 포인트 원복만 말하고 쿠폰의 운명은 말하지 않는다.
- 수정안: SR-3 에 promotion 불변식 목록을 추가하고, 부분 취소 시 쿠폰 처리(원복 안 함 또는 전액 취소 때만 원복)를 정한다.

## 요약

- BLOCK 2: B1 `COMPLETED` 의미 변경과 기존 `order.order.completed` 소비자, B2 해지 대상이 적히지 않은 코레오그래피 구독(fulfillment 가 결제 전에 이행을 생성)
- REVISE 9: 새 BC 용어집, 라인 용어, 상태 전이 표, 안분 잔차 불일치, settlement 입력 이벤트, 주문서의 교차 BC 읽기 경로, 금액 VO, 판매자 소유권·정지, promotion 불변식

VERDICT: BLOCK

---

## Round 2

- 리뷰일: 2026-09-24 (개정본 재검토)
- 대상: 개정된 spec.md · planning/test-quality.md · planning/requirements.md §리뷰 후 추가 결정 · ADR-0099
- 사용자 결정은 다시 다투지 않는다. `COMPLETED` = 구매 확정(requirements.md:104, ADR-0099:71-73)이고, order 는 읽기 모델을 가진다(requirements.md:105).
- 아래 줄 번호는 개정본 spec.md 기준이다.

### Round 1 이슈 해소 여부

| # | 판정 | 근거 |
|---|---|---|
| B1 `COMPLETED` 의미 변경 | **해소** | spec.md:62·73 재정의 명시, spec.md:57 `order.order.completed` 은퇴, spec.md:197 이관(COMPLETED→CONFIRMED, PENDING→FAILED LEGACY_ABANDONED), ADR-0099:71-73. 부분 확정 주문의 상태는 N1 에서 다룬다 |
| B2 코레오그래피 구독 해지 | **해소** | spec.md:47-58 SR-1 표. fulfillment `onStockReserved`, inventory `onOrderCompleted`·`onOrderCancelled`·`onFulfillmentShipped`, order `onReservationExpired` 가 모두 들어 있다. test-quality.md:57 이 회귀 검사를 둔다 |
| R1 용어집·context-map | 해소 | spec.md:20-32 용어 표, spec.md:210 갱신 목록. `Journal`·`JournalEntry` 로 이름을 고정해 `Transaction` 과 겹치지 않는다(spec.md:31) |
| R2 주문 라인 | 해소 | spec.md:26 「주문 라인 = `OrderItem` (LineItem 금지 유지)」 |
| R3 상태 전이 표 | **부분** | spec.md:60-89 에 여섯 머신이 모두 생겼다. 클레임은 order 소유(requirements.md:74). 표 안에 빠진 전이가 있고, 이것이 N1 이다 |
| R4 안분 잔차 | 해소 | spec.md:136 「금액이 가장 큰 라인(동률이면 앞 라인)」, test-quality.md:33 도 같다 |
| R5 settlement 입력 이벤트 | 해소 | spec.md:148·189 (`order.order.confirmed` · `order.claim.refunded` · `order.line.purchase-confirmed`), 계정 이름은 spec.md:147 에서 하나로 정했다. requirements.md:76 에 옛 이름 「혜택 비용」이 남아 있지만 그 절은 초기 입력이고 spec.md:147 이 「이 이름만 쓴다」로 정본을 정했다 |
| R6 주문서 교차 BC 읽기 | 해소 | spec.md:92-93 읽기 모델 + 견적/최종 판정 분리, spec.md:120 판매자 배송비 필드 |
| R7 금액 VO | 해소 | spec.md:135 원 단위 `Long`, spec.md:198 `unit_price_won` 확장·백필 |
| R8 판매자 소유권·정지 | 해소 | spec.md:122-124, spec.md:190 `seller.seller.{…,suspended,reactivated}` |
| R9 promotion 불변식 | 해소 | spec.md:130-132, spec.md:141 부분 취소 때 쿠폰 유지, 전체 취소 때 반환 |

### 새 이슈 (REVISE)

#### N1. 주문·결제·사가 전이표에 스펙 본문이 요구하는 전이가 빠졌다 (체크 6)

test-quality.md:24 의 판정 근거는 「표의 모든 행 허용, 나머지 예외」다. 표에 없는 전이는 도메인 가드가 막는다. 아래 경로는 스펙 본문과 E2E 가 요구하는데 표에 없어서, 구현하면 가드 예외로 멈춘다.

- **PAID → FAILED 가 없다.** spec.md:104 는 보류가 만료됐을 때 「결제가 AUTHORIZED 면 VOID 명령 후 FAILED」라고 한다. test-quality.md:53 도 이 경로를 E2E 로 검사한다. 그런데 AUTHORIZED 를 받은 주문은 이미 PAID 이고(spec.md:70), 표에서 FAILED 로 가는 전이는 `CREATED · PAYMENT_PENDING → FAILED`(spec.md:68)뿐이다.
- **0원 주문 경로가 없다.** spec.md:102 는 결제 단계 셋을 건너뛴다고 하고, test-quality.md:55 는 「결제 없이 CONFIRMED」를 기대한다. 표에는 CREATED 에서 CONFIRMED 로 바로 가는 행이 없다(spec.md:67·71).
- **PARTIALLY_REFUNDED 에서 나가는 전이가 없다.** spec.md:75 에 따르면 CONFIRMED·FULFILLING 주문도 부분 취소가 되는데, 그 뒤에 이행 생성(→FULFILLING), 구매 확정(→COMPLETED), 두 번째 부분 취소, 남은 라인 전부 취소(→CANCELLED) 중 어느 것도 표에 없다. 결과적으로 부분 취소된 주문은 끝까지 가지 못하고, 남은 라인은 `order.line.purchase-confirmed` 를 받지 못해 정산에서 빠진다(spec.md:143·149).
- **COMPLETED 로 들어가는 조건이 모호하다.** spec.md:73 은 「구매 확정」을 계기로 두고, spec.md:75 의 `COMPLETED*` 는 「구매 확정 전 라인」이 남은 COMPLETED 주문을 허용한다. 구매 확정은 라인 단위다(spec.md:143). 따라서 첫 라인이 확정될 때 COMPLETED 인지, 살아 있는 모든 라인이 확정될 때 COMPLETED 인지 정해야 한다.
- **사가 STUCK 에서 재시도로 돌아가는 전이가 없다.** spec.md:87 에는 `STUCK` 에서 나가는 전이가 없다. 반면 운영 이슈에는 「재시도」 조치가 있다(spec.md:154). 표만 따르면 이 재시도가 가드에 막힌다.
- **결제 `PARTIALLY_REFUNDED ↔ REFUNDED` 가 양방향으로 읽힌다**(spec.md:79). REFUNDED 는 「환불 합 = 매입액」인 종착이므로 되돌아갈 수 없다. 전액 한 번에 환불하는 `CAPTURED → REFUNDED` 와, 부분 환불을 거듭하는 `PARTIALLY_REFUNDED → PARTIALLY_REFUNDED` 도 표에 없다.
- **수정안**: 아래 전이를 표에 추가한다.
  - `PAID → FAILED`(VOID 완료)
  - `CREATED → CONFIRMED`(0원)
  - `STUCK → RUNNING`(운영자 재시도)
  - 결제 `CAPTURED → REFUNDED`, `PARTIALLY_REFUNDED → PARTIALLY_REFUNDED | REFUNDED`. `↔` 는 `→` 로 고친다.

  PARTIALLY_REFUNDED 는 둘 중 하나로 정한다.
  - (a) 진행 상태에서 빼고 `refundedAmount > 0` 인 파생 표시로 둔다. 이러면 진행 상태 CONFIRMED·FULFILLING·COMPLETED 를 그대로 유지할 수 있다.
  - (b) 상태로 남기고 `PARTIALLY_REFUNDED → FULFILLING | COMPLETED | PARTIALLY_REFUNDED | CANCELLED` 를 추가한다.

  COMPLETED 는 「취소되지 않은 모든 라인이 구매 확정됨」으로 정의한다.

#### N2. 출고 전 취소 클레임이 이행을 멈추게 하는 명령이 없다 (체크 1·7)

- spec.md:81 은 출고 전 클레임을 자동 승인한다. spec.md:140-142 는 환불하고 재고를 되돌리고(`inventory.command.restock`, spec.md:56) 배송비를 환불한다.
- 그런데 fulfillment 에 가는 명령은 `fulfillment.command.create` 하나뿐이다(spec.md:187). 이행이 이미 만들어진 주문(FULFILLING, spec.md:72)을 취소해도 fulfillment 는 모르고 **환불된 상품을 출고한다.** 라인 부분 취소라면 이행에서 해당 라인을 빼야 하는데, 이 경로도 없다.
- 유지하기로 한 inventory `onFulfillmentCancelled`(spec.md:56)는 이 공백을 메우지 못한다. 이 핸들러는 ACTIVE 예약만 해제한다(`InventoryEventConsumer.kt:139` → `releaseStock`, `Reservation.kt:80` `requireActive`). 새 흐름에서는 이행이 생기기 전에 이미 예약이 CONFIRMED 다(spec.md:101). 따라서 이 구독은 늘 아무것도 하지 않는다.
- **수정안**: SR-12 에 `fulfillment.command.cancel {orderId, lineIds}` 를 추가한다(order 가 보내고 fulfillment 가 받는다). SR-8 에는 다음 세 가지를 적는다.
  - 「출고 전」을 무엇으로 판정하는지. 예: fulfillment 가 SHIPPED 이전 상태여야 하고, 판정은 fulfillment 의 거절 이벤트로 받는다.
  - 경합 규칙. 취소 명령과 출고가 엇갈리면 판매자 승인 경로로 넘긴다.
  - 재고를 되돌리는 경로는 클레임의 `inventory.command.restock` 하나라는 것. SR-1 의 `onFulfillmentCancelled` 행은 「삭제」로 바꾸거나, 늘 무동작임을 적는다.

#### N3. 정산서의 「환불 상계」가 환불 라인을 두 번 빼고, 배송비는 정산에 없다 (체크 6)

- 정산서 매출은 `order.line.purchase-confirmed` 라인에서만 나온다(spec.md:149). 그런데 환불은 구매 확정 전 라인에만 일어나고(spec.md:75 `*`), 환불액은 라인 결제액 전체다(spec.md:140). 그래서 **환불된 라인은 처음부터 매출에 없다.** 여기서 「환불 상계」를 다시 빼면 판매자가 그만큼 덜 받는다.
- 이 결과는 원장 불변식과도 충돌한다. 미지급금은 `order.order.confirmed` 에서 대변에 쌓이고 `order.claim.refunded` 에서 차변으로 줄어든다(spec.md:148). 환불 라인의 미지급금은 이미 0 이다. 그런데 정산서가 환불을 한 번 더 빼면 「지급액 = 미지급금 감소분」(spec.md:149)이 맞으려면 미지급금 잔액이 확정 라인 몫만큼 남아야 한다. 판정 근거인 test-quality.md:63 은 이 식을 그대로 검사하므로, 이중 차감을 녹색으로 굳힌다.
- 배송비는 판매자별 라인으로 스냅샷된다(spec.md:137). 하지만 구매 확정 대상도 아니고(spec.md:143 은 상품 라인), 정산식에도 없다(spec.md:149). 따라서 판매자에게 지급되지 않는다. 배송비 환불(spec.md:142)이 어느 계정을 차변에 적는지도 정해지지 않았다.
- **수정안**: 정산식을 둘 중 하나로 고친다.
  - (a) 매출 = 기간 안에 구매 확정된 라인만 두고 「환불 상계」 항을 뺀다. 현재 규칙으로는 확정 뒤 환불이 없기 때문이다.
  - (b) 매출 = 기간 안에 매입된 라인 전부, 환불 상계 = 그 라인들의 환불로 둔다. 그러면 지급 대상과 구매 확정 조건의 관계를 다시 적어야 한다.

  배송비는 다음을 정한다.
  - 「판매자 배송비 라인은 그 판매자의 첫 상품 라인이 구매 확정될 때 함께 정산 대상이 된다」 같은 규칙.
  - 배송비 수입·환불의 분개(미지급금 대변·차변).

  test-quality.md:63 에 환불 라인과 배송비 라인이 섞인 사례를 추가한다.

### 체크리스트 재판정

| # | 항목 | Round 2 |
|---|---|---|
| 1 | BC 경계 | 부분 — N2 (order → fulfillment 취소 명령 부재) |
| 2 | 용어집 존재 | 통과(계획) — spec.md:22, 210 |
| 3 | 스펙 어휘 = 용어집 | 통과 — B1 해소 |
| 4 | Avoid 동의어 | 통과 — spec.md:26 |
| 5 | 스펙 ↔ 코드 언어 | 통과 — spec.md:135, 197-198 |
| 6 | 애그리거트 불변식 | 부분 — N1, N3 |
| 7 | 이벤트 범위 | 부분 — N2 |
| 8 | 직접 참조 없음 | 통과 |
| 9 | VO vs Entity | 통과 — spec.md:135 |

### 요약

- Round 1 BLOCK 2건(B1·B2)은 해소됐다. REVISE 9건 가운데 8건이 해소됐고 R3 은 부분 해소다. R3 의 남은 부분은 N1 에 넣었다.
- 새 REVISE 3건
  - N1: 전이표 누락 — PAID→FAILED, 0원 경로, PARTIALLY_REFUNDED 이후, STUCK 재시도, 결제 환불 방향
  - N2: 출고 전 취소가 이행을 멈추는 명령이 없다
  - N3: 정산 환불 이중 차감과 배송비 누락

VERDICT: REVISE
