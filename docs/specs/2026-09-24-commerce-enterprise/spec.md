# Specification: commerce 엔터프라이즈화

> 400줄을 넘는다. 도메인 넷을 새로 폴드하고 기존 사가를 교체하는 한 결정(ADR-0099)이라 SR 을 나누되 한 문서에 둔다.
> 구현·배포는 §단계(P0~P7)로 쪼개고 단계마다 푸시·배포한다.

## Goal

commerce 의 주문 흐름을 **재고 예약 → 혜택 예약 → 결제(피벗) → 확정** 순서의 오케스트레이션 사가로 다시 세우고,
결제·판매자(마켓플레이스)·혜택·정산 네 도메인을 폴드해 주문부터 판매자 지급까지 원장으로 맞아떨어지게 한다.
2026-09-24 분석에서 나온 결함(⚑)과 리뷰에서 나온 기존 보안 결함 둘도 함께 없앤다.

## User Stories

- 구매자로서 장바구니에서 주문서를 만들고 쿠폰·포인트를 적용해 결제하고, 결제가 늦어져도 「진행 중」을 본 뒤 결과를 확인하고 싶다.
- 구매자로서 주문 전체 또는 일부 상품을 취소하고, 쓴 쿠폰·포인트와 결제 금액이 안분대로 돌아오기를 바란다.
- 판매자로서 입점 신청 후 승인되면 상품을 올리고, 내 주문과 정산서(순매출·배송비·수수료·지급액)를 보고 싶다.
- 운영자로서 판매자 신청을 승인·정지하고, 결과 미상 결제·대사 불일치·DLT·멈춘 사가를 한 화면에서 처리하고 싶다.
- 개발자로서 주문 id 하나로 사가 단계·상태 이력·traceId 로그를 모아 어디서 멈췄는지 알고 싶다.

## 용어

사전 등록은 각 도메인 `glossary.md` 와 `docs/context-map.md` 에 한다(SR-8). 이 스펙 안의 뜻:

| 용어 | 뜻 | 코드 이름 |
|---|---|---|
| 주문 라인 | 주문 한 줄. order 사전의 `OrderItem` 과 같은 것 | `OrderItem` (LineItem 금지 유지) |
| 주문서 | 서버가 계산한 금액·혜택 견적 스냅샷, 만료 있음 | `OrderSheet` |
| 안분 | 주문 단위 할인을 라인에 나눠 적는 것 | `allocation` |
| 클레임 | 주문 후 취소·부분 취소 요청 레코드 | `Claim` |
| 정산서 | 판매자·기간별 지급 계산 결과 | `SettlementStatement` |
| 거래·분개 | 원장의 거래 한 건과 그 차·대 줄 | `Journal` · `JournalEntry` |
| 운영 이슈 | 사람이 봐야 하는 건 (UNKNOWN 초과·대사 불일치·DLT·체류 사가) | `OpsIssue` |

## Specific Requirements

### SR-0 결함 제거 · 보안 선행
- 클라이언트가 보내는 가격 필드는 API 에서 사라진다. 금액은 주문서 스냅샷에서만 온다.
- 상품 등록·수정은 **해당 상품의 판매자(ACTIVE) 또는 ROLE_ADMIN** 만 한다. 그 외 403. 판매자가 만드는 상품의 `seller_id` 는 요청 본문이 아니라 요청자의 ACTIVE 판매자 행에서 정한다. 게이트웨이 라우트를 ROLE_SELLER|ROLE_ADMIN 으로 좁히고 서비스가 소유를 다시 검사한다. 헤더가 없으면 거부한다(허용으로 떨어지지 않는다).
- 일괄 등록 `/api/products/bulk`(search-batch 시드가 게이트웨이 없이 부름)는 `/internal/products/bulk` 로 옮긴다 — 게이트웨이 라우트가 없고 클러스터 내부 NetworkPolicy 로만 닿는다. search-batch 호출도 같은 단계에서 바꾼다.
- `GET /api/v1/orders/stats/**` 는 ROLE_ADMIN 전용(`/api/v1/admin/orders/stats/**` 로 이동).
- 주문 검증은 HTTP 자기 호출 대신 order 소유 읽기 모델(SR-3)을 쓴다. `PRODUCT_SERVICE_URL`·`PAYMENT_SERVICE_URL`·order 의 `WebClient` 가 코드에서 사라진다.
- product 이벤트는 아웃박스로 발행한다(현재 직접 send).
- 아웃박스 릴레이는 페이로드 원문 JSON 을 String 직렬화기로 보낸다. 컨슈머가 받은 값의 첫 글자가 `{` 다.
- 한 주문의 재고 예약은 한 트랜잭션에서 전부 성공 또는 전부 실패한다. 여러 재고 행은 inventory id 오름차순으로 `SELECT … FOR UPDATE` 해 교착과 낙관락 충돌을 피한다. 부족은 예외가 아니라 `inventory.reservation.failed` 이벤트다.
- 예약 확정·만료·해제·입고 모두 `inventory.stock.*` 동기화 이벤트를 낸다 — product 재고가 어긋나지 않는다.
- 남은 외부 HTTP 호출(토스)은 연결 3초·읽기 5초 (ADR-0015).

