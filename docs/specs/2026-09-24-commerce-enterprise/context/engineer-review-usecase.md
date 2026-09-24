# Engineer Review — usecase

- 대상: `docs/specs/2026-09-24-commerce-enterprise/spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md`)
- 차원: usecase (액터·흐름·사전/사후 조건·AC 추적·엣지 케이스·테스트 매핑)
- 리뷰일: 2026-09-24
- KB: `[[modular-monolith-fold]] (vault, 2026-09-11)` — 폴드 도메인 간 이벤트는 같은 JVM 이라도 Kafka 를 쓴다(37행). 스펙 SR-1:36 · ADR-0099:39 가 이 원칙을 따르므로 충돌은 없다. 사가·TCC·원장 개념 페이지는 볼트에 없다.

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 액터-목표 쌍 | 통과 — 구매자·판매자·운영자·개발자 넷이 `spec.md:11-15` 에 있다 |
| 2 | 주 흐름·대안 흐름·예외 흐름 | **미흡** — U1, U3 |
| 3 | 사전·사후 조건 | **미흡** — U2 |
| 4 | AC 추적성 | **미흡** — U5 |
| 5 | 엣지 케이스 전개 | **미흡** — U4 |
| 6 | 테스트 전략 매핑 | 부분 통과 — `test-quality.md` 가 있지만 빠진 항목과 모순이 있다 (U5) |

## 발견 사항

### U1 (Check 2·5, 중요) 결제 UNKNOWN 대기 중 재고 예약 TTL 과 혜택 예약이 먼저 풀린다
- 스펙 근거
  - 예약 TTL 은 15분이고 "결제 대기 구간에만" 걸린다 (`spec.md:24`).
  - 혜택 예약은 "주문서 만료와 같이 풀린다"고 했고, 주문서 만료는 15분이다 (`spec.md:52`, `spec.md:48`).
  - 결제 UNKNOWN 이면 사가는 대기하고 주문을 먼저 취소하지 않는다 (`spec.md:59`). 재조회는 지수 백오프로 5회까지 한다 (`spec.md:33`).
- 코드 근거: 만료 스케줄러는 ACTIVE 예약을 사가 상태와 상관없이 만료시키고 재고를 되돌린다 (`inventory/feature/src/main/kotlin/com/kgd/inventory/application/reservation/service/ReservationExpiryService.kt:41-55`).
- 문제: 재조회가 15분을 넘긴 뒤 AUTHORIZED 로 결론 나면 피벗은 이미 지났다. 그런데 재고 예약과 쿠폰·포인트 예약은 풀린 상태다. 이어지는 재고 확정·혜택 확정은 재시도해도 성공할 수 없고, 운영 큐로 빠진다 (`spec.md:58`). ADR-0099 가 없애겠다고 한 "결제된 재고가 다시 팔림" 결함(`ADR-0099:17`)이 UNKNOWN 경로로 다시 생긴다.
- 수정안: 스펙에 다음 둘 중 하나를 적는다.
  - (a) 결제 승인 명령을 낸 시점부터 재고·혜택 예약 만료를 멈추거나 사가가 연장한다. 예약 만료는 피벗 전 단계에서만 적용한다.
  - (b) 만료 뒤에 AUTHORIZED 가 되면 VOID 로 되돌리고 주문을 FAILED 로 만든다. 이 경로를 명시적인 예외 흐름으로 적는다.
- 어느 쪽이든 `test-quality.md` 에 E2E 한 행을 추가한다: "UNKNOWN 이 TTL 을 넘긴 뒤 AUTHORIZED".

