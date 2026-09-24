package com.kgd.payment.infrastructure.persistence.refund.repository

import com.kgd.payment.infrastructure.persistence.refund.entity.PaymentRefundJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface PaymentRefundJpaRepository : JpaRepository<PaymentRefundJpaEntity, Long> {
    fun existsByRefundKey(refundKey: String): Boolean
}