### SR-1 은퇴하는 기존 구독 · 경로

| 대상 | 지금 | 이후 |
|---|---|---|
| inventory `onOrderCompleted` (`order.order.completed`) | 결제 뒤 예약 | 삭제 — `inventory.command.reserve` 가 대체 |
| inventory `onOrderCancelled` (`order.order.cancelled`) | 예약 해제 | 삭제 — `inventory.command.release` 가 대체 |
| fulfillment `onStockReserved` (`inventory.stock.reserved`) | 이행 생성 | 삭제 — `fulfillment.command.create` 가 대체 |
| order `onReservationExpired` (`inventory.reservation.expired`) | 주문 취소 | 삭제 — 사가 코디네이터가 같은 토픽을 받아 SR-4 규칙대로 처리 |
| inventory `onFulfillmentShipped` | 예약 확정 | 삭제 — 확정은 결제 승인 뒤 `inventory.command.confirm`. 출고는 재고 이벤트를 내지 않는다 |
| inventory `onFulfillmentCancelled` | 예약 해제 | 삭제 — 새 흐름에서 예약은 이미 CONFIRMED 라 무동작이다. 되돌림은 클레임이 `inventory.command.restock` 으로 한다 |
| product `InventoryStockSyncConsumer` | reserved·released·received 구독 | confirmed·restocked 구독 추가 |
| 토픽 `order.order.completed` · `order.order.cancelled` | 발행 | 은퇴. 새 토픽은 SR-7 표 |
| `/api/orders/**` · `/api/products/**` | 주문·상품 API | `/api/v1/orders/**` · `/api/v1/products/**` 로 이동, 게이트웨이 라우트와 FE·배치 호출을 같은 단계에서 교체(레거시 브리지 없음) |

### SR-2 상태 머신

**주문** (`COMPLETED` 는 재정의 — 구매 확정)

| 이전 | 이후 | 계기 |
|---|---|---|
| — | CREATED | 주문 접수(사가 시작) |
| CREATED | PAYMENT_PENDING | 재고·혜택 예약 완료, 결제 승인 명령 |
| CREATED · PAYMENT_PENDING | FAILED | 피벗 전 실패 · 보상 완료 |
| PAID | FAILED | 보류 만료가 결제 승인보다 늦게 도착 — **매입 전만**. VOID + 확정된 재고 `restock`·혜택 `restore` 후 |
| CREATED | CONFIRMED | 결제액 0원 — 재고·혜택 확정 후 |
| CREATED | CANCELLED | 구매자 취소(피벗 전) — 보상 후 |
| PAYMENT_PENDING | PAID | 결제 AUTHORIZED |
| PAID | CONFIRMED | 재고·혜택 확정 + 매입 완료 |
| CONFIRMED | FULFILLING | 이행 생성 |
| FULFILLING | COMPLETED | 취소되지 않은 라인이 전부 구매 확정됨 |
| CONFIRMED · FULFILLING | CANCELLED | 전체 취소 클레임 환불 완료(모든 라인 CANCELLED) |

부분 취소는 주문 상태가 아니라 **라인 상태**(ACTIVE → CANCELLED · ACTIVE → PURCHASE_CONFIRMED)와 주문의 `refunded_amount` 로 표현한다 — 부분 취소된 주문도 같은 경로로 이행·구매 확정·정산된다. 화면의 「부분 환불」 표시는 `refunded_amount > 0` 에서 유도한다.

PAYMENT_PENDING 중 구매자 취소는 받지 않는다(409, 「결제 결과 확인 중」). 결제 결론 뒤 클레임으로.

