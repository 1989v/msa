package com.kgd.payment.domain.payment.model

/** VOID 명령을 받았을 때 할 일 */
enum class VoidDecision {
    /** AUTHORIZED · 환불 없는 CAPTURED — 지금 PG 에 취소를 요청한다(매입된 결제는 전액 취소) */
    EXECUTE,

    /** READY·UNKNOWN — PG 를 부르지 않고 기억해 두었다가 AUTHORIZED 로 결론 나면 실행한다 */
    DEFERRED,

    /** 이미 VOIDED 또는 FAILED — 돌려줄 돈이 없다 */
    ALREADY_SETTLED,
}
