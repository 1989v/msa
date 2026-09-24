package com.kgd.payment.application.payment.usecase

/**
 * 결과를 모르는 결제(READY·UNKNOWN)를 PG 재조회로 결론 낸다. 상태·금액은 항상 **재조회 결과**로 정한다 —
 * 웹훅 본문은 "다시 물어볼 때가 됐다"는 신호로만 쓴다.
 */
interface ResolvePaymentUseCase {
    /** 재조회 시각이 된 결제를 처리하고 건수를 돌려준다 */
    fun resolveDue(): Int

    /** 웹훅 — 이 주문번호를 지금 재조회한다. 이미 결론 난 결제는 PG 를 부르지 않고 그대로 둔다 */
    fun resolveByOrderNo(orderNo: String): ResolveOutcome

    enum class ResolveOutcome { RESOLVED, STILL_PENDING, ALREADY_RESOLVED, NOT_FOUND }
}
