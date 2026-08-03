package com.kgd.order.application.order.port

import java.math.BigDecimal

interface PaymentPort {
    suspend fun requestPayment(orderId: Long, amount: BigDecimal): PaymentResult
}

data class PaymentResult(
    val paymentId: String,
    val status: String,
    val amount: BigDecimal
)