**결제**: READY → AUTHORIZED | FAILED | UNKNOWN · UNKNOWN → AUTHORIZED | FAILED · AUTHORIZED → CAPTURED | VOIDED · CAPTURED → PARTIALLY_REFUNDED | REFUNDED · PARTIALLY_REFUNDED → PARTIALLY_REFUNDED | REFUNDED(환불 합 = 매입액). REFUNDED · VOIDED · FAILED 는 종착.

**클레임**: REQUESTED → APPROVED → REFUNDED · REQUESTED → REJECTED. 이행이 없거나 `fulfillment.command.cancel` 이 `fulfillment.order.cancelled` 로 답하면 자동 승인, `fulfillment.order.cancel-rejected`(이미 출고)면 판매자 승인 대기.

**판매자**: PENDING → ACTIVE | REJECTED · ACTIVE ↔ SUSPENDED. REJECTED 는 재신청 시 새 신청 행(이력 보존). 반려 신청의 개인정보는 반려 후 30일에 파기.

**정산서**: DRAFT → CONFIRMED → PAID · CONFIRMED → CARRIED_OVER(지급액 ≤ 0 이면 다음 기간 이월).

**사가**: RUNNING → COMPENSATING → FAILED · RUNNING → COMPLETED · RUNNING → STUCK(재시도 한도 초과, 운영 이슈) · STUCK → RUNNING(운영자 재시도) · COMPENSATING → STUCK(보상 재시도 한도 초과, 운영 이슈) · STUCK → COMPENSATING(보상 중 멈춘 사가의 운영자 재시도 — 보상을 이어 간다).

모든 전이는 도메인 메서드 가드로만 일어나고 주문은 `order_status_history`(이전·이후·사유·주체·시각)를 남긴다.

### SR-3 읽기 모델 (도메인 경계를 넘는 읽기)
- order 가 이벤트로 유지하는 읽기 모델: 상품(이름·가격·상태·판매자) · 판매자(상태·수수료율·배송비) · 쿠폰 정의 · 사용자 쿠폰 · 포인트 잔액.
- 주문서의 할인·잔액은 **견적**이다. 최종 판정은 사가의 promotion reserve 가 하고, 거기서 실패하면 주문은 FAILED(사유 BENEFIT_UNAVAILABLE)이고 FE 는 주문서 재생성을 안내한다.
- settlement 는 order 의 라인 이벤트(SR-7)로 판매자·수수료·안분을 받는다 — 다른 스키마를 읽지 않는다.
- PG 대사는 payment 가 하고 결과를 이벤트로 낸다.

### SR-4 사가 오케스트레이션
- `POST /api/v1/orders {orderSheetId}` + `Idempotency-Key` 필수. 사가를 시작하고 202 + `Location`. 키는 (사용자, 키) 유니크, PROCESSING 리스 60초(지나면 재시도 허용), 처리 중 409, 완료 후 저장 응답 그대로, 24시간 보관.
- 주문서 검증: 만료 · 이미 주문에 쓰임 · 소유자 불일치는 422. 주문서 1개 = 주문 1개.
- `order_saga` (`@Version`): 단계 · 상태 · 시도 수 · 다음 기한. 코디네이터는 이벤트를 받아 다음 명령을 아웃박스로 낸다. 단계 기한 초과는 스케줄러가 같은 명령을 재발행(멱등).
- 단계: 재고 예약 → 혜택 예약 → 결제 승인(피벗) → 재고 확정 → 혜택 확정 → 결제 매입 → CONFIRMED → 이행 생성 명령.
- 결제액 0원이면 결제 단계 셋을 건너뛴다.
- 피벗 전 실패는 역순 보상(혜택 원복 → 재고 해제 → FAILED). 피벗 뒤는 재시도만, 10회 초과 STUCK + 운영 이슈. **유일한 예외**는 아래 보류 만료 경로다 — 매입 전이고 예약이 이미 사라졌으므로 재시도로는 수렴하지 않아 VOID + restock/restore 로 되돌린다.
- **보류 기한 하나로 묶기**: 재고·혜택 예약의 보류 기한은 30분(`commerce.hold-minutes`)이고, 사가의 피벗 전 기한 10분 + UNKNOWN 재조회 최대 10분(30초·1·2·4·2.5분) 합보다 길다. 예약 만료가 사가보다 먼저 오면(`inventory.reservation.expired`·`promotion.hold.expired`) 코디네이터는 결제가 AUTHORIZED 면 VOID 명령 후 FAILED, 아직 모르면 VOID 를 예약해 두고 결론 시 실행한다. 결제된 주문의 재고가 다시 팔리는 경로는 없다. 만료된 예약에 확정 명령이 오면 inventory·promotion 은 예외가 아니라 `…failed(reason=EXPIRED)` 이벤트로 답한다(DLT 로 새지 않는다).
- 결제 UNKNOWN 동안 사가는 대기한다 — 주문을 먼저 취소하지 않는다.
- 사가가 주고받는 모든 명령·이벤트의 Kafka 키는 orderId. 아웃박스 행에 `partition_key` 를 두고 릴레이가 이것을 키로 쓴다.
- 결제 대기(CREATED · PAYMENT_PENDING) 주문은 사용자당 3건까지(초과 429), 주문서 생성은 게이트웨이 레이트 리밋.

