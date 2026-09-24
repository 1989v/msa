# Task Breakdown: commerce 엔터프라이즈화

## Overview
Total Task Groups: 16 · 단계 P0~P7 (단계 끝마다 커밋·푸시·배포·운영 확인 — spec §단계)

표준: 레이어 `docs/conventions/package-structure.md`(견본 `inventory/feature`) · 신규 도메인 `docs/standards/new-domain-checklist.md` ·
테스트 `docs/standards/test-rules.md` · JPA `docs/conventions/jpa-persistence.md` · 트랜잭션 `docs/conventions/transactional-usage.md` ·
멱등 `docs/conventions/idempotent-consumer.md` · Kafka `docs/architecture/kafka-convention.md` · FE `DESIGN.md`·`docs/standards/fe-visual-verification.md` · 로깅 `docs/conventions/logging.md`.

검증 명령은 **바꾼 테스트만** 지정한다(`--tests`). 전체 스위트는 단계 끝 verifier 가.
`G="./gradlew"` 로 줄여 쓴다.

---

## P0 — 아웃박스 · 보안 · 결함

### Task Group 1: 아웃박스 릴레이 보강 (common)
**Dependencies:** None
**Phase:** P0
**Required Skills:** Kotlin, Spring Kafka, JPA, Flyway, Testcontainers
- [x] 1.0 Complete outbox hardening
  - [x] 1.1 테스트: 원문 JSON(첫 글자 `{`) · 릴레이 2개 동시 → 1회 발행 · 리스 만료 재수집 · 10회 실패 FAILED · PUBLISHED 7일 정리 · `partition_key` 가 레코드 키 · `traceparent` 헤더 컬럼 보존 (7)
  - [x] 1.2 `outbox_event` 확장 컬럼(nullable): `partition_key`·`attempts`·`next_attempt_at`·`lease_until`·`headers` + 상태 `SENDING`·`FAILED` — order·inventory·fulfillment 스키마에 다음 번호 마이그레이션, product 스키마엔 테이블 신설
  - [x] 1.3 릴레이: 트랜잭션 A(`FOR UPDATE SKIP LOCKED` 100행 → SENDING+리스) → 트랜잭션 밖 동기 전송(10초) → 트랜잭션 B(PUBLISHED | attempts++/next_attempt_at | FAILED). String 직렬화기 전용 ProducerFactory
  - [x] 1.4 정리 스케줄러 + 적체 게이지, commerce `spring.task.scheduling.pool.size=4`
  - [x] 1.5 Verify: `$G :common:test --tests '*Outbox*' && $G :commerce:app:test --tests '*OutboxRelayIntegration*'`
**Acceptance Criteria:** 1.1 일곱 테스트 통과, 직렬화 테스트는 JacksonJsonSerializer 로 되돌리면 빨간불(회귀 주입 기록)

### Task Group 2: 보안 선행 · 결함 제거
**Dependencies:** Task Group 1
**Phase:** P0
**Required Skills:** Kotlin, Spring Security 헤더 규약, Spring Cloud Gateway, React
- [x] 2.0 Complete P0 defects
  - [x] 2.1 테스트: 상품 쓰기 비판매자·타인 403 / 어드민 200 · 헤더 없음 거부 · stats ROLE_USER 403 · 2라인 중 1라인 부족 → 예약 0행 + `reservation.failed` · 확정·만료·해제·입고 `inventory.stock.*` 4종 · 게이트웨이 무토큰 401/역할 403/`/internal` 라우트 없음 (7)
  - [x] 2.2 `/api/products`→`/api/v1/products`, `/api/orders`→`/api/v1/orders` (게이트웨이·portal-fe `shopApi.ts`·admin-fe 동시), bulk → `/internal/products/bulk` + search-batch `ProductApiClient` + NetworkPolicy
  - [x] 2.3 상품 쓰기 권한: 게이트웨이 ROLE_SELLER|ROLE_ADMIN, 서비스 소유 검사(P1 전까지는 ROLE_ADMIN 만 통과 — 판매자 행이 아직 없다)
  - [x] 2.4 stats → `/api/v1/admin/orders/stats/**`
  - [x] 2.5 product 이벤트를 아웃박스로(TG1 테이블)
  - [x] 2.6 inventory: 주문 단위 예약 한 트랜잭션, inventory id 오름차순 `FOR UPDATE`, 부족은 `inventory.reservation.failed`; 만료·확정·해제·입고 동기화 이벤트; product `InventoryStockSyncConsumer` 에 confirmed·restocked 구독
  - [x] 2.7 Verify: `$G :product:feature:test --tests '*ProductController*' :inventory:feature:test --tests '*Reservation*' :gateway:test --tests '*RouteAuth*' && (cd portal-fe && npx tsc --noEmit -p tsconfig.app.json)`
