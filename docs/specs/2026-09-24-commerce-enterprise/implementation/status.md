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
- 롤아웃 직후 몇 분간 옛 gateway 파드가 새 경로에 404 — 롤아웃 완료 후 401 로 일관
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