### SR-5 결제 도메인 `payment`
- `PgPort` 구현 둘: 모의 PG(기본) · 토스(`payment.pg=toss` 일 때만 빈).
- **흐름 분리**: 모의 PG 는 서버가 승인을 요청한다. 토스는 FE 결제창 인증 → 토스가 준 `paymentKey` 로 서버가 승인 확인(confirm). 둘 다 가맹점 주문번호 `orderNo`(= 결제 시도 id, 멱등 키)를 쓰고 `paymentKey` 는 PG 가 준 거래 키로 따로 저장한다.
- 같은 `orderNo` 재요청은 PG 에 새 승인을 만들지 않는다(모의 PG 는 호출 기록 1건).
- 타임아웃·5xx 는 UNKNOWN. 재조회 스케줄러가 백오프로 결론, 5회 초과 운영 이슈.
- 웹훅 `POST /api/v1/payments/webhooks/toss` — `payment.pg=toss` 일 때만 매핑된다. 서명 검증 실패 401, 이미 도달한 상태 no-op, 상태·금액은 웹훅 본문이 아니라 **PG 재조회 결과**로 정한다. 모의 PG 는 웹훅을 HTTP 없이 같은 전이 함수로 흉내 낸다 — 운영(모의 PG)에는 웹훅 경로가 열리지 않는다.
- 매입 전 취소 VOID, 매입 후 전액·부분 환불, 환불 합 ≤ 매입액.
- 카드 정보는 PG 결제창에서만 받는다. 서버·DB·로그에 카드번호·CVC 가 없다 (PCI-DSS 범위 밖 선언).
- PG 대사(일 1회): PG 정산 파일(모의 PG 가 생성) ↔ payment 행 건별 대조, 불일치는 운영 이슈, 일치분은 `payment.reconciliation.settled` 이벤트(입금액·PG 수수료).

### SR-6 판매자 도메인 `seller`
- 신청: 로그인 회원 1인 1판매자(ACTIVE·PENDING·SUSPENDED 기준 — 정지 회피 재신청 불가). 필드: 상호 · 사업자등록번호 · 대표자 · 정산 계좌 · 배송비(고정) · 정산 주기(WEEKLY/MONTHLY). 수수료율은 어드민이 승인 시 정한다(bp).
- 계좌번호는 AES-GCM 암호화 컬럼 + 마스킹 표시값. 키 `SELLER_ACCOUNT_ENC_KEY`(전용 Secret, 키 버전 컬럼). 키가 없으면 commerce 가 기동하지 않는다. 설정 파일에 기본값을 두지 않는다(`${SELLER_ACCOUNT_ENC_KEY}` 만). 복호화는 지급 경로에서만. 키는 `AUTH_SUBJECT_HASH_KEY` 와 같은 백업 대상.
- 승인·정지·재활성은 `seller.seller.{approved,suspended,reactivated}` 이벤트 → auth 가 `ROLE_SELLER` 행을 추가·회수한다. auth 컨슈머는 **`ROLE_SELLER` 한 역할만** 다룬다(다른 역할 부여 불가). 브로커 무인증 위험은 ADR-0099 에 수용으로 기록.
- 판매자 권한 판정은 JWT 역할만으로 하지 않는다: 판매자 API 는 매 요청 `X-User-Id` → seller 행을 찾아 ACTIVE 인지 확인한다(정지 즉시 차단, 토큰 만료를 기다리지 않음).
- 정지된 판매자의 상품은 판매 중지(주문서 422), 진행 중 주문은 계속 이행·정산한다.
- 기존 상품은 플랫폼 기본 판매자(id 1, ACTIVE, 수수료 0)로 백필.
- 판매자 포털(portal-fe `/shop/seller/*`): 입점 신청 · 내 상품 · 내 주문(클레임 승인) · 내 정산서. 어드민(admin-fe): 신청 승인·반려 · 정지·재활성 · 수수료율.
- 판매자 상태·수수료율 변경과 역할 부여·회수는 행위자·사유·시각을 남긴다.

