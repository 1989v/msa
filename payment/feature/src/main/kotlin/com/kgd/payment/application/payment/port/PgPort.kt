package com.kgd.payment.application.payment.port

/**
 * PG 경계. 구현은 둘이다 — 모의 PG(기본, `payment.pg=mock` 또는 미설정) · 토스(`payment.pg=toss`).
 *
 * - 모의 PG 는 서버가 [authorize] 로 승인을 요청한다.
 * - 토스는 FE 결제창 인증 뒤 토스가 준 paymentKey 로 서버가 [confirm] 한다.
 *
 * 둘 다 가맹점 주문번호 `orderNo`(= 결제 시도 id)를 멱등 키로 쓴다. 승인 계열은 예외를 던지지 않고
 * [PgResult] 로 답한다 — 타임아웃·5xx 는 [PgResult.Unknown] 이다(승인됐는지 모른다).
 * 매입·취소·환불은 실패하면 [PgCallException] 을 던진다(명령 재시도로 넘긴다).
 */
interface PgPort {
    fun authorize(orderNo: String, amount: Long): PgResult
    fun confirm(paymentKey: String, orderNo: String, amount: Long): PgResult
    fun capture(paymentKey: String, amount: Long)
    fun void(paymentKey: String, amount: Long)
    fun refund(paymentKey: String, amount: Long, refundKey: String, reason: String?)
    fun inquire(orderNo: String): PgInquiry
}

sealed interface PgResult {
    data class Approved(val paymentKey: String) : PgResult
    data class Declined(val reason: String) : PgResult
    data class Unknown(val reason: String) : PgResult
}

sealed interface PgInquiry {
    /** PG 가 승인했다. [amount] 는 PG 기준 금액 — 우리 행과 다르면 승인으로 받지 않는다 */
    data class Approved(val paymentKey: String, val amount: Long) : PgInquiry
    data class Declined(val reason: String) : PgInquiry

    /** PG 에 이 주문번호 거래가 없다 — 돈이 나가지 않았다 */
    data object NotFound : PgInquiry

    /** 아직 결론이 없거나 조회 자체가 실패했다 */
    data class Unavailable(val reason: String) : PgInquiry
}

/** 매입·취소·환불 호출 실패. [retryable] 이면 같은 명령을 다시 보내 볼 만하다(타임아웃·5xx) */
class PgCallException(message: String, val retryable: Boolean, cause: Throwable? = null) :
    RuntimeException(message, cause)