**Acceptance Criteria:** 운영 배포 후 ROLE_USER 토큰으로 `PUT /api/v1/products/{id}` 403, 아웃박스 적체 0

**P0 배포:** 커밋·푸시 → Argo Synced → 적체 게이지 0 · 403 확인 · commerce 메모리 기록

---

## P1 — 판매자

### Task Group 3: seller 도메인 모듈
**Dependencies:** Task Group 2
**Phase:** P1
**Required Skills:** 신규 도메인 폴드, JPA, AES-GCM, Kafka
- [x] 3.0 Complete seller domain
  - [x] 3.1 테스트: 상태 전이표 전수 · 1인 1판매자(ACTIVE·PENDING·SUSPENDED) · 계좌 암호화·마스킹 · 키 없으면 기동 실패 · 승인 시 `seller.seller.approved` 아웃박스 · 반려 30일 파기 (6)
  - [x] 3.2 `seller:domain`/`seller:feature` 골격, `seller_db` Flyway, `SellerDataSourceConfig`(Hikari max 3), Messaging(아웃박스·멱등 원장), commerce 폴드 3곳 + 컨텍스트 로드 spec(행 쓰기·읽기)
  - [x] 3.3 API: `POST /api/v1/sellers/apply` · `/api/v1/seller/me` · 어드민 `/api/v1/admin/sellers/**`(승인·반려·정지·재활성·수수료율) + 조치 이력
  - [x] 3.4 `SELLER_ACCOUNT_ENC_KEY` Secret(oci-arm·prod 오버레이), 기본값 없음; 운영 `seller_db`·계정 생성(oci-mysql) + init 파일 동기화
  - [x] 3.5 Verify: `$G :seller:domain:test :seller:feature:test :commerce:app:test --tests '*CommerceContextLoad*'`
**Acceptance Criteria:** 3.1 통과, 컨텍스트 로드가 seller 행을 쓰고 읽는다

### Task Group 4: 역할 연동 · 상품 판매자 소유
**Dependencies:** Task Group 3
**Phase:** P1
**Required Skills:** Kotlin, Kafka, private 서브모듈 운영
- [x] 4.0 Complete seller wiring
  - [x] 4.1 테스트: auth 컨슈머 approved→ROLE_SELLER 행 · suspended→회수 · 다른 역할 무시 · product 판매자 읽기 모델 SUSPENDED → 판매자 쓰기 403(토큰 유효) · 판매자 생성 상품 seller_id 는 본문 무시 (5)
  - [x] 4.2 auth(private 서브모듈): Kafka 컨슈머 의존 + `seller.seller.*` 리스너(ROLE_SELLER 고정, 멱등) — 서브모듈 먼저 푸시
  - [x] 4.3 product: `seller_id` 컬럼 + 기본 판매자 1 백필, 판매자 읽기 모델(seller 이벤트), 소유·ACTIVE 검사(TG2 의 ROLE_ADMIN 전용 제한 해제)
  - [x] 4.4 Verify: `$G :auth:app:test --tests '*SellerRole*' :product:feature:test --tests '*SellerOwnership*'`
**Acceptance Criteria:** 정지 즉시 판매자 쓰기가 막힌다(토큰 재발급 없이)

