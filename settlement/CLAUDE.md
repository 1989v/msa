# Settlement Service

원장·정산 — 복식부기 원장(거래·분개)과 판매자 정산서(순매출·배송비·수수료·지급액), 모의 지급. `commerce:app` 에 폴드된 라이브러리 (ADR-0099).
order·payment·seller 이벤트를 받기만 하고 **발행하는 토픽이 없다**(아웃박스 없음, DLT 발행용 String 프로듀서만). 다른 스키마를 읽지 않는다.

## Modules

| Gradle path | 역할 |
|---|---|
| `:settlement:domain` | Pure Kotlin 도메인 — `Journal`(차 = 대 강제·역분개) · `JournalRules`(분개 규칙 표) · `SettlementStatement`(지급액·전이) · `SettlementCycle`(KST 기간) · `SettlementItem` · `SettlementSeller` |
| `:settlement:feature` | 비-bootable 라이브러리 — 전용 datasource `settlement_db` (`settlementEntityManagerFactory` / `settlementTransactionManager`, Hikari 최대 3), Flyway `settlementdb/migration` + `ScopedFlywayMigrator` |

## Commands

```bash
./gradlew :settlement:domain:test                                  # 차·대 불일치 예외 · 역분개 · 분개 규칙 네 시점 · 지급액 식 · 환불 제외 · 이월 · KST 기간
./gradlew :settlement:feature:test                                 # 원장 멱등 · 배치(PAID·이월·재시도) · API 권한 · 수신 계약
./gradlew :commerce:app:test --tests '*CommerceContextLoad*'       # settlement_db 행 쓰기·읽기 + Flyway ↔ 엔티티 validate
./gradlew :commerce:app:test --tests '*SettlementE2E*'             # 주문 → 부분 취소 → 구매 확정 → 대사 → 배치 PAID, 시산표 0
```

## 구조 상태 (ADR-0083)

`inventory/feature` 견본을 따른다. 비-@Primary 도메인이라 **모든 `@Transactional` 이 `settlementTransactionManager` 를 한정자로 갖는다**.
모의 송금은 트랜잭션 밖 — `SettlementBatchService`(흐름)가 `StatementTransactionalService.open`·`markPaid`(짧은 트랜잭션) 사이에서 부른다.

- `application/ledger` — RecordLedger(매입·환불·PG 입금) · GetTrialBalance(시산표)
- `application/statement` — RegisterSettlementItem(구매 확정) · RunSettlementBatch · RetryPayout · GetStatements
- `application/seller` — SyncSettlementSeller(`seller.seller.*` 읽기 모델)
- `infrastructure/messaging` — `SettlementEventConsumer`(그룹 `settlement-ledger`) · `infrastructure/payout` — `MockPayoutAdapter` · `infrastructure/scheduler` — 배치

## Key Rules

- **계정(이 여섯만)**: `PG_RECEIVABLE` PG 미수금 · `SELLER_PAYABLE` 판매자 미지급금 · `COMMISSION_REVENUE` 수수료 수익 ·
  `PG_FEE_EXPENSE` PG 수수료 비용 · `CASH` 현금 · `PROMOTION_EXPENSE` 판촉 비용. 코드는 영문, 화면은 한글(`Account.displayName`).
- **분개 규칙** (N 순매출 · S 배송비 · C 수수료 · Dp 플랫폼 쿠폰 · P 포인트 · X = N+S−Dp−P):
  | 시점 · 원천 | 차변 | 대변 |
  |---|---|---|
  | 매입 `order.order.confirmed` | PG 미수금 X · 판촉 비용 Dp+P | 판매자 미지급금 N+S−C (판매자별) · 수수료 수익 C |
  | 환불 `order.claim.refunded` | 판매자 미지급금 n+s−c · 수수료 수익 c | PG 미수금 n+s−dp−p · 판촉 비용 dp+p |
  | PG 입금 `payment.reconciliation.settled` | 현금 입금액 · PG 수수료 비용 | PG 미수금 입금액+수수료 |
  | 지급 (정산 배치) | 판매자 미지급금 지급액 | 현금 지급액 |
  이벤트의 결제액·환불액이 라인에서 다시 계산한 값과 다르면 기록하지 않는다(→ DLT).
- **원장**: 차변 합 = 대변 합을 도메인이 강제(`UnbalancedJournalException`). 저장소 포트는 추가·조회뿐, 엔티티는 `@Immutable`. 정정은 역분개(`Journal.reverse`).
  멱등 = 원천 자연 키 `source_key` 유니크(`capture:order:{id}` · `refund:claim:{id}` · `pg-deposit:{date}:{orderNo}` · `payout:statement:{id}` · `reversal:journal:{id}`) + `processed_event`.
- **역분개(어드민 정정)**: 거래당 하나 — 원천 키가 원 거래 id 라 두 번째 요청은 기존 역분개를 돌려준다. 행위자·사유는 역분개 거래 행(`actor_id`·`reason`)에 남는다(감사).
  역분개 거래는 다시 역분개하지 않는다(원 거래를 새로 기록). 정산서·정산 항목은 건드리지 않는다 — 원장만 고친다.
- **PG 미수금 음수 수용**: PG 입금(`payment.reconciliation.settled`) 뒤에 환불이 오면 PG 미수금이 음수가 된다. 오류가 아니라
  「PG 에 돌려받을 돈」이다(PG 가 다음 입금에서 상계). 시산표 합은 여전히 0 이고, 막거나 보정 거래를 만들지 않는다.
