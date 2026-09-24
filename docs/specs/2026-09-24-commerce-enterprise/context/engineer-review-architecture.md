# Engineer Review — Architecture

- 대상: `spec.md`, `planning/requirements.md`, `planning/test-quality.md`, `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md`
- 기준: ADR-0058 불변식, ADR-0083 레이어 표준, `docs/standards/new-domain-checklist.md`, `docs/conventions/transactional-usage.md`, `docs/architecture/kafka-convention.md`, KB [[modular-monolith-fold]] (vault, updated 2026-09-11)
- 판정: **REVISE** — 이슈 9건 (높음 4 · 중간 3 · 낮음 2). 방향(order 안 코디네이터, 4도메인 commerce 폴드, PgPort 두 어댑터, 추가만 하는 원장)은 표준과 맞는다. 다만 도메인 사이 **데이터가 어디서 오는지**와 **기존 코레오그래피를 어떻게 끄는지**가 비어 있다.

## 통과한 항목

| 체크 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 · 상향 의존 없음 | 통과 | 새 도메인은 `:domain`+`:feature`, 견본 inventory (spec.md:92, ADR-0099:41-50). `verifyLayerDependencies` 가 강제 (new-domain-checklist.md:48-49) |
| 외부 연동은 포트 뒤 | 통과 | `PgPort` 모의·토스 (spec.md:31) |
| Seam realism | 통과 | `PgPort` 어댑터 2개 = 실제 seam (spec.md:31). order 의 `PaymentPort`·`ProductPort` 는 제거 대상 (spec.md:20) |
| 순환 의존 | 통과 | 도메인 간은 Kafka 뿐 (ADR-0099:39), feature 간 컴파일 의존 없음 (ADR-0058:92-97) |
| 사가 상태 트랜잭션 소유 | 통과 | `order_saga`·상태 이력·아웃박스가 order TM 한 트랜잭션 (ADR-0099:37, ADR-0058:99-100) |
| 파드 배분 | 통과 | 새 `:app` 없음, commerce 성격 (ADR-0099:50, new-domain-checklist.md:17) |
| Deletion Test (payment·seller·promotion·settlement) | 통과 | 넷 다 지우면 복잡도가 여러 호출자로 흩어진다 — seller 만 해도 auth(역할)·product(소유 검사)·order(수수료 스냅샷)·settlement(주기·계좌)가 소비한다. 얕은 통과 모듈 없음 |

## 이슈

### A1 [높음] 기존 코레오그래피 리스너를 끄는 목록이 없다 — 체크: 교차 모듈 경계 · 패턴 일관성

스펙은 fulfillment 에 「명령 수신만 추가」라고 적었다 (spec.md:94). 기존 리스너가 남으면 새 사가와 옛 흐름이 함께 돈다.

| 기존 리스너 | 새 사가에서 생기는 일 |
|---|---|
| `fulfillment/.../FulfillmentEventConsumer.kt:28` `inventory.stock.reserved` → 출고 생성 | 재고 예약이 1단계가 되므로(spec.md:57) **결제 전에 출고가 생긴다** |
| `inventory/.../InventoryEventConsumer.kt:58` `order.order.completed` → 예약 | 코디네이터 명령과 이중 트리거 |
| `inventory/.../InventoryEventConsumer.kt:100` `fulfillment.order.shipped` → 확정 | 사가 4단계 「재고 확정」(spec.md:57)과 확정이 두 번 |
| `inventory/.../InventoryEventConsumer.kt:160` `order.order.cancelled` → 해제 | 보상 명령과 이중 경로 |
| `order/.../OrderEventConsumer.kt:34,57-63` `inventory.reservation.expired` → **주문 취소** | 「UNKNOWN 이면 주문을 먼저 취소하지 않는다」(spec.md:59)와 정면 충돌 |

또한 명령 토픽 이름은 payment 만 있다 (spec.md:36). inventory·promotion·fulfillment 명령과 promotion 결과 이벤트가 없고, `kafka-convention.md:5` 형식 `{domain}.{entity}.{event}` 에는 명령 형태가 정의돼 있지 않다.

