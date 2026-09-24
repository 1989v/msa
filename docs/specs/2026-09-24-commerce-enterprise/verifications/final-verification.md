# Verification Report: 2026-09-24-commerce-enterprise
**Date:** 2026-09-25 (KST 00:20 무렵)  **Status:** PASS WITH ISSUES

## Summary
검증 대상은 `feat/commerce-enterprise` HEAD `cbe3ce98`이다(origin/main `0bb4afc6`의 조상).
16개 태스크 그룹의 핵심 산출물은 전부 코드에 있고 배선도 돼 있다. Docker 없이 도는 스위트는 모두 통과했다: Gradle 801/801, portal·admin tsc 0, 커머스 관련 vitest 전부.
문제는 네 가지다.
- 상품 `price`가 원 단위로 전환되지 않았다(TG8 8.3 · SR-13).
- TG15 코드(`e93403f5`)는 CI 테스트 게이트와 운영 배포를 한 번도 통과하지 않았다.
- 운영 AC 일부(부분 취소, 정산서 1건, DLT 재발행, 판매자 한 바퀴)가 확인되지 않았다.
- `commerce:app` Testcontainers 스펙(E2E 포함)은 이번 검증에서 다시 돌리지 못했다.

## Tasks

| TG | 판정 | 근거 (파일·심볼) | 비고 |
|---|---|---|---|
| 1 아웃박스 보강 | PASS | `common/.../outbox/OutboxRepository.kt`(`FOR UPDATE SKIP LOCKED`) · `OutboxKafka.kt`(값 `StringSerializer`) · `OutboxJpaAdapter.partitionKey` · `commerce/app/.../application.yml` `spring.task.scheduling.pool.size: 4` · inventory `V4__extend_outbox_event_relay.sql`, product `V20260924_001__create_outbox_event.sql` | 통합 spec `OutboxRelayIntegrationSpec`은 이번에 못 돌림. status.md TG1 5/0 기록과 P6 CI 게이트가 근거 |
| 2 보안·결함 | PASS | gateway `GatewayRouteConfig` `product-service-write`(sellerConfig) · `order-admin` · `OrderStatsController` `/api/v1/admin/orders/stats` · `search/batch/.../ProductApiClient` `/internal/products/bulk` + `k8s/base/network-policy/04-allow-backend-to-backend.yaml` · `InventoryJpaRepository` `PESSIMISTIC_WRITE` · product `InventoryStockSyncConsumer`(confirmed·restocked) · order에 `WebClient`·`PRODUCT_SERVICE_URL` 없음 | 운영 AC 「ROLE_USER 토큰 PUT 403」은 무토큰 401로만 확인. 403은 `GatewayRouteAuthSpec`·`ProductControllerAuthTest`가 커버 |
| 3 seller 도메인 | PASS | `settings.gradle.kts` `seller:domain/feature` · `CommerceApplication.scanBasePackages` `com.kgd.seller` · `Seller.REJECTED_PII_RETENTION=30일` · `AesGcmAccountCipher` · `application.yml` `enc-key: ${SELLER_ACCOUNT_ENC_KEY}`(기본값 없음) · `k8s/base/commerce/deployment.yaml` secretKeyRef `seller-account-enc` · `seller_db`가 local `configmap-init.yaml`·prod `init-databases-job.yaml`에 있음 | prod-k8s의 `seller-account-enc` SealedSecret은 문서·매니페스트에 없다(oci-arm README에만 있음) |
| 4 역할 연동·상품 소유 | PASS | auth 서브모듈 `fe0f5f6` `SellerRoleEventConsumer` + `V2__create_processed_event.sql` · product `V20260924_002__add_seller_to_products.sql` · `ProductControllerSellerOwnershipTest` | auth 포인터 사고는 `8ce6d910`에서 복구됨(status.md) |
| 5 판매자 화면·방침 | PARTIAL | portal `App.tsx` `/shop/seller/{apply,products,claims,settlements}` · admin `App.tsx` `sellers` · `PrivacyPage.tsx` 판매자 정보·정산 기록 5년 | AC 「운영에서 신청→승인→상품 등록 1회」 미확인(status.md P1: OAuth 로그인 필요) |
| 6 payment | PASS | `payment:domain/feature` · `MockPgAdapter`/`MockPgScenario` · `TossPgConfig`(3초/5초, `paymentTossCircuitBreaker`) · `TossWebhookController` · `PaymentInquiryScheduler` · `PaymentReconciliationScheduler`(매일 05:10 KST) · gateway `payment-webhook-toss`(헤더 제거 + 레이트 리밋) | 운영 웹훅 404는 P2 배포에서 확인 |
| 7 promotion | PASS | `CouponDefinition` · `PointBalance` · `PromotionHold` · `PromotionCommandConsumer`(reserve/confirm/cancel/restore) · gateway `promotion-user`/`promotion-admin` | |
| 8 읽기 모델·장바구니·주문서·금액 | **PARTIAL** | `OrderReadModelConsumer` · `Allocation` · `OrderSheet` · `CartController` · `PlaceOrderRequest(orderSheetId)`만 받음(가격 필드 없음) · order `V20260924_002__add_order_items_unit_price_won.sql` | **8.3 「product `price` 동일」 미구현**: `ProductJpaEntity.price: BigDecimal`, `productdb V1` `price DECIMAL(19,2)`, `price_won` 마이그레이션 없음. open-questions에도 없다 |
| 9 장바구니·주문서 화면 | PASS | `pages/shop/CartPage.tsx` · `OrderSheetPage.tsx` · 라우트 `/shop/cart`·`/shop/order-sheet/:id` · CDP `verifications/tg9/` | 운영 주문서 1건: status.md P4(주문서 id 1) |
| 10 명령 핸들러 | PASS | `InventoryCommandService`/`InventoryCommandConsumer` · `FulfillmentCommandService` · `LegacyReservationConversionService` + `LegacyReservationConversionLifecycle` · 옛 `onOrderCompleted`/`onOrderCancelled`/`onFulfillmentShipped`/`onStockReserved`/`onReservationExpired` 전부 없음(남은 `onFulfillmentCancelled`는 새 클레임 핸들러) | |
| 11 사가·상태·멱등 키 | PASS | `OrderSaga`(domain) · `OrderSagaCoordinator` · `IdempotencyKey*` · `V20260924_005__order_saga_and_status.sql` · `OrderRequestSupport` `TOO_MANY_PENDING_ORDERS→429` · `WebClientConfig`/`PaymentAdapter`/`ProductAdapter` 삭제됨 · 토픽 `order.order.completed` 미선언(strimzi 0) | |
| 12 사가 E2E·결제 대기 화면 | PASS | `commerce/app/.../OrderSagaE2ETest.kt`(status.md 14/0) · `OrderWaitingPage.tsx` · 운영 주문 1 FULFILLING/사가 COMPLETED(status.md 핫픽스 배포) | E2E는 이번에 재실행 못 함 |
| 13 클레임·구매 확정 | PARTIAL | `ClaimCoordinator` · `PurchaseConfirmService`(`order.purchase-confirm-days:7`) · `V20260924_007__claims_and_purchase_confirm.sql` · gateway `claim` · `OrderClaimPanel.tsx`·`SellerClaimsPage.tsx` · `ClaimE2ETest` | AC 「운영 **부분** 취소 1건」 대신 운영에서는 **전체** 취소 1건만 확인(주문 1). 부분 취소는 E2E만 |
| 14 settlement | PARTIAL | `Journal`(차=대 강제) · `LedgerService` · `SettlementBatchService` + `SettlementBatchScheduler`(05:30 KST) · `SettlementEventConsumer`(confirmed·refunded·settled·purchase-confirmed) · `SettlementE2ETest` · `SellerSettlementsPage.tsx`, admin `settlements` | AC 「운영 정산서 1건」 미확인. P6에서 운영에 생긴 것은 분개 2건뿐이다(주문 1이 전액 환불돼 정산 대상 라인 없음) |
| 15 운영 이슈·DLT·추적 | **PARTIAL** | `*DltConsumer` 7개(order·inventory·fulfillment·product·payment·promotion·settlement) · `*OpsIssueAdminController` 8개 · `common/ops/DltOpsIssues.kt` · `OrderSagaMetrics`/`PaymentOpsMetrics`/`SettlementOpsMetrics` · brave 트레이싱 의존 · admin `api/opsIssues.ts` 8도메인 · `DltOpsIssueIntegrationSpec`·`TracingPropagationIntegrationSpec` | **`e93403f5`의 images·ci run이 둘 다 cancelled다.** 운영 commerce는 `990d7a1`(P6)에 머물러 있고, TG15 코드는 CI 테스트 게이트를 통과한 적이 없다. AC 「운영 큐에서 DLT 1건 재발행」 미확인. seller는 DLT 컨슈머가 없다(Q23에 기록됨) |
| 16 문서·CI | PASS | ADR-0099 `상태: 채택` · 4도메인 `CLAUDE.md`/`glossary.md` · strimzi `kafka-topics.yaml`에 새 토픽 선언, `order.order.completed` 없음 · `scripts/ci/topology.sh`의 commerce 테스트 목록에 4도메인 domain·feature 포함(ci.yml은 이를 source) · `verifications/regression-injection.md` · `doc_map.py --check` → `doc-index clean.` | AC 「컨텍스트 로드 10도메인 행 쓰기·읽기」: `CommerceContextLoadSpec`의 Then 블록은 seller·order(+inventory 예약)·payment·promotion·settlement·product·deal을 쓰고 읽는다. fulfillment·warehouse 행 쓰기는 이 spec에 없고 E2E가 커버 |

