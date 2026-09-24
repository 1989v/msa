package com.kgd.payment.infrastructure.persistence.refund.adapter

import com.kgd.payment.application.payment.port.PaymentRefundRepositoryPort
import com.kgd.payment.domain.payment.model.PaymentRefund
import com.kgd.payment.infrastructure.persistence.refund.entity.PaymentRefundJpaEntity
import com.kgd.payment.infrastructure.persistence.refund.repository.PaymentRefundJpaRepository
import org.springframework.stereotype.Component

@Component
class PaymentRefundRepositoryAdapter(
    private val jpaRepository: PaymentRefundJpaRepository,
) : PaymentRefundRepositoryPort {
    override fun existsByRefundKey(refundKey: String): Boolean = jpaRepository.existsByRefundKey(refundKey)
    override fun save(refund: PaymentRefund): PaymentRefund = jpaRepository.save(PaymentRefundJpaEntity.from(refund)).toDomain()
}