**수정안**
- SR-4 에 「제거·전환되는 리스너」 표를 넣는다 (위 다섯 줄 → 각각 제거 또는 코디네이터 명령 수신으로 교체).
- 명령 토픽을 전부 적는다: `inventory.command.{reserve,confirm,release}` · `promotion.command.{reserve,confirm,cancel}` · `fulfillment.command.create` 와 각 결과 이벤트. `kafka-convention.md` 에 명령 형식 `{target}.command.{verb}` 을 한 줄 정의한다.
- 전환 중인 주문(옛 흐름으로 시작해 배포 뒤 끝나는 것)의 처리를 한 줄 적는다 — 단계 배포(spec.md:84)라 창이 실제로 생긴다.
- ADR-0099:4 「대체」에 ADR-0011 의 inventory→fulfillment 코레오그래피도 더한다.

### A2 [높음] 주문서가 동기 요청 안에서 promotion·seller 데이터를 어떻게 얻는지 없다 — 체크: 교차 모듈 경계

- 주문서 API 는 쿠폰·포인트 적용 결과·판매자별 배송비를 계산해 스냅샷을 **바로** 돌려준다 (spec.md:48). 라인 스냅샷에는 수수료율·판매자 id 가 들어간다 (spec.md:49, :43).
- 그런데 order 가 다른 feature 빈을 부를 수 없고 (ADR-0058:92-93, ADR-0099:39), HTTP 자기 호출은 이 스펙이 결함으로 지정해 없앴다 (spec.md:20). 스펙이 마련한 읽기 모델은 **상품 스냅샷 하나**뿐이다 (spec.md:20).
- 장바구니의 소유 도메인도 적혀 있지 않다 (spec.md:47; shaping-state.yml:5 의 topology 에만 order 로 암시).

**수정안** — 스펙이 이미 고른 패턴을 그대로 넓힌다.
- order 가 소유하는 읽기 모델을 셋으로 명시: 상품(기존) + **판매자**(수수료율·정산 주기·배송비·상태, `seller.seller.*` 이벤트로 갱신) + **혜택 정의**(쿠폰 정의·사용자 쿠폰 발행분, `promotion.*` 이벤트로 갱신).
- 주문서의 할인 계산은 **견적**이고, 권위 있는 판정은 사가 2단계 TCC reserve 다 (spec.md:52, :57) — reserve 가 거절되면 피벗 전 보상 경로로 FAILED. 포인트 잔액은 읽기 모델로 복제하지 않고 reserve 에서만 판정한다고 적는다.
- 장바구니 소유자를 order 로 명시한다.

### A3 [높음] PG 대사와 운영 큐가 어느 스키마에 사는지 없다 — 체크: 교차 모듈 경계 · 트랜잭션 소유

- PG 대사가 SR-5 settlement 절에서 「모의 PG 정산 파일과 **payment 행**을 건별 대조」로 적혀 있다 (spec.md:71). ADR 표는 payment 를 「대사 원천」, settlement 를 「PG 대사」로 나눴다 (ADR-0099:45, :48). settlement 가 payment 행을 읽으면 스키마 분리 불변식 위반이다 (ADR-0058:99).
- 운영 큐 한 테이블에 UNKNOWN 결제(payment_db)·대사 불일치·DLT(전 도메인)·체류 사가(order_db)를 모은다 (spec.md:75-76). 테이블 소유 도메인이 없다.
- KB 기준: 「원장·배치는 그것을 아는 도메인 모듈에 둔다 — 합성 루트에 두면 재분리 때 뒤에 남는다」 [[modular-monolith-fold]] (vault, updated 2026-09-11) :137.

**수정안**
- 대사는 **payment 가 한다** (PgPort·payment 행을 둘 다 가진 유일한 도메인). 결과를 `payment.settlement.{matched,mismatched}` 이벤트로 내고, settlement 는 matched 를 받아 「PG 입금」 분개를 적는다 (spec.md:69).
- 운영 큐는 **도메인별 테이블**(각자 자기 스키마 · 자기 `/api/v1/admin/...`)로 두고 admin-fe 가 모아 보여 준다. DLT 는 원 토픽의 도메인이 자기 DLT 를 소비해 자기 운영 큐에 적재한다. 한 곳으로 모으려면 그 소유 도메인과 이유를 ADR-0099 에 적는다.

