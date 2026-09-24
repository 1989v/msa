# Status — 검증 증거

## TG1 아웃박스 보강 (2026-09-24)
- `./gradlew :common:test --tests '*Outbox*' :commerce:app:test --tests '*OutboxRelayIntegration*' --tests '*CommerceContextLoad*'`
  - OutboxJpaAdapterSpec tests=2 failures=0 · OutboxPollingPublisherSpec tests=5 failures=0
  - OutboxRelayIntegrationSpec tests=5 skipped=0 failures=0 · CommerceContextLoadSpec tests=2 failures=0
- 회귀 주입: JSON 직렬화기로 되돌리면 `expected:<'{'> but was:<'"'>` · SKIP LOCKED 제거 시 중복 발행 검출
- 미확인: CI=true + Docker 부재 시 실패(로컬에서 Docker 우회를 막지 못해 재현 못 함)

## TG2 보안·결함 (2026-09-24)
- `./gradlew :product:feature:test --tests '*ProductController*' :inventory:feature:test --tests '*Reservation*' :gateway:test --tests '*RouteAuth*' --tests '*GatewayRouting*' :order:feature:test --tests '*OrderStats*' :search:batch:compileKotlin :commerce:app:test --tests '*CommerceContextLoad*'` → exit 0
  - ProductControllerAuthTest 8/0 · OrderReservationTest 6/0 · ReservationStockSyncEventTest 4/0 · InventoryReservationLockOrderTest 1/0 · GatewayRouteAuthSpec 9/0 · GatewayRoutingSpec 17/0 · OrderStatsControllerTest 4/0 · CommerceContextLoadSpec 4/0 (skipped 0)
- `npx tsc --noEmit -p tsconfig.app.json` portal-fe 0 · admin 0 (`-p .` 는 files:[] 라 0개 파일 검사 — tasks.md 명령 수정)
- 회귀 주입: 권한 무조건 통과 → 3 실패 · 게이트웨이 쓰기 라우트 userConfig → 1 실패 · 부족 라인 건너뛰기 → 4 실패