### U2 (Check 3) 주문 상태와 사가 단계의 대응 및 전이표가 없다
- 스펙 근거: 사가 단계(`spec.md:57`)와 주문 상태 9종(`spec.md:60`)이 따로 나열돼 있다. 어느 단계에서 PAYMENT_PENDING·PAID·CONFIRMED 로 넘어가는지, CANCELLED 와 FAILED 를 무엇으로 가르는지, FULFILLING·COMPLETED 는 어떤 이벤트로 넘어가는지가 적혀 있지 않다.
- 테스트는 이 전이표를 전제로 한다. "허용 전이 표 전수 + 금지 전이 예외"(`test-quality.md:8`)라고 했는데 스펙에 표가 없어서 테스트가 무엇을 기준으로 삼을지 정해지지 않았다.
- 코드 근거: 지금 `Order.cancel()` 은 PENDING 에서만 된다 (`order/domain/src/main/kotlin/com/kgd/order/domain/order/model/Order.kt:36-37`, `OrderStatus.kt:3`). ADR-0099:17 이 짚은 "취소가 PENDING 가드에 막혀 DLT" 결함이 이 가드에서 나왔다. 새 상태 집합에서 같은 모양이 다시 나오지 않으려면 표가 필요하다.
- 사가가 RUNNING 인 동안(PAYMENT_PENDING) 구매자가 취소를 요청하면 어떻게 되는지 정의가 없다. 클레임은 출고 전·후만 다룬다 (`spec.md:65`).
- 수정안: SR-4 에 표를 추가한다. 열은 `상태 | 진입 단계/이벤트 | 허용 다음 상태 | 취소 요청 시 동작` 이다. 사가 진행 중의 취소 요청은 둘 중 하나로 정한다: 피벗 전이면 보상 흐름을 탄다, 피벗 뒤이면 사가가 완료된 뒤 클레임으로 처리한다.

### U3 (Check 2, 주 흐름) 구매자가 결제 수단을 제출하는 단계가 흐름에 없다
- 스펙 근거: 사가가 `payment.command.authorize` 로 승인을 낸다 (`spec.md:36`, `spec.md:57`). 그런데 구매자가 결제 수단을 고르고 인증하는 단계가 주문서(`spec.md:48`)와 주문 요청(`spec.md:55`) 어디에도 없다.
- 멱등 키 정의도 섞여 있다. "가맹점 주문번호 = `paymentKey` 멱등 키"(`spec.md:32`)라고 썼는데, 토스에서 `paymentKey` 는 클라이언트 인증 뒤 PG 가 발급하는 값이다. 가맹점 주문번호(orderId)와는 다른 값이다. requirements 는 "가맹점 주문번호 = 결제 멱등 키"라고만 썼다 (`requirements.md:44`).
- 수정안: 결제 흐름을 두 갈래로 적는다.
  - 모의 PG: 주문서에 모의 결제수단 토큰을 담고 사가가 서버에서 승인한다.
  - 토스: 클라이언트 위젯 인증을 `POST /orders` 앞에서 할지, 사가가 클라이언트 confirm 을 기다리는 단계를 둘지 정한다.
- 멱등 키 이름은 "가맹점 주문번호(merchantOrderId)"로 바로잡는다.

### U4 (Check 5) 엣지 케이스가 체계적으로 펼쳐져 있지 않다
스펙에 정의가 없는 경우들이다.
- 주문서 만료나 재사용: 만료된 `orderSheetId` 로 주문하면 어떤 응답인지(`spec.md:48`). 같은 주문서로 다른 `Idempotency-Key` 를 보내 두 번 주문하면 어떻게 되는지(`spec.md:55`). 멱등 키는 (user_id, key) 에만 유니크다(`spec.md:61`).
- 결제액 0원: 포인트·쿠폰으로 전액을 할인한 주문이 결제 승인 단계를 건너뛰는지 (`spec.md:52`, `spec.md:57`).
- 부분 취소 뒤 최소 주문 금액 미달: 쿠폰 조건(`spec.md:51`)이 깨졌을 때 쿠폰 할인을 회수하는지, 안분대로 유지하는지 (`spec.md:66`).
- 배송비 환불: 판매자별 배송비(`spec.md:48`)를, 그 판매자 라인을 전부 취소했을 때 돌려주는지 (`spec.md:66` 에 없다).
- 음수 정산: 한 정산 기간의 환불 상계가 매출보다 크면 어떻게 하는지 (`spec.md:70`). 이월할지, 0원 정산서로 둘지.
- 판매자 정지: 정지 시점에 판매 중인 상품의 판매 가능 여부, 진행 중인 주문과 미지급 정산을 어떻게 다루는지 (`spec.md:39`, `spec.md:41`).
- REJECTED 판매자의 재신청: "1인 1판매자"(`spec.md:39`)와 어떻게 맞출지.
- 혜택 예약 실패: 주문서를 만든 뒤 쿠폰이 소진되거나 만료된 경우. 피벗 전 보상 규칙(`spec.md:58`)으로 처리되지만 사용자에게 보여 줄 실패 사유가 없다.
- 수정안: SR-3·SR-4·SR-5 끝에 "예외·경계" 소절을 두고 위 항목마다 한 줄씩 결정을 적는다. 스펙 범위 밖으로 둘 항목은 Out of Scope(`spec.md:102-107`)로 옮긴다.

