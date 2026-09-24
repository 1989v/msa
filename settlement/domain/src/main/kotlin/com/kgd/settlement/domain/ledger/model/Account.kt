package com.kgd.settlement.domain.ledger.model

/**
 * 원장 계정 — 스펙 SR-9 의 여섯 개만 쓴다. 코드에는 영문 코드가 저장되고 화면에는 [displayName] 을 보인다.
 * 코드 이름을 바꾸면 저장된 분개 행이 읽히지 않는다(추가만 한다).
 */
enum class Account(val displayName: String) {
    PG_RECEIVABLE("PG 미수금"),
    SELLER_PAYABLE("판매자 미지급금"),
    COMMISSION_REVENUE("수수료 수익"),
    PG_FEE_EXPENSE("PG 수수료 비용"),
    CASH("현금"),

    /** 플랫폼 부담 할인·포인트 */
    PROMOTION_EXPENSE("판촉 비용"),
}

enum class EntrySide {
    DEBIT,
    CREDIT;

    fun opposite(): EntrySide = if (this == DEBIT) CREDIT else DEBIT
}

enum class JournalType {
    /** 매입 — `order.order.confirmed` */
    CAPTURE,

    /** 환불 — `order.claim.refunded` */
    REFUND,

    /** PG 입금 — `payment.reconciliation.settled` */
    PG_DEPOSIT,

    /** 판매자 지급 — 정산 배치 */
    PAYOUT,

    /** 정정 — 원 거래의 역분개. 원장은 고치지 않고 이것으로만 되돌린다 */
    REVERSAL,
}