### Task Group 5: 판매자 화면 · 방침
**Dependencies:** Task Group 4
**Phase:** P1
**Required Skills:** React, DESIGN.md 토큰, CDP 검증
- [x] 5.0 Complete seller FE
  - [x] 5.1 테스트: 입점 신청 폼 검증 · 판매자 포털 상품 목록이 자기 것만 (2, vitest)
  - [x] 5.2 portal-fe `/shop/seller/apply` · `/shop/seller/products`(등록·수정), admin-fe 판매자 신청·정지·수수료율 화면
  - [x] 5.3 `PrivacyPage.tsx` 수집 항목(판매자 정보) · 보존기간(정산 기록 5년) — 상수와 문구 함께
  - [x] 5.4 Verify: `(cd portal-fe && npx vitest run src/pages/seller && npx tsc --noEmit -p tsconfig.app.json) && (cd admin/frontend && npx tsc --noEmit -p tsconfig.app.json)` + CDP 4조합 캡처
**Acceptance Criteria:** 운영에서 신청→승인→상품 등록 1회

**P1 배포:** auth 서브모듈 → 본체 순 푸시, 신청·승인·역할 확인

---

## P2 — 결제

### Task Group 6: payment 도메인
**Dependencies:** Task Group 2
**Phase:** P2
**Required Skills:** 신규 도메인 폴드, 결제 상태 머신, MockWebServer, 스케줄러
- [x] 6.0 Complete payment domain
  - [x] 6.1 테스트: 전이표 전수(종착 포함) · 같은 orderNo → 모의 PG 승인 1건 · UNKNOWN → 재조회 → AUTHORIZED · 재조회 5회 초과 운영 이슈 · 환불 합 > 매입 거부 · 기본 프로필 토스 빈 없음·웹훅 404 · 토스 어댑터 confirm/조회/취소(MockWebServer) · 토스 웹훅 서명 401·중복 no-op·본문 금액 무시 · 대사 불일치 운영 이슈 / 일치 settled (8)
  - [x] 6.2 `payment:domain`/`payment:feature`, `payment_db`, 폴드 3곳, `ops_issue` 테이블
  - [x] 6.3 `PgPort` + 모의 PG(`MockPgScenario` 테스트 빈, 운영은 항상 승인) + 토스 어댑터(`payment.pg=toss`, 3초/5초, 서킷 브레이커 빈 이름 `paymentTossCircuitBreaker`)
  - [x] 6.4 명령 컨슈머 `payment.command.*` → 이벤트 `payment.payment.*`(키 orderId), UNKNOWN 재조회 스케줄러(30초·1·2·4·2.5분)
  - [x] 6.5 대사 배치(모의 PG 정산 파일) → `payment.reconciliation.settled`
  - [x] 6.6 Verify: `$G :payment:domain:test :payment:feature:test`
**Acceptance Criteria:** 6.1 통과, 운영 기본 프로필에서 `/api/v1/payments/webhooks/toss` 404

**P2 배포:** `payment_db` 생성 → 푸시 → 모의 결제 명령 1건을 Kafka 로 넣어 AUTHORIZED 확인

---

## P3 — 혜택 · 주문서

### Task Group 7: promotion 도메인
**Dependencies:** Task Group 2
**Phase:** P3
**Required Skills:** 신규 도메인 폴드, TCC, 동시성
- [ ] 7.0 Complete promotion domain
  - [ ] 7.1 테스트: 발행 상한 동시 100 → 상한만큼 · 사용자 쿠폰 1회 · 포인트 잔액 음수 불가 · TCC 같은 orderId 두 번 = 한 번 · 보류 30분 만료 `promotion.hold.expired` · 만료 hold 에 confirm → failed(EXPIRED) (6)
  - [ ] 7.2 `promotion:domain`/`promotion:feature`, `promotion_db`, 폴드 3곳
  - [ ] 7.3 쿠폰 정의·발행(조건부 UPDATE)·사용자 쿠폰, 포인트 원장 + 잔액 `@Version`, TCC 명령 `promotion.command.*`, 읽기 모델용 `promotion.coupon.*`·`promotion.point.changed`
  - [ ] 7.4 어드민 쿠폰 API, 사용자 `/api/v1/coupons/me`·`/api/v1/points/me`
  - [ ] 7.5 Verify: `$G :promotion:domain:test :promotion:feature:test`