### U5 (Check 4·6) AC 추적성: 문서끼리 어긋나고 테스트가 빠진 SR 이 있다
- 문서 간 모순
  - 안분 잔차를 받는 라인: 스펙은 "금액이 가장 큰 라인"(`spec.md:50`), 테스트는 "마지막 라인"(`test-quality.md:10`)이다.
  - 정산 지급액 공식: 스펙에는 판매자 부담 할인이 들어 있는데(`spec.md:70`), 테스트 판정은 "매출 − 수수료 − 환불분"뿐이다 (`test-quality.md:24`).
  - reservation 유니크 키: requirements 는 (order_id, product_id)(`requirements.md:69`), 스펙은 (order_id, product_id, warehouse_id)(`spec.md:61`)다. 현재 모델에는 `warehouseId` 가 있다 (`Reservation.kt:10`). 스펙 쪽을 정본으로 적어 둔다.
- 사가 수준 UNKNOWN 테스트 누락: requirements 는 "결제 타임아웃→UNKNOWN→조회 성공"을 사가 E2E 로 요구한다 (`requirements.md:85`). 그런데 테스트 표에는 payment 통합 테스트만 있다 (`test-quality.md:13`). "사가가 대기하고 주문을 먼저 취소하지 않는다"(`spec.md:59`)를 판정하는 행이 없다.
- 테스트 행이 없는 SR
  - SR-0: 가격 필드 제거 `spec.md:23`. 현재 FE 가 `unitPrice` 를 보낸다(`portal-fe/src/api/shopApi.ts:89`, `:104`). 부분 예약 전부 롤백 `:25`. 만료·확정 시 재고 동기화 이벤트 `:26`.
  - SR-1: 환불 합이 매입액을 넘지 않음, VOID 경로 `:35`.
  - SR-2: 정지 시 역할 회수 `:41`. 남의 상품 수정 403 `:42` — 테스트 표 27행은 승인 전 403 만 본다. 수수료율 스냅샷 불변 `:43`.
  - SR-3: 주문서 만료 시 혜택 예약 해제 `:52`.
  - SR-4: 멱등 응답 24시간 만료 `:55`.
  - SR-5: 출고 뒤 클레임의 판매자 승인과 반려 `:65`.
  - SR-6: DLT 재발행과 종결 `:75`.
- 수정안
  - `test-quality.md` 각 행에 `SR-x` 태그 열을 추가한다.
  - 위 SR 마다 행을 하나씩 추가한다. 이미 다른 행이 덮고 있는 SR 은 그 행에 태그만 단다.
  - 모순 세 건은 스펙 기준으로 통일한다.

## 요약
액터와 큰 흐름은 분명하다. 다만 결제 UNKNOWN 과 예약 만료가 겹치는 예외 흐름(U1)이 이 스펙이 없애려는 결함을 다시 만든다. 주문 상태 전이표(U2)와 구매자 결제 단계(U3)도 비어 있다. 모두 스펙 안에서 고칠 수 있고 사람의 결정이 필요한 충돌은 아니어서 REVISE 로 판정한다.

VERDICT: REVISE

## Round 2

- 리뷰일: 2026-09-24 (개정본 재검토)
- 대상: 개정된 `spec.md` (SR 번호가 0~14 로 다시 매겨짐), `planning/test-quality.md`, `planning/requirements.md:100-108`, ADR-0099
- 기준: 이대로 구현하면 틀린 코드가 나오는 것만 이슈로 올린다. 사용자 결정은 다시 따지지 않는다.

### 1차 이슈 해소 여부