### A4 [높음] settlement 로 들어가는 이벤트 계약이 없다 — 체크: 교차 모듈 경계

- 정산 배치는 「판매자 주기가 닫힌 기간의 **확정 라인**·환불」을 모은다 (spec.md:70). 확정 라인과 라인별 수수료율·판매자 id·안분액은 order_db 에만 있다 (spec.md:49, :67).
- 원장 기록 시점은 「결제 매입·환불·PG 입금·지급」(spec.md:69)인데, `payment.payment.captured` 는 결제 단위(키 orderId, spec.md:36)라 판매자 미지급금을 판매자별로 쪼갤 정보가 없다. 판매자 부담 쿠폰 상계(spec.md:66)도 마찬가지다.

**수정안** — order 가 내는 정산 입력 이벤트를 명시한다: 예) `order.line.purchase-confirmed`(라인 스냅샷 전체: 판매자 id·판매가·안분·부담 주체·수수료율) · `order.claim.refunded`(라인별 환불액·부담 주체). settlement 는 이것을 자기 스키마에 적재해 배치의 입력으로 쓰고, 매입 분개도 라인 스냅샷을 담은 이벤트 기준으로 판매자별로 나눈다고 적는다.

### A5 [중간] 타임아웃 소유자가 넷이다 — 체크: 트랜잭션 경계 소유

독립 타이머: 재고 예약 TTL 15분 (spec.md:24) · 주문서 만료 15분과 혜택 예약 해제 (spec.md:48, :52) · 사가 「다음 타임아웃」 (spec.md:56) · UNKNOWN 재조회 지수 백오프 5회 (spec.md:33). UNKNOWN 대기가 15분을 넘으면 재고·혜택이 먼저 풀리고, 그 뒤 결제가 AUTHORIZED 로 결론 나면 피벗을 넘은 주문에 재고가 없다. 현재 코드는 만료 시 주문을 취소한다 (OrderEventConsumer.kt:57-63).

**수정안** — 사가 코디네이터를 **유일한 타임아웃 소유자**로 적는다. 참여자 TTL 은 「사가 최대 대기 + 여유」보다 긴 안전망으로 두고, 만료 이벤트는 사가로 돌아와 판단하게 한다(주문 직접 취소 금지). 늦게 도착한 AUTHORIZED 가 이미 해제된 예약을 만나면 VOID 로 끝낸다는 규칙을 SR-4 에 넣는다.

### A6 [중간] product 가 판매자 소유·상태를 어떻게 아는지 없다 — 체크: 교차 모듈 경계

- 「판매자 API 는 자기 상품만 등록·수정(403)」(spec.md:42), 「정지 시 역할 회수」(spec.md:41).
- 현재 product 쓰기 권한은 게이트웨이가 JWT 에서 넣은 `X-User-Roles` 로 판정한다 (gateway/.../GatewayRouteConfig.kt:130). 역할만으로는 memberId → sellerId 를 모르고, 정지는 토큰 만료 전까지 먹지 않는다 — 이 레포가 블로그에서 같은 이유로 권한 진실을 행으로 옮겼다 (CLAUDE.md:92-93).

**수정안** — product 가 `seller.seller.{approved,suspended,…}` 로 판매자 읽기 모델(memberId·sellerId·상태)을 유지하고, 쓰기 시 그 행으로 소유·ACTIVE 를 판정한다고 적는다. `ROLE_SELLER` 는 게이트웨이 라우팅 수준 검사로만 쓴다.

### A7 [중간] common 아웃박스 보강의 트랜잭션 경계와 스키마 영향이 빠졌다 — 체크: 트랜잭션 경계 · 교차 모듈 변경

