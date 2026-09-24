package com.kgd.payment.application.payment.port

import com.kgd.payment.domain.payment.model.PaymentRefund

interface PaymentRefundRepositoryPort {
    fun existsByRefundKey(refundKey: String): Boolean
    fun save(refund: PaymentRefund): PaymentRefund
}