### SR-7 혜택 도메인 `promotion` · 주문서 · 장바구니
- 쿠폰 정의: 정액·정률(최대 할인) · 최소 주문 금액 · 기간 · 발행 상한 · 부담 주체 PLATFORM|SELLER(판매자 쿠폰은 그 판매자 상품에만). 사용자 쿠폰 1회 사용. 발행은 조건부 UPDATE 로 상한 보장.
- 포인트: 원장(적립·사용·원복, 추가만), 잔액 ≥ 0, 잔액 행 `@Version`.
- TCC: `promotion.command.{reserve,confirm,cancel}` — orderId 로 멱등, 보류 기한 30분.
- 장바구니: 로그인 사용자, 상품·수량, 판매자 혼합 가능.
- 주문서 `POST /api/v1/order-sheets`: 읽기 모델로 가격·판매 가능·쿠폰·포인트·판매자별 배송비를 계산해 스냅샷, 만료 15분.
- 금액은 원 단위 `Long`(KRW 고정). 정률 할인 = 내림(대상 금액 × 율). 수수료 = 반올림(HALF_UP)(라인 순매출 × bp / 10000).
- 안분: 쿠폰·포인트를 라인 결제 대상 금액 비율로 나누고 **원 단위 잔차는 금액이 가장 큰 라인**(동률이면 앞 라인)에 붙인다. 라인 합 = 할인 총액.
- 라인 스냅샷: 상품명 · 판매가 · 수량 · 쿠폰 안분 · 포인트 안분 · 쿠폰 부담 주체 · 수수료율 · 판매자 id · 라인 결제액. 판매자별 배송비 라인. 주문 합계 저장.

### SR-8 클레임 · 구매 확정
- 클레임: 전체 취소 · 라인 부분 취소. 환불액 = 라인 결제액. 포인트 안분분은 포인트로 원복, 나머지는 결제 부분 환불.
- 부분 취소 뒤 남은 금액이 쿠폰 최소 주문 금액에 못 미쳐도 **쿠폰 할인은 유지**한다(재계산 없음, 쿠폰은 돌려주지 않는다). 전체 취소면 쿠폰을 돌려준다(기간 내일 때).
- 배송비: 판매자의 모든 라인이 출고 전 취소되면 배송비 환불, 아니면 유지.
- 이행이 생긴 뒤의 취소는 `fulfillment.command.cancel`(라인 지정)을 먼저 보낸다. 이행 도메인이 출고 전이면 해당 라인을 취소하고 `fulfillment.order.cancelled`, 이미 출고면 `fulfillment.order.cancel-rejected` 로 답한다. 환불은 cancelled 뒤에만.
- 환불은 구매 확정 전 라인만 가능하다(확정 뒤 반품은 범위 밖).
- 구매 확정: 고객 버튼 또는 배송 완료 후 `order.purchase-confirm-days`(기본 7)일 자동. 확정된 라인만 정산 대상.

### SR-9 원장 · 정산 `settlement`
- 분개 규칙. 기호: N = Σ라인 순매출(판매가×수량 − 판매자 부담 쿠폰) · S = 배송비 · C = Σ수수료 · Dp = 플랫폼 부담 쿠폰 · P = 포인트 사용 · 결제액 X = N + S − Dp − P.

  | 시점 | 차변 | 대변 | 검산 |
  |---|---|---|---|
  | 매입 (`order.order.confirmed`) | PG 미수금 X · 판촉 비용 Dp+P | 판매자 미지급금 N+S−C · 수수료 수익 C | 차 = 대 = N+S |
  | 환불 (`order.claim.refunded`, 라인 n·s·c·dp·p) | 판매자 미지급금 n+s−c · 수수료 수익 c | PG 미수금 n+s−dp−p · 판촉 비용 dp+p | 차 = 대 = n+s |
  | PG 입금 (`payment.reconciliation.settled`) | 현금 입금액 · PG 수수료 비용 PG 수수료 | PG 미수금 입금액+PG 수수료 | — |
  | 지급 (정산 배치) | 판매자 미지급금 지급액 | 현금 지급액 | — |

  판매자 미지급금은 매입 때 N+S−C 로 쌓이고 환불 때 n+s−c 로 줄어, 확정 라인 기준 잔액이 정산서 지급액(Σ순매출 + Σ배송비 − Σ수수료)과 같다.