- 「common 한 곳에서 고쳐 모든 도메인에 적용」(spec.md:74). 그러나 `OutboxEntity` 는 각 도메인 `outbox_event` 테이블에 매핑되고 (common/.../OutboxEntity.kt:23-56) 시도 수·다음 시도 시각·trace 헤더(spec.md:77) 컬럼이 없다. validate 모드에서는 order(`orderdb/migration/V20260502_001__create_outbox_event.sql`)·inventory(`inventorydb/migration/V1__baseline.sql`)·fulfillment(`fulfillmentdb/migration/V20260810_001__create_outbox_event.sql`)·product(신규) 전부에 마이그레이션이 필요하다.
- 현재 릴레이는 트랜잭션 없이 읽고 Kafka 콜백에서 저장한다 (OutboxPollingPublisher.kt:33-60). `FOR UPDATE SKIP LOCKED` 를 그대로 얹으면 행 잠금이 Kafka 전송 동안 유지된다 — 「외부 IO 는 트랜잭션 밖」 규칙 위반 (transactional-usage.md:18-29).

**수정안** — ① 짧은 트랜잭션에서 `SKIP LOCKED` 로 배치를 **점유 표시**(IN_FLIGHT·lease 시각)만 하고 커밋 ② 트랜잭션 밖에서 전송 ③ 결과를 짧은 트랜잭션으로 반영하는 3단 구조를 명시한다. 아웃박스를 가진 도메인 목록과 각 도메인의 새 마이그레이션 번호를 SR-6 에 적는다.

### A8 [낮음] 새 시크릿이 폴드 장애 반경을 넓힌다 — 체크: 교차 모듈 경계

판매자 계좌 암호화 키(spec.md:40)와 토스 키(spec.md:31)가 commerce 파드에 새로 들어온다. 한 도메인 이름의 시크릿이 빠지면 폴드 파드 전체가 `CreateContainerConfigError` 로 조용히 멈춘다 — [[modular-monolith-fold]] (vault, updated 2026-09-11) :113-117. ADR-0099:70 은 테스트 실패 쪽만 적었다.

**수정안** — SR-7 에 시크릿 목록·SealedSecret 선반영 순서를 적고, 토스 키는 `payment.pg=toss` 일 때만 필요하므로 `optional: true` 로 둔다. 암호화 키는 fail-fast 를 유지하되 배포 전 생성 확인을 단계 체크리스트에 넣는다.

### A9 [낮음] 노출·문서 목록 누락 — 체크: 모듈 명명 · 패턴 일관성

- 경로: 기존 주문 API 는 `/api/orders` 이고 (OrderController.kt:16, GatewayRouteConfig.kt:141, portal-fe/src/api/shopApi.ts:213) 스펙은 `/api/v1/orders`·`/api/v1/order-sheets` 를 쓴다 (spec.md:48, :55). 경로 이전 여부와 게이트웨이 라우트(주문서·장바구니·판매자·혜택·정산, **무인증 웹훅** spec.md:34)를 SR-7 에 적는다 (new-domain-checklist.md:97). `GroupedOpenApi` 4개도 (new-domain-checklist.md:99-101, GatewayRouteConfig.kt:59-63).
- 문서: SR-7 목록(spec.md:86)에 `{svc}/glossary.md`·`docs/context-map.md`·`module-structure.md` 가 없다 (new-domain-checklist.md:115-117). 새 용어(주문서·코디네이터·운영 큐·안분)는 order `glossary.md` 에 둔다.
- 참고(비차단): requirements.md:24 는 외부 호출이 `ExternalApiProvider` 를 탄다고 했으나 토스 호스트는 `externalApiHosts` 에 없어 게이트가 보지 않는다 (build.gradle.kts:161-165). 운영 활성화(Q1) 때 결정한다고 open-questions.yml:5 에 이미 있으니 스펙에 「Q1 에서 결정」 한 줄이면 된다.

## 요약

