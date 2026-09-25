package com.kgd.payment.domain.payment.model

import com.kgd.payment.domain.payment.exception.InvalidPaymentStateException
import com.kgd.payment.domain.payment.exception.RefundExceedsCapturedException
import java.time.Duration
import java.time.Instant

/**
 * 결제 한 건 = 가맹점 주문번호([orderNo]) 하나. 같은 [orderNo] 로는 PG 승인을 두 번 만들지 않는다.
 * [paymentKey] 는 PG 가 준 거래 키로, 승인 전에는 없다.
 *
 * 전이는 이 클래스의 메서드로만 일어난다. 금액은 원 단위 Long.
 */
class Payment private constructor(
    val id: Long?,
    val orderId: Long,
    val orderNo: String,
    val amount: Long,
    paymentKey: String?,
    status: PaymentStatus,
    capturedAmount: Long,
    refundedAmount: Long,
    voidRequestedAt: Instant?,
    failureReason: String?,
    inquiryAttempts: Int,
    nextInquiryAt: Instant?,
    authorizedAt: Instant?,
    capturedAt: Instant?,
    val createdAt: Instant,
    updatedAt: Instant,
) {
    var paymentKey: String? = paymentKey
        private set
    var status: PaymentStatus = status
        private set
    var capturedAmount: Long = capturedAmount
        private set
    var refundedAmount: Long = refundedAmount
        private set

    /** VOID 명령이 결과 미상 중에 왔다는 표시 — AUTHORIZED 로 결론 나면 그때 취소한다 */
    var voidRequestedAt: Instant? = voidRequestedAt
        private set
    var failureReason: String? = failureReason
        private set

    /** 결과 미상에서 결론을 못 낸 재조회 횟수 */
    var inquiryAttempts: Int = inquiryAttempts
        private set

    /** 다음 PG 재조회 시각. null 이면 재조회하지 않는다(결론 났거나 소진) */
    var nextInquiryAt: Instant? = nextInquiryAt
        private set
    var authorizedAt: Instant? = authorizedAt
        private set
    var capturedAt: Instant? = capturedAt
        private set
    var updatedAt: Instant = updatedAt
        private set

    val refundableAmount: Long get() = capturedAmount - refundedAmount

    /** 기억해 둔 VOID 를 지금 실행해야 하는가 — 승인만 됐거나, PG 가 승인과 함께 매입했고 아직 환불이 없을 때 */
    val pendingVoidDue: Boolean get() = voidRequestedAt != null && (status == PaymentStatus.AUTHORIZED || voidableByRefund)

    /** 매입됐지만 환불이 하나도 없다 — VOID 를 전액 취소로 처리할 수 있다(토스는 승인 확인이 곧 매입) */
    private val voidableByRefund: Boolean get() = status == PaymentStatus.CAPTURED && refundedAmount == 0L

    fun authorize(paymentKey: String, now: Instant) {
        require(paymentKey.isNotBlank()) { "PG 거래 키가 비었습니다" }
        transition(PaymentStatus.AUTHORIZED, now)
        this.paymentKey = paymentKey
        authorizedAt = now
        nextInquiryAt = null
    }

    fun fail(reason: String, now: Instant) {
        transition(PaymentStatus.FAILED, now)
        failureReason = reason
        nextInquiryAt = null
    }

    /** 타임아웃·5xx — PG 가 승인했는지 모른다. 첫 재조회는 30초 뒤 */
    fun markUnknown(reason: String, now: Instant) {
        transition(PaymentStatus.UNKNOWN, now)
        failureReason = reason
        inquiryAttempts = 0
        nextInquiryAt = now.plus(INQUIRY_BACKOFF.first())
    }

    /**
     * 재조회로도 결론이 안 났다. 백오프대로 다음 조회를 잡고, [MAX_INQUIRIES] 번째면 멈춘다.
     * @return 소진됐으면 true — 사람이 볼 차례다
     */
    fun recordInquiryMiss(now: Instant): Boolean {
        if (status != PaymentStatus.UNKNOWN) throw InvalidPaymentStateException(status, "INQUIRY_MISS")
        inquiryAttempts += 1
        updatedAt = now
        if (inquiryAttempts >= MAX_INQUIRIES) {
            nextInquiryAt = null
            return true
        }
        nextInquiryAt = now.plus(INQUIRY_BACKOFF[inquiryAttempts])
        return false
    }

    /** 운영자 재시도 — 소진된 UNKNOWN 을 처음부터 다시 조회한다 */
    fun retryInquiry(now: Instant) {
        if (status != PaymentStatus.UNKNOWN) throw InvalidPaymentStateException(status, "RETRY_INQUIRY")
        inquiryAttempts = 0
        nextInquiryAt = now
        updatedAt = now
    }

    /**
     * VOID 명령. 매입된 결제(토스는 승인 확인이 곧 매입)도 환불이 없으면 실행 대상이다 — 실행은 전액 취소([cancelCaptured]).
     * VOID 로 전액 취소된 결제(REFUNDED + VOID 표시)에 다시 오면 할 일이 없다. 부분 환불이 있으면 거부한다.
     */
    fun requestVoid(now: Instant): VoidDecision = when (status) {
        PaymentStatus.AUTHORIZED -> VoidDecision.EXECUTE
        PaymentStatus.READY, PaymentStatus.UNKNOWN -> {
            if (voidRequestedAt == null) voidRequestedAt = now
            updatedAt = now
            VoidDecision.DEFERRED
        }
        PaymentStatus.VOIDED, PaymentStatus.FAILED -> VoidDecision.ALREADY_SETTLED
        PaymentStatus.CAPTURED ->
            if (voidableByRefund) VoidDecision.EXECUTE else throw InvalidPaymentStateException(status, "VOID")
        PaymentStatus.REFUNDED ->
            if (voidRequestedAt != null) VoidDecision.ALREADY_SETTLED else throw InvalidPaymentStateException(status, "VOID")
        PaymentStatus.PARTIALLY_REFUNDED -> throw InvalidPaymentStateException(status, "VOID")
    }

    fun void(now: Instant) {
        transition(PaymentStatus.VOIDED, now)
    }

    /**
     * 매입된 결제의 VOID = 전액 취소. 돈이 이미 매입됐으므로 VOIDED 가 아니라 REFUNDED 로 끝난다(매입 − 환불 = 0 이라 대사가 맞는다).
     * VOID 표시를 남겨 같은 VOID 가 다시 와도 [requestVoid] 가 할 일 없음으로 답한다.
     */
    fun cancelCaptured(now: Instant) {
        if (!voidableByRefund) throw InvalidPaymentStateException(status, "VOID(전액 취소)")
        transition(PaymentStatus.REFUNDED, now)
        refundedAmount = capturedAmount
        if (voidRequestedAt == null) voidRequestedAt = now
    }

    fun capture(now: Instant) {
        if (voidRequestedAt != null) throw InvalidPaymentStateException(status, "CAPTURE(VOID 요청됨)")
        recordCapture(now)
    }

    /**
     * PG 가 승인과 함께 매입했다(토스 승인 확인). VOID 가 기억돼 있어도 돈은 이미 매입됐으니 기록한다 —
     * 그 VOID 는 [pendingVoidDue] 로 전액 취소가 된다.
     */
    fun captureByPg(now: Instant) {
        recordCapture(now)
    }

    private fun recordCapture(now: Instant) {
        transition(PaymentStatus.CAPTURED, now)
        capturedAmount = amount
        capturedAt = now
    }

    /** 환불 가능 여부만 본다 — PG 를 부르기 전에 막기 위해 */
    fun checkRefundable(refundAmount: Long) {
        if (!status.isCaptured || status == PaymentStatus.REFUNDED) throw InvalidPaymentStateException(status, "REFUND")
        require(refundAmount > 0) { "환불액은 1원 이상이어야 합니다" }
        if (refundAmount > refundableAmount) throw RefundExceedsCapturedException(refundAmount, refundableAmount)
    }

    fun refund(refundAmount: Long, now: Instant) {
        checkRefundable(refundAmount)
        val total = refundedAmount + refundAmount
        transition(if (total == capturedAmount) PaymentStatus.REFUNDED else PaymentStatus.PARTIALLY_REFUNDED, now)
        refundedAmount = total
    }

    private fun transition(target: PaymentStatus, now: Instant) {
        if (!status.canTransitionTo(target)) throw InvalidPaymentStateException(status, target.name)
        status = target
        updatedAt = now
    }

    companion object {
        /** 재조회 간격: 30초 · 1분 · 2분 · 4분 · 2.5분 — 합 10분이 보류 기한(30분) 안에 끝난다 */
        val INQUIRY_BACKOFF: List<Duration> = listOf(30L, 60L, 120L, 240L, 150L).map(Duration::ofSeconds)
        val MAX_INQUIRIES: Int = INQUIRY_BACKOFF.size

        /**
         * 새 결제. PG 승인 호출 전에 READY 로 저장한다 — 호출 도중 프로세스가 죽어도 재조회가 30초 뒤 이 행을 줍는다.
         */
        fun start(orderId: Long, orderNo: String, amount: Long, now: Instant): Payment {
            require(amount > 0) { "결제액은 1원 이상이어야 합니다" }
            require(orderNo.isNotBlank()) { "주문번호가 비었습니다" }
            return Payment(
                id = null, orderId = orderId, orderNo = orderNo, amount = amount, paymentKey = null,
                status = PaymentStatus.READY, capturedAmount = 0, refundedAmount = 0, voidRequestedAt = null,
                failureReason = null, inquiryAttempts = 0, nextInquiryAt = now.plus(INQUIRY_BACKOFF.first()),
                authorizedAt = null, capturedAt = null, createdAt = now, updatedAt = now,
            )
        }

        fun restore(
            id: Long?,
            orderId: Long,
            orderNo: String,
            amount: Long,
            paymentKey: String?,
            status: PaymentStatus,
            capturedAmount: Long,
            refundedAmount: Long,
            voidRequestedAt: Instant?,
            failureReason: String?,
            inquiryAttempts: Int,
            nextInquiryAt: Instant?,
            authorizedAt: Instant?,
            capturedAt: Instant?,
            createdAt: Instant,
            updatedAt: Instant,
        ): Payment = Payment(
            id, orderId, orderNo, amount, paymentKey, status, capturedAmount, refundedAmount, voidRequestedAt,
            failureReason, inquiryAttempts, nextInquiryAt, authorizedAt, capturedAt, createdAt, updatedAt,
        )
    }
}
