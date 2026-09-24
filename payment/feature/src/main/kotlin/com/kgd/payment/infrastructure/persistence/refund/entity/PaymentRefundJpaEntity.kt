package com.kgd.payment.infrastructure.persistence.refund.entity

import com.kgd.payment.domain.payment.model.PaymentRefund
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** 환불 한 건. `refund_key` 유니크 — 같은 환불 명령이 두 번 기록되지 않는다. 추가만 한다. */
@Entity
@Table(name = "payment_refund")
class PaymentRefundJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "payment_id", nullable = false)
    val paymentId: Long,

    @Column(name = "refund_key", nullable = false, length = 100)
    val refundKey: String,

    @Column(nullable = false)
    val amount: Long,

    @Column(length = 500)
    val reason: String?,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    fun toDomain() = PaymentRefund(id, paymentId, refundKey, amount, reason, createdAt)

    companion object {
        fun from(r: PaymentRefund) = PaymentRefundJpaEntity(
            paymentId = r.paymentId, refundKey = r.refundKey, amount = r.amount, reason = r.reason?.take(500), createdAt = r.createdAt,
        )
    }
}
