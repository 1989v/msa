package com.kgd.payment.domain.payment.model

import java.time.Instant

/** 환불 한 건. [refundKey] 가 멱등 키다 — 같은 키로 두 번 오면 한 번만 환불한다. */
data class PaymentRefund(
    val id: Long? = null,
    val paymentId: Long,
    val refundKey: String,
    val amount: Long,
    val reason: String?,
    val createdAt: Instant,
)