| # | 심각도 | 한 줄 |
|---|---|---|
| A1 | 높음 | 기존 리스너 5개(결제 전 출고 생성·만료 시 주문 취소 등) 제거·전환 목록과 전체 명령 토픽 이름이 없다 |
| A2 | 높음 | 주문서가 promotion·seller 데이터를 동기로 얻을 경로가 없다 — 읽기 모델 3종 + reserve 가 권위 |
| A3 | 높음 | PG 대사가 settlement 에서 payment 행을 읽는 모양, 운영 큐 소유 스키마 미정 |
| A4 | 높음 | order → settlement 라인 단위 입력 이벤트 계약 부재 |
| A5 | 중간 | 타임아웃 소유자 넷 — 사가를 유일 소유자로, 참여자 TTL 은 안전망 |
| A6 | 중간 | product 의 판매자 소유·정지 판정 근거가 JWT 역할뿐 |
| A7 | 중간 | 아웃박스 SKIP LOCKED 가 Kafka IO 동안 잠금 유지 + 도메인별 마이그레이션 누락 |
| A8 | 낮음 | 새 시크릿이 commerce 전체 장애 반경에 묶임 |
| A9 | 낮음 | `/api/orders` → `/api/v1` 경로 이전·게이트웨이 라우트·glossary 등 문서 누락 |

VERDICT: REVISE

## Round 2

- 대상: 개정된 `spec.md`(252줄), `planning/requirements.md:100-108`, `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md`
- 판정: **REVISE** — 1차 9건은 전부 해결. 개정으로 드러난 새 이슈 4건(중간 1 · 낮음 3). requirements.md:100-108 에 기록된 사용자 결정(COMPLETED 재정의, order 읽기 모델, 보안 2건)은 다시 따지지 않는다.

### 1차 이슈 확인

| # | 상태 | 근거 (개정 스펙) |
|---|---|---|
| A1 | 해결 | 은퇴 표 spec.md:47-58 (다섯 리스너 + 옛 토픽 + 경로), 명령 토픽 전체 spec.md:174-193, 컨벤션 표 갱신 spec.md:193, 전환 중 주문 spec.md:197·:200, ADR-0099:69 에 ADR-0011 구독 은퇴 명시 |
| A2 | 해결 | order 읽기 모델 5종 spec.md:92, 견적 vs reserve 권위 + BENEFIT_UNAVAILABLE spec.md:93, 장바구니·주문서 spec.md:133-134. 포인트 잔액을 읽기 모델에 둔 것은 견적 용도로 명시돼 있어 문제없다 |
| A3 | 해결 | 대사는 payment spec.md:95·:117, 결과 이벤트 `payment.reconciliation.settled` spec.md:186, 운영 이슈는 도메인별 `ops_issue` + FE 합산 spec.md:154-155 |
| A4 | 해결 | `order.order.confirmed`·`order.claim.refunded`·`order.line.purchase-confirmed` spec.md:148-149·:189, settlement 는 다른 스키마를 읽지 않음 spec.md:94 |
| A5 | 해결 | 보류 기한 30분 > 사가 피벗 전 10분 + UNKNOWN 10분, 만료 시 코디네이터가 VOID·FAILED 판정 spec.md:104-105, order 직접 취소 리스너 삭제 spec.md:54 |
| A6 | 해결 | product 가 seller 이벤트 수신 spec.md:190, 매 요청 행 판정 spec.md:123, 소유 검사 spec.md:168 |
| A7 | 해결 | 3단(점유 커밋 → 트랜잭션 밖 전송 → 결과 반영) + 리스 + 확장만 spec.md:152. 도메인별 마이그레이션 번호는 태스크 단계로 넘겨도 된다 |
| A8 | 해결 | 시크릿 목록·조건부 필수 spec.md:206 |
| A9 | 해결 | 경로 이전 spec.md:58, 라우트 표 spec.md:160-172, `GroupedOpenApi` spec.md:172, glossary·context-map spec.md:22·:210. 토스 egress 는 Q1 spec.md:243 |

### 새 이슈

#### B1 [중간] 클레임이 이행을 멈출 명령이 없다 — 체크: 교차 모듈 경계 · 패턴 일관성