**Acceptance Criteria:** 7.1 통과

### Task Group 8: order 읽기 모델 · 장바구니 · 주문서 · 금액
**Dependencies:** Task Group 4, 7
**Phase:** P3
**Required Skills:** Kotlin, 금액 계산, Flyway 확장-축소
- [ ] 8.0 Complete order sheet
  - [ ] 8.1 테스트: 안분 잔차 최대 라인(동률 앞)·합 보존 · 정률 내림·수수료 HALF_UP 경계 · 주문서 만료·재사용·타인 422 · 정지 판매자 상품 422 · 수수료율 스냅샷 유지 · 금액 백필(DECIMAL→BIGINT) (6)
  - [ ] 8.2 order 읽기 모델(상품·판매자·쿠폰 정의·사용자 쿠폰·포인트 잔액) 컨슈머 — 멱등 핸들러
  - [ ] 8.3 `Money` → 원 단위 Long, `unit_price_won` 확장 컬럼 + 백필, product `price` 동일
  - [ ] 8.4 장바구니 API, 주문서 `POST /api/v1/order-sheets`(가격·가용성·쿠폰·포인트·판매자 배송비, 만료 15분, 라인 스냅샷)
  - [ ] 8.5 Verify: `$G :order:domain:test --tests '*Allocation*' :order:feature:test --tests '*OrderSheet*'`
**Acceptance Criteria:** 요청 JSON 에 가격을 넣어도 금액 불변

### Task Group 9: 장바구니 · 주문서 화면
**Dependencies:** Task Group 8
**Phase:** P3
**Required Skills:** React, CDP 검증
- [ ] 9.0 Complete cart/sheet FE
  - [ ] 9.1 테스트: 주문서 금액 분해 렌더 · 만료 시 재생성 안내 (2, vitest)
  - [ ] 9.2 portal-fe 장바구니 · 주문서(쿠폰 선택·포인트 입력·판매자별 배송비), admin-fe 쿠폰 관리
  - [ ] 9.3 Verify: `(cd portal-fe && npx vitest run src/pages/shop && npx tsc --noEmit -p tsconfig.app.json)` + CDP 4조합
**Acceptance Criteria:** 운영에서 주문서 1건 생성

**P3 배포:** `promotion_db` 생성 → 푸시 → 주문서 생성 확인

---

## P4 — 사가

### Task Group 10: 명령 핸들러 (inventory · promotion · payment · fulfillment)
**Dependencies:** Task Group 6, 7, 8
**Phase:** P4
**Required Skills:** Kafka, 멱등 컨슈머
- [ ] 10.0 Complete command handlers
  - [ ] 10.1 테스트: `inventory.command.reserve/confirm/release/restock` 멱등 · 만료 예약 confirm → failed(EXPIRED), DLT 0 · `fulfillment.command.create/cancel` → created / cancelled / cancel-rejected · 은퇴 리스너 부재(옛 토픽 레코드 → 행 0) (5)
  - [ ] 10.2 inventory 명령 컨슈머(키 orderId, `partition_key` 기록), 옛 `onOrderCompleted`·`onOrderCancelled`·`onFulfillmentShipped`·`onFulfillmentCancelled` 삭제
  - [ ] 10.3 fulfillment 명령 컨슈머 + 라인 취소, 옛 `onStockReserved` 삭제
  - [ ] 10.4 ACTIVE 예약 전환 작업(기동 1회·멱등: CONFIRMED + reserved_qty 차감 + stock.confirmed)
  - [ ] 10.5 Verify: `$G :inventory:feature:test --tests '*Command*' :fulfillment:feature:test --tests '*Command*'`
**Acceptance Criteria:** 전환 작업 두 번 실행해도 수량 한 번만 변함

