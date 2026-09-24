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