## P0 배포 (2026-09-24)
- push `269c352c` → images success · ci success (Docs Health 실패는 이전 커밋부터 계속된 기존 실패)
- oci-arm: commerce·gateway `:269c352` ready 1/1, Argo Synced (health Degraded 는 2026-09-20T05:00 부터 — 이번 배포와 무관)
- 운영 확인: GET /api/v1/products 200 · 옛 /api/products 404 · 무토큰 PUT /api/v1/products/1 401 · /api/v1/admin/orders/stats 401 · /internal/** 게이트웨이 미도달(portal-fe 405)
- Flyway: order_db·product_db 20260924.001 success=1 · commerce 최근 20분 ERROR 0
- commerce 메모리 P0 후: 455MiB / 1200Mi (cgroup memory.current)

## TG3 seller 도메인 (2026-09-24)
- `./gradlew :seller:domain:test :seller:feature:test :gateway:test :commerce:app:test :commerce:app:check` → exit 0
  - SellerTest 27/0 · AccountNumberTest 3/0 · SellerAdminServiceTest 4/0 · SellerPrivacyServiceTest 2/0 · SellerServiceTest 4/0 · AesGcmAccountCipherTest 6/0 · SellerControllerTest 10/0
  - GatewayRouteAuthSpec 14/0 · OutboxRelayIntegrationSpec 5/0 · SellerAccountKeyStartupSpec 3/0 · CommerceContextLoadSpec 5/0 · CommerceDualDataSourceIntegrationSpec 2/0 (skipped 0)
- 회귀 주입: 키 기본값 넣으면 기동 실패 테스트 FAILED · seller-admin 라우트 userConfig → 403 테스트 FAILED · TM 한정자 제거 → verifyTransactionQualifiers BUILD FAILED

## TG4 역할 연동 · 상품 판매자 소유 (2026-09-24)
- `./gradlew verifyArchitecture :auth:app:test --tests '*SellerRole*' :product:feature:test :product:domain:test :commerce:app:test --tests '*CommerceContextLoad*'` → exit 0
  - SellerRoleEventConsumerIntegrationSpec 6/0 (Testcontainers) · SellerOwnershipReadModelTest 3/0 · ProductControllerSellerOwnershipTest 7/0 · ProductControllerAuthTest 8/0 · CommerceContextLoadSpec 5/0
- auth 서브모듈 `fe0f5f6` (feat/seller-role) — ROLE_SELLER 만 grant/revoke, processed_event V2
- `generateTopology` 로 seller 를 topology 에 등록(누락 시 CI 가 seller 변경에 commerce 이미지를 안 만든다)
- 회귀 주입 5종(정지→부여 · 소유 검사 제거 · 판매자 id 1 고정 · ACTIVE 무시 · 옛 이벤트 거르기 제거) 전부 빨간불

## TG5 판매자 화면 · 방침 (2026-09-24)
- `./gradlew :seller:feature:test :product:feature:test :gateway:test --tests '*RouteAuth*' verifyArchitecture` → exit 0
  - SellerControllerTest 15/0 · ProductControllerAuthTest 8/0 · ProductControllerSellerOwnershipTest 8/0 · GatewayRouteAuthSpec 16/0
- portal-fe `npx vitest run src/pages/seller src/pages/__tests__/privacyRetention.test.ts` → Test Files 3 passed · Tests 9 passed; tsc(tsconfig.app.json) portal 0 · admin 0
- 추가: `GET /api/v1/sellers/me`(ROLE_USER, 네 상태 + 사유) · 상품 목록 `sellerId` 필터
- CDP: ACTIVE 인장 라이트 1.46:1 발견 → `--ko-accent-text` 로 8.24:1. 캡처 `verifications/tg5/`

## TG6 payment 도메인 (2026-09-24)
- `./gradlew :payment:domain:test :payment:feature:test :commerce:app:test :gateway:test --tests '*RouteAuth*' verifyArchitecture` → exit 0
  - PaymentTest 69/0 · OpsIssueTest 3/0 · PaymentCommandServiceTest 5/0 · PaymentResolutionServiceTest 5/0 · ReconciliationServiceTest 2/0 · TossPgAdapterTest 6/0 · TossWebhookControllerTest 3/0 · PaymentOpsIssueAdminControllerTest 2/0
  - PaymentPgSelectionSpec 5/0 · CommerceContextLoadSpec 6/0 · OutboxRelayIntegrationSpec 5/0 · SellerAccountKeyStartupSpec 3/0 · DualDataSource 2/0 · GatewayRouteAuthSpec 21/0 (skipped 0)
- 회귀 주입: orderNo 재승인 → 2곳 빨간불 · 보류 VOID (b-1) → 빨간불 · (b-2) → 도메인 테스트만 잡음(서비스 테스트는 requireNotNull 이 먼저 멈춤) · 웹훅 조건 제거 → 404 테스트 빨간불

## P1 배포 (2026-09-24)
- auth 서브모듈 `fe0f5f6` → msa-auth main, 본체 `ace78377` push → images success(run 35953658333) · 태그 bump `9020be2b`
- 운영: commerce·gateway·auth·admin-fe·portal-fe `:ace7837` ready 1/1
- 무토큰 POST /api/v1/sellers/apply 401 · GET /api/v1/sellers/me 401 · /api/v1/seller/me 401 · /api/v1/admin/sellers 401 · /shop/seller/apply 200 · GET /api/v1/products?sellerId=1 200(sellerId 필드)
- seller_db: 플랫폼 판매자 1 ACTIVE · product_db product_seller 시드 1 · products 24 전부 seller_id=1 백필
- auth 컨슈머 `auth-seller-role` 파티션 할당 확인, commerce·auth 최근 ERROR 0
- ~~롤아웃 직후 옛 gateway 파드가 404~~ **정정(P3 때 발견)**: 404 는 확인 루프의 오류였다 — zsh 는 `set -- $p` 를 단어 분리하지 않아 루프가 사이트 루트 `/` 를 불렀다(`url_effective=https://1989v.com/`). 라우트는 처음부터 정상
- 미확인: 실제 로그인 사용자로 신청 → 승인 → ROLE_SELLER → 상품 등록 한 바퀴(OAuth 로그인 필요)

## TG7 promotion 도메인 (2026-09-24)
- `./gradlew :promotion:domain:test :promotion:feature:test :commerce:app:test :gateway:test --tests '*RouteAuth*' verifyArchitecture` → exit 0
  - CouponDefinitionTest 16/0 · UserCouponTest 5/0 · PromotionHoldTest 9/0 · PointBalanceTest 3/0 · CouponClaimServiceTest 4/0 · PromotionHoldServiceTest 13/0 · PromotionCommandConsumerTest 2/0 · PromotionControllerTest 6/0
  - PromotionIntegrationSpec 5/0 (실 MySQL: 100명 동시 발급 → 정확히 30) · CommerceContextLoadSpec 7/0 · GatewayRouteAuthSpec 26/0 (skipped 0)
- 회귀 주입: 발급 상한 조건 제거 · reserve 멱등 제거 · EXPIRED 경로 예외/무시 → 전부 빨간불

## P2 배포 (2026-09-24)
- push `043a9e87`(임시 워크트리에서 리베이스) → images success(run 35957305306) · bump `ea82c0fe`
- 운영: commerce·gateway `:043a9e8` ready · payment_db Flyway V1 success=1 · POST /api/v1/payments/webhooks/toss 404(모의 PG) · /api/v1/admin/payments/ops-issues 401 · commerce ERROR 0

## TG8 order 읽기 모델 · 장바구니 · 주문서 · 원 단위 금액 (2026-09-24)
- `./gradlew :order:domain:test :order:feature:test :product:domain:test :product:feature:test :commerce:app:test :gateway:test --tests '*RouteAuth*' verifyArchitecture` → exit 0
  - AllocationTest 10/0 · CommissionTest 3/0 · OrderSheetTest 21/0 · CouponDefinitionViewTest 13/0 · SellerViewTest 3/0 · OrderSheetControllerTest 9/0 · CartControllerTest 7/0 · OrderReadModelConsumerTest 7/0
  - OrderSheetIntegrationSpec 7/0 (실 MySQL, validate) · CommerceContextLoadSpec 7/0 · GatewayRouteAuthSpec 34/0 (skipped 0)
- 회귀 주입 6종(잔차 첫 라인 · 동률 뒤 라인 · 판매자 상태 무시 · 옛 이벤트 거르기 제거 · 컬럼명 변경 · 백필 소수 검사 제거) 전부 빨간불
- 배포 후 1회: 어드민 `POST /api/v1/admin/products/republish` → order_db.product_view = 24 확인

## TG9 장바구니 · 주문서 화면 (2026-09-24)
- portal-fe `npx vitest run src/pages/shop src/pages/seller src/pages/__tests__/privacyRetention.test.ts` → Test Files 4 passed · Tests 12 passed; tsc(tsconfig.app.json) portal 0 · admin 0
- 회귀 주입: 결제 금액을 라인 합으로 · 재생성 요청에 unitPrice · 만료 무시 → 전부 빨간불
- CDP 9회(`verifications/tg9/`): 가로 넘침 0, 라벨 대비 라이트 4.99~15.82 · 다크 6.04~14.42, 엇갈림 조합 값 일치. 헤더 "장바구/니" 줄바꿈 회귀를 발견·수정

## P3 배포 (2026-09-24)
- push `64b0a51c` → images success(run 35960645374) · 운영 commerce·gateway·portal-fe·admin-fe `:64b0a51`
- promotion_db V1 success · order_db 20260924.002 success
- 무토큰 POST /api/v1/order-sheets · GET /api/v1/cart · /api/v1/coupons/me · /api/v1/points/me → 401 (게이트웨이 로그 Route{id='cart'} 매칭)
- **order_db.product_view 0 · seller_view 1(시드)** — 원인은 TG10 에서 발견: commerce 에 `@EnableKafka` 가 없어 모든 `@KafkaListener` 가 등록된 적이 없다(읽기 모델·명령·재고 동기화 컨슈머 전부 운영 무동작)

## TG10 명령 핸들러 · 옛 구독 은퇴 · ACTIVE 전환 (2026-09-24)
- `./gradlew :inventory:domain:test :inventory:feature:test :fulfillment:domain:test :fulfillment:feature:test :commerce:app:test verifyArchitecture` → exit 0, 실패 0
  - InventoryCommandServiceTest 10/0 · FulfillmentCommandServiceTest 5/0 · RetiredChoreographyCommandIntegrationSpec 4/0(실 MySQL·실 Kafka, 리스너 전부 켜짐) · CommerceContextLoadSpec 7/0 · OrderSheet 7/0 · Promotion 5/0 (skipped 0)
- `@EnableKafka` 를 inventory `KafkaConfig` 에 추가(호스트 전체 리스너가 켜짐) — 제거 회귀 주입 시 통합 spec 컨텍스트 실패
- 회귀 주입 12종 전부 빨간불

## TG10 배포 (2026-09-24)
- push `9315f31e`(+ `421d2be9`) → images success(run 35963715878) · commerce `:421d2be` ready
- commerce 리스너 컨테이너 23개 파티션 할당 확인(order-read-model · inventory/payment/promotion/fulfillment 명령 · product-stock/seller-sync · order-service 만료) — 이전 배포까지 0개
- 상품 재발행(클러스터 안에서 commerce:8085 에 어드민 헤더로 호출) → `{"published":24}` · product_db outbox PUBLISHED 24 → **order_db.product_view 24** (아웃박스 → 릴레이 → Kafka → 읽기 모델 전 구간 운영 확인)
- commerce ERROR 0

## TG11 사가 코디네이터 · 주문 상태 · 멱등 키 (2026-09-24)
- `./gradlew :order:domain:test :order:feature:test :commerce:app:test :gateway:test --tests '*RouteAuth*' verifyArchitecture` → exit 0, 실패 0
  - OrderTest 8/0 · OrderSagaTest 13/0 · OrderSagaCoordinatorTest 21/0 · OrderControllerIdempotencyTest 11/0 · OrderOutboxEventAdapterTest 3/0
  - OrderSagaIdempotencyIntegrationSpec 8/0 (동시 이벤트 8개 → @Version 충돌 7회 재시도 수렴) · RetiredChoreographyCommandIntegrationSpec 4/0 · CommerceContextLoadSpec 8/0 (skipped 0)
- 옛 OrderService·PaymentAdapter·ProductAdapter·WebClientConfig·onReservationExpired·order.order.completed/cancelled 삭제
- 통합 테스트가 잡은 결함 2(MySQL JSON 정규화로 무변경 재시도가 충돌 · 배송비 라인 순서) 수정
- 회귀 주입 5종 — 첫 시도 초록불(가드 이중) 후 가드까지 제거해 빨간불 확인. 리스 가드는 실 MySQL 통합만 잡음

## TG12 사가 E2E · 결제 대기 화면 (2026-09-24)
- `./gradlew :commerce:app:test --tests '*E2E*'` → OrderSagaE2ETest tests=14 failures=0 skipped=0 (정상 · 같은 키 · 0원 · 거절 · 재고 부족 · UNKNOWN 두 갈래 · 보류 만료 (a)·(b) 두 갈래 · 매입 재시도 수렴 · STUCK)
- P4 배포 전 전체: `verifyArchitecture` + common·gateway·order·product·promotion·payment·seller·inventory·fulfillment·search:batch·commerce:app 전 테스트 → exit 0
- portal-fe vitest Test Files 5 · Tests 19 passed · tsc 0
- 회귀 주입: 코디네이터 (b) VOID 건너뛰기 → 2 실패(`expected:<"COMPENSATING"> but was:<"RUNNING">`) · 결제 쪽 UNKNOWN 즉시 VOID → 1 실패
- commerce 테스트 JVM `maxHeapSize = "1g"`(기본 512m 에서 E2E 기동 중 GC 정지 — 태스크 성립 조건이라 반영)

## P4 배포 + 운영 주문 1건 시도 (2026-09-24)
- push `95d169d5` → images success(run 35989730975) · commerce·portal-fe `:95d169d` · order_db 20260924.005 · inventory_db V6 · ERROR 0 · 파티션 할당 48
- 운영 점검(사용자 id `ops-e2e-20260924`, 클러스터 안 호출): 창고 id 1 생성 → 상품 81 입고 5 → 주문서 id 1(1,700원) 생성 성공 → **주문 접수 500**
- 원인: 운영 `orders.status` 가 Hibernate 가 만든 `enum('CANCELLED','COMPLETED','PENDING')` — Flyway V1 은 VARCHAR 라 테스트는 통과. `Data truncated for column 'status'`
- 핫픽스 `c0714b09`(order V20260924_006 · fulfillment V20260924_004, status → VARCHAR(20)) — 임시 워크트리에서 origin/main 위에 푸시
- 운영 ENUM 컬럼은 13개(다른 도메인 포함) — Q19

## TG13 클레임 · 구매 확정 (2026-09-24)
- `./gradlew :order:domain:test :order:feature:test :commerce:app:test --tests '*Claim*' --tests '*PurchaseConfirm*' --tests '*CommerceContextLoad*' --tests '*SagaE2E*' :gateway:test --tests '*RouteAuth*' verifyArchitecture` → exit 0
  - ClaimRefundPlanTest 8/0 · ClaimTest 7/0 · PurchaseConfirmTest 5/0 · ClaimCoordinatorTest 15/0 · PurchaseConfirmServiceTest 4/0 · ClaimE2ETest 3/0 · OrderSagaE2ETest 14/0 · CommerceContextLoadSpec 8/0 · GatewayRouteAuthSpec 39/0
- portal-fe vitest Test Files 7 · Tests 26 passed · tsc 0
- 회귀 주입 8종 — 재입고 페이로드 키 변경은 단위 초록·E2E 만 빨강(배선은 E2E 만 지킨다)

## 핫픽스 배포 + 운영 첫 주문 성공 (2026-09-24)
- `c0714b09` images success(run 35993379277) → commerce `:c0714b0` · orders.status `varchar(20)` 확인
- 운영 주문 id 1 (사용자 `ops-e2e-20260924`, 상품 81 × 1, 1,700원): 2초 CREATED → 4초 PAID → 8초 CONFIRMED → **10초 FULFILLING, 사가 COMPLETED**
- 도메인 간 일치: payment `ORD-1-1` 1700 CAPTURED · inventory 81 available 5→4 reserved 0 · reservation CONFIRMED · fulfillment PENDING(창고 1) · order_status_history 5행 · order outbox PUBLISHED 8 · product 81 stock 4
- 운영에 남긴 점검 데이터: 창고 id 1 `ops-check-warehouse` · 상품 81 재고 · 주문서 1·2 · 주문 1 (사용자 `ops-e2e-20260924`)

## TG14 settlement 도메인 (2026-09-24)
- `./gradlew :settlement:domain:test :settlement:feature:test :commerce:app:test --tests '*Settlement*' --tests '*CommerceContextLoad*' --tests '*ClaimE2E*' --tests '*SagaE2E*' :gateway:test --tests '*RouteAuth*' verifyArchitecture` → exit 0
  - JournalRulesTest 9/0 · JournalTest 5/0 · SettlementCycleTest 5/0 · SettlementStatementTest 9/0 · LedgerServiceTest 5/0 · SettlementBatchServiceTest 7/0 · SettlementEventConsumerTest 2/0 · SettlementControllerTest 3/0
  - SettlementE2ETest 2/0 (주문 → 부분 취소 → 구매 확정 → 대사 → 배치 → PAID, 지급 24,600 이 정산서·지급 분개·미지급금 감소 세 곳 일치, 시산표 0) · ClaimE2E 3/0 · OrderSagaE2E 14/0 · CommerceContextLoadSpec 9/0 · GatewayRouteAuthSpec 44/0
- portal-fe vitest Test Files 8 · Tests 31 passed · tsc portal 0 · admin 0
- 회귀 주입: 차=대 검사 제거 · 환불 필터 제거 · 지급 금액 변경 · 보존 3년 → 전부 빨간불

## P5 배포 + 운영 클레임 1건 (2026-09-24)
- push `3a08ca07` → 1차 images 실패(프리렌더 스크립트가 deal 카탈로그 조회 일시 실패 `Unexpected end of JSON input` 로 의도적으로 빌드 중단 — 코드 무관) → `gh run rerun` 성공 → commerce `:3a08ca0`
- 운영 주문 1 전체 취소: 미리보기 refund 1700·fullCancel·판매자 승인 불필요 → 클레임 1 REQUESTED(FULFILLMENT_CANCEL) → 2초 APPROVED(INVENTORY_RESTOCK) → 4초 PAYMENT_REFUND → **6초 REFUNDED, 주문 CANCELLED, refunded_amount 1700**
- 도메인 간 일치: payment `ORD-1-1` REFUNDED · refund `claim:1` 1700 · inventory 81 avail 5 reserved 0 · reservation restocked 1 · fulfillment CANCELLED · product 81 stock 5

## P6 배포 (2026-09-24)
- push `990d7a18`(Sidebar 충돌 — 다른 세션 아이콘과 합침, admin `tsc -b` 0) → images success · commerce `:990d7a1`
- settlement_db Flyway V1 success. 새 컨슈머 그룹 `settlement-ledger` 가 기존 토픽을 처음부터 읽어 주문 1 의 원장을 만들었다:
  - journal 2 `capture:order:1` — Dr PG_RECEIVABLE 1700 / Cr SELLER_PAYABLE 1700 (플랫폼 판매자 수수료 0)
  - journal 1 `refund:claim:1` — Dr SELLER_PAYABLE 1700 / Cr PG_RECEIVABLE 1700
  - 거래마다 차 = 대. 환불이 매입보다 먼저 기록됨(토픽 간 소비 순서) — 추가만 원장이라 순 결과 동일

## TG15 운영 이슈 · DLT · 추적 · 지표 · 운영 큐 (2026-09-24)
- `./gradlew :commerce:app:test :order:feature:test :inventory:feature:test :fulfillment:feature:test :product:feature:test :seller:feature:test :promotion:feature:test :settlement:feature:test :payment:feature:test :common:test :gateway:test verifyArchitecture` → exit 0, 전 모듈 실패 0
  - DltOpsIssueIntegrationSpec 4/0 · TracingPropagationIntegrationSpec 3/0 · ClaimE2E 3/0 · OrderSagaE2E 14/0 · SettlementE2E 2/0 · 그 외 commerce 스펙 전부 0 실패
- 첫 보고는 E2E 를 안 돌렸고 부모 재검증에서 7건 실패 발견 → 원인: 패턴 구독 DLT 컨테이너가 E2E 「전 컨테이너 할당」 대기를 영원히 막음 + 토픽 선생성 경쟁 — E2E 대기 조건 수정(제품 코드 무변경)
- 발견·수정한 기존 결함: DLT 토픽이 규약 `.DLT` 가 아니라 Spring Kafka 4 기본 `-dlt` 로 가고 있었다 · order·inventory·fulfillment·product DLT 값 이중 인용
- 회귀 주입 4종(DLT 리스너 제거 · 추적 헤더 제거 · 체류 중복 검사 제거 · 게이트웨이 라우트 제거) 전부 빨간불
- admin-fe `tsc -b --force` 0 · vitest 4 passed
