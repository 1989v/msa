package com.kgd.payment.application.payment.usecase

import com.kgd.payment.domain.payment.model.Payment
import com.kgd.payment.domain.payment.model.PaymentStatus

data class PaymentView(
    val id: Long,
    val orderId: Long,
    val orderNo: String,
    val amount: Long,
    val paymentKey: String?,
    val status: PaymentStatus,
    val refundedAmount: Long,
    val voidRequested: Boolean,
) {
    companion object {
        fun from(p: Payment) = PaymentView(
            id = requireNotNull(p.id), orderId = p.orderId, orderNo = p.orderNo, amount = p.amount,
            paymentKey = p.paymentKey, status = p.status, refundedAmount = p.refundedAmount,
            voidRequested = p.voidRequestedAt != null,
        )
    }
}