| 이슈 | 판정 | 근거 |
|---|---|---|
| U1 UNKNOWN 대기 중 예약 만료 | **해소** | `spec.md:104` — 보류 기한 30분이 피벗 전 기한 10분과 UNKNOWN 재조회 10분의 합보다 길다. 만료가 먼저 오면 VOID 후 FAILED, 결론이 아직 없으면 VOID 를 예약한다. 테스트는 `test-quality.md:53` |
| U2 주문 전이표 부재 | **해소, 단 새 구멍 있음 (N1·N2)** | `spec.md:62-77` 에 표가 생겼다. PAYMENT_PENDING 중 취소는 409 (`spec.md:77`) |
| U3 결제 수단 제출 단계 · 멱등 키 이름 | **해소** | `spec.md:111` — 모의 PG 는 서버 승인, 토스는 결제창 인증 뒤 confirm. `orderNo`(멱등 키)와 `paymentKey`(PG 거래 키)를 나눴다 |
| U4 엣지 케이스 | **해소** | 주문서 만료·재사용 422 `spec.md:99` · 0원 `:102` · 혜택 실패 사유 BENEFIT_UNAVAILABLE `:93` · 쿠폰 유지 `:141` · 배송비 `:142` · 음수 정산 CARRIED_OVER `:85`,`:149` · 판매자 정지 `:124` · REJECTED 재신청 `:83` |
| U5 AC 추적성 | **해소** | 잔차 규칙 통일 `test-quality.md:33` ↔ `spec.md:136`. 지급액 공식 통일 `test-quality.md:63` ↔ `spec.md:149`. reservation 유니크 통일 `requirements.md:69` ↔ `spec.md` R4. 사가 UNKNOWN E2E `test-quality.md:52`. SR 열 추가 `test-quality.md:22`. E2E 목록의 정본을 명시 `requirements.md:108` |

U5 에서 테스트 행이 아직 없는 항목이 남아 있다. 출고 뒤 클레임의 판매자 승인·반려(`spec.md:81`), PAYMENT_PENDING 취소 409(`spec.md:77`), 멱등 응답 24시간 만료(`spec.md:98`)다. 셋 다 구현을 틀리게 만드는 것은 아니어서 이슈로 세지 않았다. 태스크를 쓸 때 행을 추가하면 된다.

### 새 이슈

#### N1 (Check 2·3, 중요) 보류 만료로 VOID 하는 경로가 전이표에 없고, 이미 확정된 쪽의 보상도 적혀 있지 않다
- 스펙 근거
  - `spec.md:104` 는 예약 만료가 먼저 오고 결제가 AUTHORIZED 이면 VOID 한 뒤 FAILED 로 보낸다고 적었다.
  - 그런데 AUTHORIZED 가 되면 주문은 이미 PAID 다 (`spec.md:70`). 전이표에서 FAILED 로 가는 이전 상태는 `CREATED · PAYMENT_PENDING` 뿐이다 (`spec.md:68`).
  - 테스트는 "표의 모든 행 허용, 나머지 예외"로 판정한다 (`test-quality.md:24`). 이대로 구현하면 도메인 가드가 PAID → FAILED 를 막는다. 그러면 `test-quality.md:53` 의 E2E 가 실패하거나, 코디네이터가 예외를 삼키고 VOID 만 한 채 주문이 PAID 로 남는다.
  - 피벗 뒤 단계는 재고 확정 → 혜택 확정 → 매입 순서다 (`spec.md:101`). 재고 확정은 성공했는데 혜택 보류가 만료된 경우(또는 그 반대)가 있다. 그때 VOID 후 FAILED 로 가면서 CONFIRMED 된 재고 예약을 무엇으로 되돌리는지(`inventory.command.restock` 인지 release 인지) 적혀 있지 않다. `spec.md:103` 의 "피벗 뒤는 재시도만" 규칙과도 어긋난다.
- 수정안
  - 전이표에 `PAID | FAILED | 보류 만료 → 결제 VOIDED (보상 완료)` 한 행을 추가한다.
  - `spec.md:104` 에 한 줄을 덧붙인다: 이 경로는 "피벗 뒤는 재시도만"의 유일한 예외이고, 이미 확정된 재고는 `inventory.command.restock`, 이미 확정된 혜택은 `promotion.command.restore` 로 되돌린다.
  - 매입(CAPTURED) 뒤에는 VOID 가 불가능하다 (`spec.md:79`). 매입 뒤에 이 경로가 열리지 않는다는 점도 함께 적는다.

