package com.kgd.payment.infrastructure.persistence.payment.repository

import com.kgd.payment.domain.payment.model.PaymentStatus
import com.kgd.payment.infrastructure.persistence.payment.entity.PaymentJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface PaymentJpaRepository : JpaRepository<PaymentJpaEntity, Long> {
    fun findByOrderNo(orderNo: String): PaymentJpaEntity?
    fun findAllByOrderNoIn(orderNos: Collection<String>): List<PaymentJpaEntity>
    fun findAllByStatusInAndNextInquiryAtLessThanEqualOrderByNextInquiryAtAsc(
        statuses: Collection<PaymentStatus>,
        now: Instant,
        pageable: Pageable,
    ): List<PaymentJpaEntity>
    fun findAllByCapturedAtGreaterThanEqualAndCapturedAtLessThan(from: Instant, to: Instant): List<PaymentJpaEntity>
}
