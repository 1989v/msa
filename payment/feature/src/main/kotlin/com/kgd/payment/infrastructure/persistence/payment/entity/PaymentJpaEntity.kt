package com.kgd.payment.infrastructure.persistence.payment.entity

import com.kgd.payment.domain.payment.model.Payment
import com.kgd.payment.domain.payment.model.PaymentStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant

/** `payment` 행. `order_no` 유니크 — 같은 가맹점 주문번호로 결제 행이 둘 생기지 않는다(동시 삽입도 DB 가 막는다). */
@Entity
@Table(name = "payment")
class PaymentJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "order_id", nullable = false)
    val orderId: Long,

    @Column(name = "order_no", nullable = false, length = 64)
    val orderNo: String,

    @Column(nullable = false)
    val amount: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    @Column(name = "payment_key", length = 200)
    var paymentKey: String? = null
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: PaymentStatus = PaymentStatus.READY
        private set

    @Column(name = "captured_amount", nullable = false)
    var capturedAmount: Long = 0
        private set

    @Column(name = "refunded_amount", nullable = false)
    var refundedAmount: Long = 0
        private set

    @Column(name = "void_requested_at")
    var voidRequestedAt: Instant? = null
        private set

    @Column(name = "failure_reason", length = 500)
    var failureReason: String? = null
        private set

    @Column(name = "inquiry_attempts", nullable = false)
    var inquiryAttempts: Int = 0
        private set

    @Column(name = "next_inquiry_at")
    var nextInquiryAt: Instant? = null
        private set

    @Column(name = "authorized_at")
    var authorizedAt: Instant? = null
        private set

    @Column(name = "captured_at")
    var capturedAt: Instant? = null
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = createdAt
        private set

    @Version
    @Column(nullable = false)
    var version: Long = 0
        private set

    /** 도메인 상태 전체를 옮긴다 — 불변 필드(주문·주문번호·금액)는 생성 때만 정해진다 */
    fun syncFrom(p: Payment) {
        paymentKey = p.paymentKey
        status = p.status
        capturedAmount = p.capturedAmount
        refundedAmount = p.refundedAmount
        voidRequestedAt = p.voidRequestedAt
        failureReason = p.failureReason?.take(500)
        inquiryAttempts = p.inquiryAttempts
        nextInquiryAt = p.nextInquiryAt
        authorizedAt = p.authorizedAt
        capturedAt = p.capturedAt
        updatedAt = p.updatedAt
    }

    fun toDomain(): Payment = Payment.restore(
        id, orderId, orderNo, amount, paymentKey, status, capturedAmount, refundedAmount, voidRequestedAt,
        failureReason, inquiryAttempts, nextInquiryAt, authorizedAt, capturedAt, createdAt, updatedAt,
    )

    companion object {
        fun newFrom(p: Payment) = PaymentJpaEntity(orderId = p.orderId, orderNo = p.orderNo, amount = p.amount, createdAt = p.createdAt)
            .apply { syncFrom(p) }
    }
}