- 원장: 거래 + 분개, 거래 하나의 차변 합 = 대변 합을 도메인이 강제, 수정·삭제 없음, 정정은 역분개. 원천 이벤트 id 로 멱등.
- 계정(이 이름만 쓴다): PG 미수금 · 판매자 미지급금 · 수수료 수익 · PG 수수료 비용 · 현금 · 판촉 비용(플랫폼 부담 할인·포인트).
- 기록 시점과 원천 이벤트: 매입 = `order.order.confirmed`(라인·배송비 라인 포함) · 환불 = `order.claim.refunded`(라인 포함) · PG 입금 = `payment.reconciliation.settled` · 지급 = 자기 정산 배치.
- 정산 대상은 구매 확정 라인과 그 판매자의 배송비 라인뿐이다. 배송비 라인은 그 주문에서 **해당 판매자의 마지막 ACTIVE 라인이 구매 확정되는 순간** 같은 `order.line.purchase-confirmed` 이벤트에 실려 같은 기간 정산서에 들어간다(모든 라인이 취소돼 배송비가 환불되면 정산 대상 아님). 환불은 확정 전 라인에서만 일어나 정산서에 들어오지 않는다(이중 차감 방지).
- 라인 순매출 = 판매가 × 수량 − 판매자 부담 쿠폰 안분. 플랫폼 부담 할인·포인트는 판매자 매출을 줄이지 않는다(판촉 비용). 수수료 = 반올림(HALF_UP)(라인 순매출 × 수수료율 bp / 10000). 배송비는 수수료 없음.
- 정산 배치(일 1회): 판매자 주기가 닫힌 기간의 `order.line.purchase-confirmed` 를 모아 정산서(순매출 · 배송비 · 수수료 · 지급액)를 만든다. **지급액 = Σ라인 순매출 + Σ배송비 − Σ수수료**. 0 이하면 CARRIED_OVER. 모의 송금 후 원장에 지급 거래. 정산서 지급액 = 판매자 미지급금 잔액 감소분.

### SR-10 운영 보강
- 아웃박스(common, 이것을 쓰는 스키마 전부 — order · inventory · fulfillment · product · 신규 넷. quant 는 자체 릴레이라 대상 아님): 한 트랜잭션에서 최대 100행을 `FOR UPDATE SKIP LOCKED` 로 집어 `SENDING` + 리스 30초로 바꾸고 커밋 → 트랜잭션 밖에서 동기 전송(타임아웃 10초) → 새 트랜잭션에서 PUBLISHED 또는 시도 수·다음 시도 시각 갱신, 10회 초과 FAILED. 리스 만료 SENDING 은 다시 집는다. PUBLISHED 7일 뒤 삭제. 적체 게이지. 스키마 변경은 확장만(nullable 컬럼 추가)이라 옛 코드와 공존한다.
- 스케줄러 스레드 풀 4 (commerce) — 정산 배치가 아웃박스 발행을 막지 않는다.
- 운영 이슈: 각 도메인 스키마의 `ops_issue` 테이블(종류·대상 id·내용·상태·처리자·사유). 어드민 API `/api/v1/admin/{domain}/ops-issues` 조회·재시도·종결. DLT 컨슈머(도메인별)가 DLT 메시지를 운영 이슈로 적재하고 재발행 API 를 준다.
- 운영 큐 화면(admin-fe): DLT 를 적재하는 모든 commerce 도메인(order · inventory · fulfillment · product · payment · seller · promotion · settlement)의 운영 이슈를 한 목록으로 모은다(FE 가 도메인 API 를 합친다).
- 어드민 조치(재발행·종결·판매자 상태·수수료율)는 행위자·사유를 남긴다.
- traceId: Micrometer Tracing, HTTP 와 Kafka `traceparent` 헤더, 아웃박스 행에 헤더 저장 후 발행 시 복원.
- 지표: 사가 체류 시간 · 보상 수 · UNKNOWN 수 · 아웃박스 적체 · 대사 불일치 수 · 정산 지급 합계.

### SR-11 노출 · 게이트웨이