UNVERIFIED(근거 없는 `[x]`)는 없다. 위의 PARTIAL은 코드가 없거나 운영 AC가 확인되지 않은 경우다.

## Test Suite
Docker Desktop이 꺼져 있다(`docker info` 실패). 따라서 `commerce:app` 스펙과 auth `SellerRoleEventConsumerIntegrationSpec`은 돌리지 않았다.

```
$ ./gradlew verifyArchitecture :common:cleanTest :common:test :gateway:cleanTest :gateway:test \
    :{order,inventory,fulfillment,product,seller,payment,promotion,settlement}:{domain,feature}:{cleanTest,test} --continue
BUILD SUCCESSFUL in 1m 14s   (verifyArchitecture 실행, 18개 test 태스크 전부 재실행 — UP-TO-DATE 없음)
```
JUnit XML 집계:
```
common 111 · gateway 90 · order/domain 91 · order/feature 92 · inventory/domain 17 · inventory/feature 36
fulfillment/domain 37 · fulfillment/feature 18 · product/domain 10 · product/feature 39
seller/domain 30 · seller/feature 31 · payment/domain 72 · payment/feature 24
promotion/domain 33 · promotion/feature 25 · settlement/domain 28 · settlement/feature 17
TOTAL tests=801 failures=0 errors=0 skipped=0 passed=801
```

