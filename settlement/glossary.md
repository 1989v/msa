# Settlement — Domain Glossary

## 1. Bounded Context Overview

Settlement BC 는 **돈이 어디에 얼마 있는가의 권위**다. 주문(매입·환불)·결제(PG 입금)·판매자(주기) 이벤트를 원장 거래로 옮기고,
구매 확정된 판매분을 판매자·기간별 정산서로 묶어 지급한다. 다른 스키마를 읽지 않는다 — 판매자·안분·수수료는 order 이벤트가 싣고 온다.

## 2. 용어

| 용어 | 뜻 | 코드 이름 |
|---|---|---|
| 원장 | 거래와 분개의 기록. 추가만 하고 고치지 않는다 | `ledger_journal` · `ledger_entry` |
| 거래 | 원천 하나(주문 매입·클레임 환불·대사 건·정산서 지급)가 원장에 남긴 한 건. 차변 합 = 대변 합 | `Journal` |
| 분개 | 거래의 차변·대변 한 줄 | `JournalEntry` |
| 역분개 | 원 거래의 차·대를 뒤집은 정정 거래 | `Journal.reverse` · `REVERSAL` |
| 원천 키 | 원천의 자연 키 — 같은 원천은 원장에 한 번만 | `sourceKey` |
| 분개 규칙 | 시점별 차·대 계정과 금액(스펙 SR-9 표) | `JournalRules` |
| PG 미수금 | PG 가 아직 보내지 않은 결제 대금 | `PG_RECEIVABLE` |
| 판매자 미지급금 | 판매자에게 아직 지급하지 않은 판매 대금 | `SELLER_PAYABLE` |
| 수수료 수익 | 플랫폼이 판매자 순매출에서 받는 수수료 | `COMMISSION_REVENUE` |
| PG 수수료 비용 | PG 가 입금에서 뗀 수수료 | `PG_FEE_EXPENSE` |
| 현금 | 플랫폼 계좌에 들어오고 나간 돈 | `CASH` |
| 판촉 비용 | 플랫폼 부담 쿠폰·포인트 | `PROMOTION_EXPENSE` |
| 순매출 | 판매가 × 수량 − 판매자 부담 쿠폰 안분 | `netSales` |
| 정산 대상 | 구매 확정 라인과 그 판매자의 배송비 | `SettlementItem` (`LINE` · `SHIPPING`) |
| 정산서 | 판매자·기간별 지급 계산 결과 | `SettlementStatement` |
| 지급액 | Σ순매출 + Σ배송비 − Σ수수료 | `payout` |
| 정산 주기 | 주간(월~일) · 월간(달력 월), KST | `SettlementCycle` · `SettlementPeriod` |
| 이월 | 지급액 ≤ 0 인 정산서 — 항목은 다음 기간으로 | `CARRIED_OVER` |
| 모의 지급 | 계좌 없이 판매자 id·정산서로 송금 기록만 남김 | `PayoutPort` · `MockPayoutAdapter` |
| 시산표 | 계정별 차 − 대. 전체 합은 0 | `TrialBalance` |
