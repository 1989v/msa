# Payment Service

결제 — 모의 PG(기본)와 토스페이먼츠 어댑터, 결과 미상 재조회, PG 대사. `commerce:app` 에 폴드된 라이브러리 (ADR-0099).
주문 사가가 `payment.command.*` 로 명령하고 `payment.payment.*` 로 결과를 받는다.

**PCI: 카드번호·CVC 는 서버·DB·로그 어디에도 없다.** 카드 정보는 PG 결제창에서만 오가고 이 도메인은 PG 거래 키(`paymentKey`)까지만 다룬다 — PCI-DSS 범위 밖.

## Modules

| Gradle path | 역할 |
|---|---|
| `:payment:domain` | Pure Kotlin 도메인 — `Payment`(상태 머신·환불 합·VOID 보류·재조회 백오프), `PaymentRefund`, `OpsIssue`, `ReconciliationRecord` |
| `:payment:feature` | 비-bootable 라이브러리 — 전용 datasource `payment_db` (`paymentEntityManagerFactory` / `paymentTransactionManager`, Hikari 최대 3), Flyway `paymentdb/migration` + `ScopedFlywayMigrator` |

## Commands

```bash
./gradlew :payment:domain:test                                   # 전이표 전수·환불 합·VOID 보류·백오프
./gradlew :payment:feature:test                                  # 서비스(저장소 메모리·PG 목)·토스 MockWebServer·웹훅·운영 이슈
./gradlew :commerce:app:test --tests '*CommerceContextLoad*'     # payment_db 행 쓰기·읽기 + 모의 PG 승인 1회 + settled 행
./gradlew :commerce:app:test --tests '*PaymentPgSelection*'      # 기본 = 모의 PG(토스 빈 없음·웹훅 404) · toss 시크릿 키 없으면 기동 실패
```

## 구조 상태 (ADR-0083)

`inventory/feature` 견본을 따른다. 비-@Primary 도메인이라 **모든 `@Transactional` 이 `paymentTransactionManager` 를 한정자로 갖는다**.
PG 호출은 트랜잭션 밖 — `PaymentCommandService`·`PaymentResolutionService`(흐름) 가 `PaymentTransactionalService`(짧은 트랜잭션) 사이에서 부른다.

- `application/payment/usecase` — ProcessPaymentCommand(승인·매입·취소·환불) · ResolvePayment(재조회·웹훅) · ReconcilePayments(대사)
- `application/payment/port` — `PgPort` · `PgSettlementPort` · `PaymentRepositoryPort` · `PaymentRefundRepositoryPort` · `ReconciliationRepositoryPort` · `PaymentEventPort`
- `application/opsissue` — 운영 이슈 조회·재시도·종결
- `infrastructure/pg/mock` — 모의 PG(`MockPgAdapter`, 원장 `mock_pg_transaction`, `MockPgScenario`, `MockPgCallRecorder`)
- `infrastructure/pg/toss` — `TossPgAdapter` + `TossPgConfig`(`payment.pg=toss` 일 때만)
- `infrastructure/messaging` — 명령 컨슈머(`payment-service` 그룹) · 아웃박스 어댑터 · `infrastructure/scheduler` — 재조회 · 대사

## Key Rules

- **상태**: READY → AUTHORIZED | FAILED | UNKNOWN · UNKNOWN → AUTHORIZED | FAILED · AUTHORIZED → CAPTURED | VOIDED ·
  CAPTURED → PARTIALLY_REFUNDED | REFUNDED · PARTIALLY_REFUNDED → PARTIALLY_REFUNDED | REFUNDED. REFUNDED·VOIDED·FAILED 종착.
- **매입을 겸한 승인 (토스)**: PG 가 승인과 함께 매입하면(`PgResult.Approved.captured`, 재조회도 같다) 한 트랜잭션에서
  AUTHORIZED → CAPTURED 로 기록하고 `authorized` 뒤에 `captured` 를 낸다. 사가는 승인 단계에서 `authorized` 로 넘어가고 먼저 온
  `captured` 는 단계가 달라 버린다. 나중에 오는 매입 명령은 PG 를 부르지 않고 `captured` 로 다시 답한다(이미 매입된 결제의 매입 = 재답).
  모의 PG 흐름은 그대로다(승인 → 사가의 매입 명령 → PG 매입).
- **멱등**: 결제 한 건 = 가맹점 주문번호 `orderNo` 하나(유니크). 같은 orderNo 승인 명령은 행이 있으면 PG 를 부르지 않는다.
  환불은 `refundKey` 유니크. `processed_event` 원장은 그 위의 둘째 겹이다(마킹이 처리 뒤 별도 트랜잭션이라 첫째 겹이 필요).
- **결과 미상**: 타임아웃·5xx 는 UNKNOWN + `payment.payment.unknown`. 재조회 30초·1·2·4·2.5분(`next_inquiry_at`), 5회 미결이면
  운영 이슈 `PAYMENT_UNKNOWN` 1건을 남기고 멈춘다. PG 금액이 우리 행과 다르면 승인으로 받지 않는다(미결로 센다).
- **VOID 보류 (사가 보류 만료 규칙 b)**: READY·UNKNOWN 중 VOID 명령은 PG 를 부르지 않고 `void_requested_at` 만 남긴다.
  AUTHORIZED 로 결론 나면 그때 취소(VOIDED), FAILED 로 결론 나면 PG 취소 0회. VOID 가 남은 결제는 매입하지 않는다.