```
$ (cd portal-fe && npx tsc -b --force)        → EXIT=0 (tsconfig.app.json 참조, src 244개 파일)
$ (cd admin/frontend && npx tsc -b --force)   → EXIT=0
$ (cd admin/frontend && npx vitest run)       → Test Files  8 passed (8) · Tests  28 passed (28)
$ (cd portal-fe && npx vitest run)            → Test Files  3 failed | 52 passed (55) · Tests  17 failed | 470 passed (487)
$ (cd portal-fe && npx vitest run src)        → Test Files  52 passed (52) · Tests  469 passed (469)
```
portal-fe 전체 실행의 실패 17건은 전부 `tests/games/*`(marbleDeterminism·relayClient·rosterHandoff)다. 원인은 `ENOENT …/portal-fe/public/games/...`이다. 이 worktree에서 `portal-fe/public/games` 서브모듈이 초기화되지 않았기 때문이고(`git submodule status`가 `-c101…`로 표시), 이번 스펙과 무관하다.

### commerce:app 통합·E2E — 로컬 재실행 불가, 기존 증거만
- **로컬 기록**(status.md): TG15 전체 실행 `DltOpsIssueIntegrationSpec 4/0 · TracingPropagationIntegrationSpec 3/0 · ClaimE2E 3/0 · OrderSagaE2E 14/0 · SettlementE2E 2/0`, 건너뜀 0. TG16 `:commerce:app:check`는 Gradle이 UP-TO-DATE로 판정했다(regression-injection.md에 적혀 있음).
- **CI 테스트 게이트**:
  - `990d7a18`(P6) images run 36005558451: `:commerce:app:test`를 포함한 test 단계 `BUILD SUCCESSFUL in 18m 33s`. TG14까지의 코드가 여기서 검증됐다.
  - `e93403f5`(TG15): images run 36012780914 **cancelled**, ci run 36012781099 **cancelled**.
  - `8ce6d910`: images 게이트가 `:auth:app:test`만 돌렸다.
  - `cbe3ce98`: images run 36018414847은 이 보고서 작성 시점(15:18 UTC)에 `in_progress`로 서브모듈 init 단계에 있다. ci run 36018414800은 **cancelled**다. 뒤따르는 `d8926d8d` run(pending)이 동시성 설정으로 이 run을 취소할 수 있다.
  - **결론: 부모가 말한 「cbe3ce98 CI 테스트 게이트」 결과는 아직 없다.** TG15 코드가 CI에서 검증된 기록도 없다.