### Task Group 11: 사가 코디네이터 · 주문 상태 · 멱등 키
**Dependencies:** Task Group 10
**Phase:** P4
**Required Skills:** 사가 설계, JPA 락, Flyway 데이터 전환
- [ ] 11.0 Complete saga
  - [ ] 11.1 테스트: 주문·사가 전이표 전수 · Idempotency-Key 409/동일 응답/리스 만료 · 결제 대기 4번째 429 · PAYMENT_PENDING 취소 409 · 상태 전환 마이그레이션(COMPLETED→CONFIRMED, PENDING→FAILED) · `@Version`·status_history (6)
  - [ ] 11.2 `order_saga`·`idempotency_key`·`order_status_history`·라인 상태·`refunded_amount` 마이그레이션, 유니크 제약(중복 조회 후)
  - [ ] 11.3 코디네이터: 단계 진행·역순 보상·피벗 뒤 재시도(10회 → STUCK)·기한 재발행·0원 경로·보류 만료 (a)(b) 규칙·UNKNOWN 대기
  - [ ] 11.4 `POST /api/v1/orders` 202 + `GET /api/v1/orders/{id}` 상태, 옛 `OrderService`·`PaymentAdapter`·`ProductAdapter`·`WebClientConfig`·`onReservationExpired` 삭제, 토픽 `order.order.completed/cancelled` 은퇴
  - [ ] 11.5 Verify: `$G :order:domain:test :order:feature:test --tests '*Saga*' --tests '*Idempotency*'`
**Acceptance Criteria:** 11.1 통과

### Task Group 12: 사가 E2E · 결제 대기 화면
**Dependencies:** Task Group 11
**Phase:** P4
**Required Skills:** Testcontainers(MySQL+Kafka), React
- [ ] 12.0 Complete saga E2E
  - [ ] 12.1 E2E: 정상 · 결제 거절 · 재고 부족(PG 0회) · UNKNOWN 대기 → 승인 · UNKNOWN 결론 FAILED → 보상 · 보류 만료 (a) · 보류 만료 (b) · 피벗 뒤 재시도/STUCK · 0원 · 같은 키 중복 (10) — `CI=true` 에서 Docker 부재는 실패
  - [ ] 12.2 portal-fe 주문 접수 → 결제 대기(폴링) → 결과 화면, 주문 상세
  - [ ] 12.3 Verify: `$G :commerce:app:test --tests '*SagaE2E*' && (cd portal-fe && npx tsc --noEmit -p tsconfig.app.json)`
**Acceptance Criteria:** (b) 분기 회귀 주입 빨간불 기록, 운영 주문 1건 CONFIRMED + 이행 생성

**P4 배포:** 확장 마이그레이션 → 코드 → 운영 주문 1건 사가 COMPLETED 확인 → 남은 ACTIVE 예약 0 확인

---

## P5 — 클레임

### Task Group 13: 클레임 · 구매 확정
**Dependencies:** Task Group 12
**Phase:** P5
**Required Skills:** Kotlin, 금액 계산, React
- [ ] 13.0 Complete claims
  - [ ] 13.1 테스트: 환불액 = 라인 결제액, 포인트 원복 + 부분 환불 · 쿠폰 유지/전체 취소 반환 · 배송비 규칙 · 클레임 분기(자동/cancel-rejected 대기) · 구매 확정 자동(Clock) → `order.line.purchase-confirmed` · 부분 취소 주문 남은 라인 확정 → COMPLETED (6)
  - [ ] 13.2 클레임 API `/api/v1/claims`(본인), 판매자 승인 `/api/v1/seller/claims`, 사가형 처리(fulfillment cancel → restock → promotion restore → payment refund), `order.claim.refunded`
  - [ ] 13.3 구매 확정 버튼 + 자동 스케줄러, `order.order.confirmed`(라인·배송비 라인 포함)
  - [ ] 13.4 FE: 주문 상세 취소·부분 취소, 판매자 포털 클레임 승인
  - [ ] 13.5 Verify: `$G :order:domain:test --tests '*Claim*' :order:feature:test --tests '*Claim*' --tests '*PurchaseConfirm*' :commerce:app:test --tests '*ClaimE2E*'`