- 전체 취소는 FULFILLING 에서도 CANCELLED 로 간다 (spec.md:74). 부분 취소는 라인 단위이고, 출고 전이면 자동 승인이다 (spec.md:81, :140). 판매자 라인이 모두 출고 전 취소되면 배송비도 환불한다 (spec.md:142).
- 그런데 order → fulfillment 명령은 `fulfillment.command.create` 하나뿐이다 (spec.md:187). 환불은 끝났는데 출고는 계속 진행된다. 「출고 전」 판정도 order 가 가진 `fulfillment.order.shipped` 기준 사본이라 경합이 생긴다 — 출고 직전에 자동 승인된 클레임을 막을 쪽은 fulfillment 뿐이다.
- 함께 볼 것: spec.md:56 은 inventory `onFulfillmentCancelled` 를 유지한다. 새 순서에서 이행은 재고 확정(spec.md:101) 뒤에만 생긴다. 그래서 이 리스너가 부르는 해제(ACTIVE → CANCELLED 만 수행, InventoryEventConsumer.kt:126-141, :155-157)는 항상 무동작이다. 재고 복원은 이미 `inventory.command.restock` 이 맡는다 (spec.md:178). 남겨 두면 나중에 CONFIRMED 까지 처리하도록 바뀔 때 restock 과 이중 복원이 된다.

**수정안**
- SR-12 에 `fulfillment.command.cancel {orderId, lines}` (order → fulfillment) 를 넣는다. 결과는 `fulfillment.order.cancelled` 또는 `fulfillment.order.cancel-rejected`(이미 출고) 로 받는다.
- 클레임 자동 승인(spec.md:81)은 order 사본이 아니라 cancel 결과로 정한다. 거절이 오면 「출고 후 판매자 승인」 경로로 넘긴다.
- spec.md:56 의 `onFulfillmentCancelled` 는 「삭제 — 복원은 클레임의 `inventory.command.restock` 한 경로」로 바꾼다.

#### B2 [낮음] product 재고 동기화 구독이 토픽 표와 맞지 않는다 — 체크: 교차 모듈 경계

spec.md:180 은 `inventory.stock.{reserved,released,confirmed,received,restocked}` 를 product 가 받는다고 적었다. 현재 구독은 셋뿐이다 (`product/.../InventoryStockSyncConsumer.kt:43-47`: reserved·released·received). `restocked` 는 가용 재고를 바꾸므로, 구독을 넣지 않으면 spec.md:44 「product 재고가 어긋나지 않는다」가 깨진다.
**수정안**: spec.md:44 또는 P4 행(spec.md:221)에 「product 동기화 구독에 confirmed·restocked 추가」 한 줄을 넣는다.

#### B3 [낮음] 아웃박스 적용 목록의 quant 는 common 아웃박스를 쓰지 않는다 — 체크: 교차 모듈 변경 범위

spec.md:152 는 common 보강을 quant 에도 적용한다고 적었다. 하지만 quant 의 아웃박스는 자체 엔티티다 (`quant/feature/.../persistence/entity/OutboxEntity.kt:25`, common import 없음). 게다가 quant 는 sideapp 파드 소속이다(CLAUDE.md 서비스 표, ADR-0093). common 을 고쳐도 quant 에는 닿지 않는다. 적용을 강행하면 이 스펙이 다른 파드의 자체 구현을 교체하게 된다.
**수정안**: 목록에서 quant 를 빼고, 필요하면 별도 과제로 남긴다.

#### B4 [낮음] ADR 표가 대사를 settlement 에 둔다 — 체크: 패턴 일관성

ADR-0099:48 의 settlement 책임에 「PG 대사」가 남아 있다. 이는 spec.md:95·:117 및 ADR-0099:68(대사 결과는 payment 이벤트로 받는다)과 어긋난다. 구현자가 ADR 표를 보고 settlement 에 대사 배치를 만들 수 있다.
**수정안**: ADR-0099:48 을 「PG 입금 분개(대사 결과 수신)」로, :45 payment 에 「PG 대사」를 명시한다.

### Round 2 요약

| # | 심각도 | 한 줄 |
|---|---|---|
| B1 | 중간 | 클레임(전체·부분 취소)이 이행을 멈출 `fulfillment.command.cancel` 이 없고, `onFulfillmentCancelled` 유지가 무동작·이중 복원 위험 |
| B2 | 낮음 | product 재고 동기화가 confirmed·restocked 를 구독하지 않는다 |
| B3 | 낮음 | 아웃박스 보강 대상에 자체 구현인 quant(sideapp)가 들어가 있다 |
| B4 | 낮음 | ADR-0099:48 이 PG 대사를 settlement 책임으로 남겨 스펙과 충돌 |

VERDICT: REVISE