- **매입된 결제의 VOID = 전액 취소**: 환불이 없는 CAPTURED 에 VOID 가 오면(토스는 승인 확인이 곧 매입) PG 취소(토스 cancel, 금액 없음)
  후 REFUNDED(환불액 = 매입액, 환불 행 `void-{orderNo}`)로 끝내고 사가에는 `voided` 로 답한다. 같은 VOID 가 다시 오면 할 일 없음.
- **환불 합 ≤ 매입액** — 넘으면 PG 를 부르기 전에 거부.
- **PG 흐름**: 모의 PG 는 서버가 승인(`authorize`), 토스는 FE 결제창 인증 뒤 `paymentKey` 로 승인 확인(`confirm`). 명령에
  `paymentKey` 가 있으면 토스 흐름이다. 토스는 승인 확인이 곧 매입이라 DONE 을 `captured = true` 로 답하고, 어댑터의 매입은 HTTP 를 부르지 않는다.
- **이벤트**(아웃박스, 키 = orderId): `payment.payment.{authorized,failed,unknown,captured,voided,refunded}` —
  paymentId · orderId · orderNo · amount · paymentKey · status · reason · refundAmount · refundedAmount.
  `payment.reconciliation.settled` — date · orderId · orderNo · paymentKey · grossAmount · pgFee · depositAmount.
- **대사**: 매일 05:10 KST 전날 분. 정산 파일(모의 PG 원장, 수수료 2% 반올림) ↔ 그날 매입된 결제 행을 건별 대조 —
  거래 키·총액(매입 − 환불)이 같으면 settled, 아니면 운영 이슈 `RECON_MISMATCH`. (정산일, 주문번호)는 한 번만 판정.
- **매입 시각은 한 값**: 결제가 정한 매입 시각을 `PgPort.capture` 로 넘기고 PG 가 기록한 시각(재매입이면 처음 시각)을 돌려받아 결제 행에 쓴다.
  결제 행과 모의 PG 원장이 같은 `captured_at` 을 가지므로 KST 자정 직전 매입이 두 날짜로 갈라져 가짜 불일치가 나지 않는다.
- **운영 이슈** `/api/v1/admin/payments/ops-issues` (ROLE_ADMIN): 조회 · `POST /{id}/retry`(재조회를 처음부터 · 대사 다시) ·
  `POST /{id}/close`(사유 필수). 처리자가 남는다.
- **DLT**: 명령 컨슈머가 1초 간격 3회 재시도 뒤 `<원 토픽>.DLT` 로 보낸 레코드를 `payment-dlt-ops` 그룹이 받아 운영 이슈 `DLT` 로
  적재한다(원 컨슈머 그룹이 `payment-service` 인 것만). 이 이슈의 재시도는 원 토픽으로 재발행이다.
- **지표**: 게이지 `commerce_payment_unknown`(지금 UNKNOWN 인 결제 수) · `commerce_reconciliation_mismatch`(MISMATCH 대사 행 수).

## PG 선택 · 키

| `payment.pg` (`PAYMENT_PG`) | 빈 | 웹훅 경로 | 필요한 키 |
|---|---|---|---|
| `mock` (기본) | `MockPgAdapter` · `MockPgCallRecorder` · 대사 스케줄러 | 404 | 없음 |
| `toss` | `TossPgAdapter` · `paymentTossCircuitBreaker` · `TossWebhookController` | `/api/v1/payments/webhooks/toss` | `TOSS_SECRET_KEY` |

- 토스 키는 설정 파일에 기본값이 없다(`${TOSS_SECRET_KEY}` 만). toss 로 켰는데 없거나 비었으면 기동하지 않는다. mock 은 읽지 않는다.
- 토스 HTTP: 연결 3초·읽기 5초, 인증 Basic base64(`시크릿 키:`). 서킷은 4xx 를 실패로 세지 않는다.
- **웹훅은 재조회 신호일 뿐**: 토스 결제 상태 웹훅에는 서명이 없고 임의 헤더도 못 붙인다. 그래서 비밀 헤더를 두지 않고 본문·헤더를 믿지 않는다 —
  본문에서 `data.orderId` 하나만 읽어 **PG 를 재조회**하고 그 결과로만 전이한다. 이미 결론 난 결제·모르는 주문번호는 PG 를 부르지 않는다.
  공개 경로라 게이트웨이(`payment-webhook-toss`)가 신원 헤더를 벗기고 레이트 리밋을 건다.
- **토스 운영 활성화는 하지 않는다 (2026-09-25 결정)** — 운영(oci-arm)은 mock 이다. commerce 상시 파드에 외부 egress 가 없고(ADR-0031/0070)
  그 규칙을 유지한다. 켜려면 egress 예외 ADR + NetworkPolicy + 외부 호출 쿼터가 먼저다(ADR-0099 결과).
- 토스 정산 조회 API 는 붙이지 않았다 — toss 에서는 대사 스케줄러가 없다.

## 운영 DB

`payment_db` 는 order 와 같은 MySQL 인스턴스(`mysql-order-master`)에 스키마만 분리해 둔다. 운영 MySQL 은 init 이 재실행되지
않으므로 배포 전 `oci-mysql` 로 스키마·계정을 만든다(ADR-0099). `mock_pg_transaction` 은 모의 PG 쪽 원장이라
결제 행과 따로 있다 — 파드 재시작 뒤에도 재조회·정산 파일이 이어진다.