## Failed Tests
- 이번 스펙 범위: 없음.
- 범위 밖: portal-fe `tests/games/*` 17건. games 서브모듈이 없는 worktree 환경 문제다.

## AC / SR Coverage (spec ↔ code)
- SR-0: 가격 필드 제거(`PlaceOrderRequest`), 상품 쓰기 권한, `/internal/products/bulk`, stats 어드민 이동, 읽기 모델 전환, product 아웃박스, 원문 JSON, 예약 원자성·순서 잠금, `inventory.stock.*`, 토스 3/5초 — 모두 구현.
- SR-1: 은퇴 리스너가 코드에서 사라졌고 `RetiredChoreographyCommandIntegrationSpec`이 이를 확인한다.
- SR-2·SR-4: 사가·멱등 키·429·0원 경로·보류 만료 (a)(b)를 E2E가 커버. 사가 표에 COMPENSATING↔STUCK 전이가 추가됐는데, spec 반영 여부는 **Q18**에 열려 있다.
- SR-5·SR-6·SR-7·SR-8·SR-9: 구현과 테스트가 있다. 운영 AC 차이는 위 표에 적었다.
- SR-10:
  - 지표 6종 전부 있다: `commerce_saga_active`/`step_dwell`/`compensations`, `commerce_payment_unknown`, `commerce_reconciliation_mismatch`, `commerce_settlement_payout_won`, outbox.
  - seller DLT 원천이 없다(Q23).
  - settlement는 아웃박스가 없다(Q22).
- SR-11: SR-11 표의 경로가 모두 게이트웨이 라우트에 있고, `GroupedOpenApi`가 8도메인, `openApiServices`에 4도메인이 등록돼 있다.
- SR-12: strimzi에 새 토픽 선언, 코드의 발행·구독 쌍 확인(`order.line.purchase-confirmed`, `promotion.command.restore`, `fulfillment.order.cancel-rejected`, `seller.seller.*`, `payment.reconciliation.settled`, `order.claim.refunded`).
- **SR-13 차이**:
  1. product `price` → 원 단위 확장 컬럼이 없다(TG8 8.3과 같은 결함).
  2. `order_items.unit_price` 옛 컬럼 삭제(축소 단계) 마이그레이션이 없다. 확장 단계에서 멈춘 상태이고, 이 사실이 open-questions에 기록돼 있지 않다.
- SR-14:
  - 판매자 Secret 기본값 없음 — OK.
  - 토스 키 `${TOSS_SECRET_KEY}`/`${TOSS_WEBHOOK_SECRET}` 기본값 없음 — OK.
  - 방침 문구 — OK.
  - CI 게이트는 topology.sh를 거친다 — OK.
  - 「단계 배포마다 commerce 메모리 실측」은 P0 기록(455MiB)만 있다.
  - prod-k8s SealedSecret에 `seller-account-enc`가 없다.