| 경로 | 인증 | 소유 검사 |
|---|---|---|
| `/api/v1/order-sheets/**` · `/api/v1/orders/**` · `/api/v1/claims/**` · `/api/v1/cart/**` | ROLE_USER | 서비스가 `X-User-Id` 와 소유자 대조, 헤더 없으면 401(남의 것 반환 금지) |
| `/api/v1/coupons/me` · `/api/v1/points/me` | ROLE_USER | 본인 것만 |
| `/api/v1/sellers/apply` | ROLE_USER | 1인 1판매자 |
| `/api/v1/seller/**` (판매자 포털 API) | ROLE_SELLER | ACTIVE 판매자 행 + 자기 판매자 id |
| `/api/v1/products` 쓰기 | ROLE_SELLER · ROLE_ADMIN | 판매자는 자기 상품만 |
| `/api/v1/payments/webhooks/toss` | 공개(서명) | `payment.pg=toss` 일 때만, 신원 헤더 제거, 레이트 리밋 |
| `/api/v1/admin/**` | ROLE_ADMIN | — |

도메인마다 `GroupedOpenApi` 와 gateway `openApiServices` 등록.

### SR-12 토픽

| 토픽 | 발행 | 수신 |
|---|---|---|
| `inventory.command.{reserve,confirm,release,restock}` | order(사가) | inventory |
| `inventory.reservation.{reserved,failed,confirmed,released,expired,restocked}` | inventory | order(사가·클레임) |
| `inventory.stock.{reserved,released,confirmed,received,restocked}` | inventory | product |
| `promotion.command.{reserve,confirm,cancel,restore}` | order(사가·클레임) | promotion |
| `promotion.hold.{reserved,failed,confirmed,cancelled,expired,restored}` | promotion | order |
| `promotion.coupon.{defined,issued}` · `promotion.point.changed` | promotion | order(읽기 모델) |
| `payment.command.{authorize,capture,void,refund}` | order | payment |
| `payment.payment.{authorized,failed,unknown,captured,voided,refunded}` | payment | order |
| `payment.reconciliation.settled` | payment | settlement |
| `fulfillment.command.{create,cancel}` | order | fulfillment |
| `fulfillment.order.{created,shipped,delivered,cancelled,cancel-rejected}` | fulfillment | order |
| `order.order.confirmed` · `order.claim.refunded` · `order.line.purchase-confirmed` | order | settlement |
| `seller.seller.{applied,approved,suspended,reactivated,updated}` | seller | order(읽기 모델) · auth · product |
| `product.item.{created,updated}` | product(아웃박스) | order(읽기 모델) · search |

전부 키 = orderId(사가) 또는 엔티티 id(읽기 모델). `kafka-convention.md`·`kafka-topics.md` 표 갱신.

### SR-13 마이그레이션 · 롤백
- 모든 Flyway 는 확장 먼저(컬럼·테이블 추가, nullable) → 코드 전환 → 다음 단계에서 축소. 적용된 마이그레이션은 고치지 않는다.
- 주문 상태: 기존 `COMPLETED` → `CONFIRMED`, 남은 `PENDING` → `FAILED`(사유 LEGACY_ABANDONED). 컬럼은 STRING 이라 값 갱신만.
- 금액: `order_items.unit_price DECIMAL(19,2)` → 새 `unit_price_won BIGINT` 컬럼 추가·백필(소수부 0 확인 후), 다음 단계에서 옛 컬럼 삭제. product `price` 도 같은 방식.
- 유니크 추가 전 중복 행 조회 → 있으면 정리 스크립트 후 제약.
- 옛 흐름의 ACTIVE 예약은 전부 결제 완료 주문에서 생겼으므로 조건 없이 전부 전환한다: 예약 CONFIRMED + `reserved_qty` 차감(확정과 같은 수량 처리) + `inventory.stock.confirmed` 아웃박스 행. 기동 시 1회 도는 멱등 전환 작업으로 하고 Flyway SQL 로 하지 않는다(이벤트가 필요).
- 롤백: 이미지 태그 롤백은 확장 단계 안에서만 안전하다. 아웃박스 보강 뒤 롤백하면 `UPDATE outbox_event SET status='PENDING' WHERE status='SENDING'` 을 먼저 실행한다(옛 릴레이는 SENDING 을 모른다). 축소 마이그레이션이 든 단계는 되돌릴 때 앞으로 고친다(forward fix).
- 운영 MySQL 은 init 이 재실행되지 않는다 — 단계 배포 전 `oci-mysql` 로 스키마·계정 생성, `configmap-init.yaml`·`init-databases-job.yaml` 동기화.

