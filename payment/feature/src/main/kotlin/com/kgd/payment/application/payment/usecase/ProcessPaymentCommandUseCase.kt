package com.kgd.payment.application.payment.usecase

/**
 * 사가가 보내는 결제 명령(`payment.command.*`). 전부 멱등이다 —
 * 같은 orderNo 승인은 PG 승인을 한 번만 만들고, 같은 refundKey 환불은 한 번만 환불한다.
 */
interface ProcessPaymentCommandUseCase {
    fun authorize(command: Authorize): PaymentView
    fun capture(orderNo: String): PaymentView
    fun void(orderNo: String): PaymentView
    fun refund(command: Refund): PaymentView

    /** [paymentKey] 가 있으면 토스 흐름(결제창 인증 뒤 승인 확인), 없으면 서버 승인(모의 PG) */
    data class Authorize(val orderId: Long, val orderNo: String, val amount: Long, val paymentKey: String? = null)
    data class Refund(val orderNo: String, val amount: Long, val refundKey: String, val reason: String?)
}