**Acceptance Criteria:** 운영 부분 취소 1건 환불 완료

---

## P6 — 원장 · 정산

### Task Group 14: settlement 도메인
**Dependencies:** Task Group 13
**Phase:** P6
**Required Skills:** 복식부기, 배치, React
- [ ] 14.0 Complete settlement
  - [ ] 14.1 테스트: 거래 차·대 불일치 예외 · 역분개 · 이벤트 id 멱등 · 지급액 = Σ순매출 + Σ배송비 − Σ수수료 = 미지급금 감소분 · 환불 라인 정산서 제외 · ≤0 CARRIED_OVER · 정산서 전이표 (7)
  - [ ] 14.2 `settlement:domain`/`settlement:feature`, `settlement_db`, 폴드 3곳
  - [ ] 14.3 원장 기록 컨슈머(`order.order.confirmed`·`order.claim.refunded`·`payment.reconciliation.settled`), 정산 배치(판매자 주기), 모의 송금, 지급 거래
  - [ ] 14.4 판매자 포털 정산서 · 어드민 정산 목록
  - [ ] 14.5 Verify: `$G :settlement:domain:test :settlement:feature:test :commerce:app:test --tests '*SettlementE2E*'`
**Acceptance Criteria:** 원장 불변식 회귀 주입 빨간불 기록, 운영 정산서 1건

---

## P7 — 운영 · 마감

### Task Group 15: 운영 이슈 · DLT · 추적
**Dependencies:** Task Group 14
**Phase:** P7
**Required Skills:** Kafka DLT, Micrometer Tracing, React
- [ ] 15.0 Complete ops
  - [ ] 15.1 테스트: DLT 레코드 → ops_issue → 재발행 API 로 원 토픽 재수신 · 체류 사가 10분 → ops_issue · traceparent 가 아웃박스 거쳐 컨슈머 MDC (3)
  - [ ] 15.2 `ops_issue` 를 order·inventory·fulfillment·product 에도, 도메인별 DLT 컨슈머, `/api/v1/admin/{domain}/ops-issues`(조회·재시도·종결·사유)
  - [ ] 15.3 Micrometer Tracing + Kafka 헤더 전파, 지표(사가 체류·보상·UNKNOWN·적체·대사 불일치·지급 합계)
  - [ ] 15.4 admin-fe 운영 큐(8도메인 합침)
  - [ ] 15.5 Verify: `$G :order:feature:test --tests '*OpsIssue*' :commerce:app:test --tests '*Tracing*'`
**Acceptance Criteria:** 운영 큐 화면에서 DLT 1건 재발행

### Task Group 16: 문서 · CI · 최종 검증
**Dependencies:** Task Group 15
**Phase:** P7
**Required Skills:** 문서, CI
- [ ] 16.0 Complete docs
  - [ ] 16.1 도메인 넷 `CLAUDE.md`·`glossary.md`, `docs/context-map.md`, 루트 서비스 표, `kafka-convention.md`·`kafka-topics.md`, `order`/`inventory`/`fulfillment` CLAUDE.md 갱신, ADR-0099 상태 → 채택, ADR-0032 에 대체 표시
  - [ ] 16.2 `.github/workflows/ci.yml` PR 게이트에 새 4도메인 테스트
  - [ ] 16.3 회귀 주입 일곱 건 기록 `verifications/regression-injection.md`
  - [ ] 16.4 Verify: `python3 ai/plugins/hns/scripts/doc_map.py --check && $G :commerce:app:check`
**Acceptance Criteria:** doc lock drift 0, 컨텍스트 로드가 10도메인 행 쓰기·읽기

## Execution Order
1. TG1 → TG2 (P0 배포)
2. TG3 → TG4 → TG5 (P1 배포)
3. TG6 (P2 배포)
4. TG7 → TG8 → TG9 (P3 배포)
5. TG10 → TG11 → TG12 (P4 배포)
6. TG13 (P5 배포)
7. TG14 (P6 배포)
8. TG15 → TG16 (P7 배포)