### SR-14 배포 · 문서 · 개인정보
- 새 도메인 넷은 `commerce:app` 폴드. Hikari 풀 도메인당 최대 3. 단계 배포마다 commerce 컨테이너 메모리 실측 기록.
- Secret: `SELLER_ACCOUNT_ENC_KEY`(필수) · `TOSS_SECRET_KEY`·`TOSS_WEBHOOK_SECRET`(`payment.pg=toss` 일 때만 필수). 필수 키 누락은 기동 실패 — 조용한 무동작 금지. **세 키 모두 설정 파일에 기본값을 두지 않는다**(`${KEY}` 만).
- auth(private 서브모듈)에 Kafka 컨슈머 의존 추가 — 서브모듈 먼저 푸시.
- 개인정보처리방침(`PrivacyPage.tsx`) §2 수집 항목에 판매자 정보(상호·사업자번호·대표자·계좌), 보존기간 표에 정산 기록(전자상거래법 5년) 추가 — 상수와 문구를 같이.
- CI PR 게이트 목록(`.github/workflows/ci.yml`)에 새 도메인 테스트 추가.
- ADR-0099, 도메인별 `CLAUDE.md`·`glossary.md`, `docs/context-map.md`, 루트 서비스 표, 토픽 표, `doc-index`.
- 단계마다 커밋 · 푸시 · 배포 후 운영에서 주문 1건을 흘려 사가 상태를 확인한다.

## 단계

| 단계 | 내용 | 배포 확인 |
|---|---|---|
| P0 | SR-0 보안·결함 (가격 필드 제거는 P3 와 함께), 아웃박스 보강(SR-10 앞부분), 스케줄러 풀 | 아웃박스 적체 0, 상품 쓰기 403 |
| P1 | seller 도메인 + auth 컨슈머 + product.seller_id | 입점 신청→승인→역할 |
| P2 | payment 도메인 (모의 PG · 토스 어댑터 · UNKNOWN · 대사) | 모의 결제 1건 |
| P3 | promotion + 장바구니 + 주문서 + 읽기 모델 + 금액 Long | 주문서 생성 |
| P4 | 사가 코디네이터 + 기존 구독 은퇴 + 주문 상태 전환 + Idempotency-Key + 유니크 | 운영 주문 1건 CONFIRMED |
| P5 | 클레임 · 구매 확정 | 부분 취소 1건 |
| P6 | settlement 원장·정산·대사 | 정산서 1건 |
| P7 | 운영 큐 화면 · DLT 재처리 · 추적 · E2E 보강 · 문서 마감 | 운영 큐 0건 |

## Existing Code to Leverage

- `common/src/main/kotlin/com/kgd/common/messaging/outbox/OutboxPollingPublisher.kt` · `KgdMessagingOutboxAutoConfiguration.kt`
- `common/.../messaging/idempotency/IdempotentEventHandler.kt`
- `inventory/feature` — 레이어·DataSourceConfig·Flyway·MessagingConfig 견본 (ADR-0083)
- `inventory/domain/.../Inventory.kt`, `Reservation.kt` — 예약 모델
- `fulfillment/domain/.../FulfillmentStatus.kt`
- `order/feature/.../OrderTransactionalService.kt` — 트랜잭션 분리 패턴
- `order/feature/.../PaymentAdapter.kt`, `WebClientConfig.kt` — 서킷 브레이커 설정(토스 어댑터로 옮김, 빈 이름 도메인 접두)
- `auth` RBAC `member_roles`, `Role.ROLE_SELLER`
- `portal-fe/src/pages/Shop*.tsx`, `portal-fe/src/api/shopApi.ts`, `portal-fe/src/pages/PrivacyPage.tsx`
- `admin/frontend`
- `commerce/app/src/test/.../CommerceContextLoadSpec.kt`

## Out of Scope

- 실제 송금 · 세금계산서 · 해외 통화
- 토스 운영 활성화 (Q1) — 어댑터·MockWebServer 테스트까지
- 반품 입고 · 교환 · 조건부 배송비
- 이미지 업로드 · CDN
- ci.yml 을 생성물로 바꾸는 일(목록에 행 추가만 한다)

## Open Questions

- Q1 (post-impl) 토스 운영 활성화 — `context/open-questions.yml`
- 열린 pre-impl 질문 0건
