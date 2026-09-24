# Payment — Domain Glossary

## 1. Bounded Context Overview

Payment BC 는 **PG 와 주고받은 결제 사실의 권위**다. 주문 사가는 명령을 보내고 결과 이벤트로 결제 상태의 사본을 갖는다.
PG 대사 결과는 settlement 가 원장(PG 입금)으로 받는다.

## 2. 용어

| 용어 | 뜻 | 코드 이름 |
|---|---|---|
| 결제 | 가맹점 주문번호 하나에 대한 PG 거래 한 건과 그 상태 | `Payment` |
| 가맹점 주문번호 | 결제 시도 id. PG 멱등 키로 쓰고 PG 에는 `orderId` 로 보낸다 | `orderNo` |
| PG 거래 키 | PG 가 준 거래 식별자. 취소·환불에 쓴다 | `paymentKey` |
| 승인 | PG 가 결제를 받아들임. 모의 PG 는 서버 승인, 토스는 승인 확인(confirm) | `authorize` · `confirm` |
| 매입 | 승인된 금액을 확정해 청구함 | `capture` |
| 승인 취소 | 매입 전 승인 취소 | `void` · `VOIDED` |
| 환불 | 매입 뒤 전액·부분 돌려줌. 합은 매입액 이하 | `PaymentRefund` · `refund` |
| 환불 키 | 환불 명령의 멱등 키 | `refundKey` |
| 결과 미상 | 타임아웃·5xx 로 PG 가 승인했는지 모르는 상태 | `UNKNOWN` |
| 재조회 | 결과 미상 결제를 PG 에 다시 물어 결론 내는 것 | `inquire` · `ResolvePaymentUseCase` |
| VOID 보류 | 결과 미상 중 들어온 취소 명령. 승인으로 결론 나면 그때 실행 | `voidRequestedAt` · `pendingVoidDue` |
| 모의 PG | 실제 PG 대신 쓰는 결정적 구현. 운영에서는 항상 승인 | `MockPgAdapter` |
| 정산 파일 | PG 가 주는 정산일별 거래 목록(총액·PG 수수료·입금액) | `PgSettlementLine` |
| PG 대사 | 정산 파일과 결제 행을 건별로 맞춰 보는 일 | `ReconcilePaymentsUseCase` |
| 운영 이슈 | 사람이 봐야 하는 건 — 재조회 소진(`PAYMENT_UNKNOWN`) · 대사 불일치(`RECON_MISMATCH`) | `OpsIssue` |