#### N2 (Check 3) PARTIALLY_REFUNDED 에서 나가는 전이가 없다
- 스펙 근거
  - 부분 취소는 CONFIRMED·FULFILLING·COMPLETED 에서 PARTIALLY_REFUNDED 로 간다 (`spec.md:75`). 그런데 표에는 PARTIALLY_REFUNDED 에서 나가는 행이 하나도 없다.
  - CONFIRMED 에서 라인 하나를 부분 취소하면 남은 라인은 이행되고 구매 확정돼야 한다 (`spec.md:143`). 이때 FULFILLING·COMPLETED 로 넘어가는 전이, 두 번째 부분 취소, 마지막 라인까지 취소됐을 때 CANCELLED 로 가는 전이가 모두 금지 전이가 된다.
  - 테스트가 표 밖의 전이를 예외로 판정하므로(`test-quality.md:24`), 부분 취소한 주문은 이행 생성·구매 확정 이벤트가 오면 가드 예외로 DLT 에 간다. ADR-0099:17 이 없애려는 "취소가 가드에 막혀 DLT" 결함과 같은 모양이다.
- 수정안: 둘 중 하나로 정한다.
  - (a) PARTIALLY_REFUNDED 를 상태가 아니라 표시(플래그·집계)로 내리고, 주문 상태는 진행 축(CONFIRMED → FULFILLING → COMPLETED)만 따라가게 한다.
  - (b) 표에 행을 추가한다: `PARTIALLY_REFUNDED → PARTIALLY_REFUNDED`(추가 부분 취소), `→ FULFILLING`(이행 생성), `→ COMPLETED`(남은 라인 구매 확정), `→ CANCELLED`(남은 라인 전부 취소).
- 같은 곳에 한 줄을 더 적는다. 구매 확정은 라인 단위다 (`spec.md:143`, `order.line.purchase-confirmed`). 주문이 COMPLETED 가 되는 조건을 "취소되지 않은 라인이 전부 확정됐을 때"로 명시한다.

#### N3 (Check 5, 경미) 정지된 판매자가 새 판매자를 신청해 정지를 피할 수 있다
- 스펙 근거: 1인 1판매자 판정은 "ACTIVE·PENDING 기준"이다 (`spec.md:120`). SUSPENDED 가 이 기준에 들어 있지 않다. 그래서 정지된 회원이 `/api/v1/sellers/apply` 로 새 신청 행을 만들 수 있다 (`spec.md:166`). 운영자가 모르고 승인하면 `seller.seller.approved` 가 ROLE_SELLER 를 다시 준다 (`spec.md:122`). 정지 즉시 차단(`spec.md:123`)이 무력해진다.
- 수정안: 판정 기준을 "ACTIVE·PENDING·SUSPENDED 가 있으면 신청 불가"로 바꾼다. 재신청이 허용되는 것은 REJECTED 뿐이다(`spec.md:83` 과 일치).

### 체크리스트 재판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 액터-목표 쌍 | 통과 |
| 2 | 주 흐름·대안 흐름·예외 흐름 | 부분 통과 — N1 |
| 3 | 사전·사후 조건 | 부분 통과 — N1, N2 |
| 4 | AC 추적성 | 통과 |
| 5 | 엣지 케이스 전개 | 부분 통과 — N3 |
| 6 | 테스트 전략 매핑 | 통과 (남은 테스트 행 3건은 태스크 단계에서 추가) |

### 요약
1차 이슈 다섯 건은 모두 해소됐다. 개정으로 들어간 전이표에는 두 군데 구멍이 있다. 보류 만료 VOID 경로(PAID → FAILED)와 부분 취소 뒤의 전이다. 둘 다 표 전수 테스트와 도메인 가드를 그대로 따르면 틀린 코드가 나오는 자리다. 표에 행을 몇 줄 추가하면 고쳐지고 사람의 결정이 필요한 충돌은 없어서 REVISE 로 판정한다.

VERDICT: REVISE