- **정산 대상**: `order.line.purchase-confirmed` 의 라인(`line:{orderItemId}`)과 배송비(`shipping:{orderId}:{sellerId}`)뿐.
  `order.claim.refunded` 의 라인·배송비 키는 `settlement_refunded_item` 에 남고 정산서가 거른다(토픽이 달라 순서가 어긋나도 이중 차감 없음).
- **지급액** = Σ라인 순매출 + Σ배송비 − Σ수수료 = 지급 거래가 줄이는 판매자 미지급금.
- **배치**: 매일 05:30 KST. 정산 대상이 남은 판매자마다 주기(주간 월~일 · 월간 달력 월, KST)가 닫힌 가장 최근 기간의 정산서.
  (판매자, 기간 시작) 유니크. 기간 끝 전 확정분을 모두 담는다(이월·지각 항목 포함). 판매자 이벤트가 없는 판매자는 월간.
- **정산서 상태**: DRAFT → CONFIRMED → PAID · CONFIRMED → CARRIED_OVER(지급액 ≤ 0, 항목은 묶지 않아 다음 기간으로) ·
  CONFIRMED → PLATFORM_RETAINED(플랫폼 판매자 1 — 아래).
- **플랫폼 판매자(1) 지급 제외**: 어드민이 등록한 상품의 판매자라 그 매출은 플랫폼 자기 매출이다. 정산서는 감사용으로 만들고 항목을 묶되
  `PLATFORM_RETAINED` 로 닫는다 — 송금·지급 거래가 없다(`SettlementStatement.pay` 가 판매자 1 을 거부). 그래서 원장의 판매자 1
  미지급금 잔액은 줄지 않고 플랫폼 자기 매출 누계로 남는다(시산표에서 판매자 1 줄은 부채가 아니라 그렇게 읽는다).
- **실제 포함 범위**: 정산서는 기간 끝 전 확정분을 모두 담으므로 이월·지각 항목이 명목 기간보다 앞설 수 있다. 응답의
  `includedFrom`·`includedTo`(담긴 항목의 최소~최대 확정 시각)를 판매자·어드민 화면이 명목 기간과 함께 보인다.
  송금 실패로 CONFIRMED 에 남으면 다음 배치 또는 어드민 재시도가 끝낸다(송금 참조가 정산서마다 같다).
- **모의 지급**: 계좌를 복호화하지 않는다 — 판매자 id 와 정산서로 참조(`MOCK-PAYOUT-{sellerId}-{statementId}`)만 남긴다.
- **보존**: 정산 기록 5년(`SettlementStatement.RECORD_RETENTION`, 전자상거래법). 방침 6항과 같은 숫자 — portal-fe `privacyRetention.test.ts` 가 대조.

## API

| 경로 | 인증 | 비고 |
|---|---|---|
| `GET /api/v1/seller/settlements` · `/{id}` | ROLE_SELLER | 매 요청 X-User-Id → ACTIVE 판매자 행(아니면 403), 남의 정산서 404 |
| `GET /api/v1/admin/settlements/statements` · `/{id}` | ROLE_ADMIN | status·sellerId 필터, 최근 200건 |
| `POST /api/v1/admin/settlements/statements/{id}/retry-payout` | ROLE_ADMIN | CONFIRMED 만, 그 밖 409 |
| `POST /api/v1/admin/settlements/batch/run` | ROLE_ADMIN | 오늘 날짜로 배치 — 닫힌 기간만 |
| `GET /api/v1/admin/settlements/ledger/trial-balance` | ROLE_ADMIN | 계정별 차·대·잔액 + 판매자별 미지급금, `net` = 0 이어야 한다 |
| `POST /api/v1/admin/settlements/ledger/journals/{id}/reverse` `{reason}` | ROLE_ADMIN | 역분개 거래 생성(거래당 하나, 재요청은 기존 것). 사유 없음 400 · 없는 거래 404 · 역분개 거래를 다시 400 |
| `/api/v1/admin/settlements/ops-issues` | ROLE_ADMIN | 운영 이슈 조회·재시도·종결. 수신 계약 위반(금액 불일치 등)은 `<원 토픽>.DLT` → `settlement-dlt-ops` 가 적재, 재시도 = 원 토픽 재발행 |

지표: 게이지 `commerce_settlement_payout_won{status=PAID|CONFIRMED}` — 정산서 지급액 합(PAID = 지급 끝, CONFIRMED = 송금 대기).

## 운영 DB

`settlement_db` 는 order 와 같은 MySQL 인스턴스(`mysql-order-master`)에 스키마만 분리한다. 운영 MySQL 은 init 이 재실행되지 않으므로
배포 전 `oci-mysql` 로 스키마·계정을 만든다(ADR-0099). 판매자 읽기 모델(`settlement_seller`)은 이벤트로만 채워지므로,
이 도메인보다 먼저 승인된 판매자는 Kafka 보존기간이 지났으면 한 번 옮겨 담아야 한다 — 두 스키마가 같은 인스턴스라 SQL 한 줄이다
(`updated_at` 을 발생 시각으로 넣어, 뒤에 오는 실제 이벤트가 이긴다):

```sql
INSERT IGNORE INTO settlement_db.settlement_seller (seller_id, member_id, status, settlement_cycle, occurred_at)
SELECT id, member_id, status, settlement_cycle, updated_at FROM seller_db.seller WHERE status IN ('ACTIVE', 'SUSPENDED');
```