## Open Questions (context/open-questions.yml, 23건 중 open 22)
**높음 (운영 위험·데이터 무결성)**
- Q20: 판매자가 소유와 무관하게 `/api/inventories`·`/api/warehouses`·`/api/fulfillments`를 조작할 수 있다. 판매자 역할이 생긴 지금 실제 위험이다.
- Q19: 운영 스키마에 Hibernate가 만든 MySQL ENUM 컬럼이 11개 남아 있다(product 등). 상태를 추가하면 운영에서만 INSERT가 잘린다. 이미 주문 500 사고를 한 번 냈다.
- Q3: 전역 `@ControllerAdvice` 두 개(HIGHEST_PRECEDENCE)가 commerce 전 컨트롤러의 BusinessException을 서로 가로챈다.
- Q18: 결제 대기 3건 상한이 잠금 없는 카운트다(동시 요청 시 4건 가능). 같은 Idempotency-Key에 본문이 달라도 저장 응답을 재생한다. 사가 전이 표와 spec이 어긋난다.
- Q23: 운영에 이미 쌓인 `-dlt` 레코드는 새 DLT 리스너가 보지 않는다. 비샘플 traceId 전파가 검증되지 않았다.

**중간 (기능 결손·정합성)**
- Q9: 늦게 도착한 approved 이벤트가 ROLE_SELLER를 다시 붙일 수 있다.
- Q13·Q1: 토스 자동 매입과 사가 AUTHORIZED 계약이 어긋나고, 웹훅 서명이 없다. 운영 활성화는 보류 중이다.
- Q14: 대사가 KST 자정 경계에서 가짜 불일치를 낼 수 있다.
- Q17: 이행 라인을 productId로 식별한다(같은 상품 라인이 둘이면 충돌).
- Q21: 배송비 정산 경계 이벤트, 클레임 STUCK 재개 API가 없다.
- Q22: settlement 아웃박스·역분개 API가 없고, PG 입금 뒤 환불하면 PG 미수금이 음수가 된다.
- Q6: 기존 4도메인 Hikari 풀 크기 설정이 적용되지 않고 런타임에 10이다(메모리 예산에 영향).
- Q16: `@EnableKafka`가 inventory `KafkaConfig`에 있다.
- Q5: quant `/api/v1/orders` 경로 충돌.

**낮음 (UI·정리)**
- Q4: admin FE가 부르는 DELETE/PATCH의 백엔드가 없다.
- Q7: 게이트웨이에서 ROLE_ADMIN이 판매자 경로를 통과한다.
- Q8: 반려 판매자 상호를 보관한다.
- Q10: 어드민 상품의 소유자 결정.
- Q11: 배지 대비.
- Q12: 판매 중지 상품이 판매자 목록에 안 보인다.
- Q15: 판매자 표시명.

## Follow-ups
1. **TG15를 CI에 통과시키고 배포하기.** `cbe3ce98`(또는 이후) images run의 test 단계에서 `:commerce:app:test`가 `BUILD SUCCESSFUL`인지 확인하고, commerce 이미지가 `990d7a1` 이후 태그로 롤아웃됐는지 본다. 그 뒤 운영 큐에서 DLT 1건 재발행(TG15 AC)을 확인한다.
2. **product `price` 원 단위 전환**(SR-13·TG8 8.3): 확장 컬럼과 백필을 추가하거나, 범위에서 뺀다면 open-questions에 기록하고 tasks.md 8.3 표기를 바로잡는다.
3. `order_items.unit_price` 축소 마이그레이션의 시점을 결정하고 기록한다.
4. 운영 AC 보강: 부분 취소 1건(P5), 확정 라인이 있는 정산서 1건(P6), 판매자 신청→승인→상품 등록 한 바퀴(P1), ROLE_USER 토큰 상품 쓰기 403(P0).
5. prod-k8s 오버레이에 `seller-account-enc` SealedSecret 절차를 추가한다(`k8s/infra/prod/sealed-secrets/README.md`).
6. Q20·Q19를 이 스펙의 후속 스펙 후보로 올린다.
7. Docker 복구 후 로컬에서 `./gradlew :commerce:app:test`와 `:auth:app:test --tests '*SellerRole*'`를 다시 돌려 건너뜀 0을 확인한다.
8. roadmap: `docs/product/roadmap.md` 파일이 없다 — 완료 표시할 곳 없음.
