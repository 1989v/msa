package com.kgd.payment.infrastructure.persistence.payment.adapter

import com.kgd.common.exception.NotFoundException
import com.kgd.payment.application.payment.port.PaymentRepositoryPort
import com.kgd.payment.domain.payment.model.Payment
import com.kgd.payment.domain.payment.model.PaymentStatus
import com.kgd.payment.infrastructure.persistence.payment.entity.PaymentJpaEntity
import com.kgd.payment.infrastructure.persistence.payment.repository.PaymentJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class PaymentRepositoryAdapter(
    private val jpaRepository: PaymentJpaRepository,
) : PaymentRepositoryPort {

    override fun create(payment: Payment): Payment = jpaRepository.saveAndFlush(PaymentJpaEntity.newFrom(payment)).toDomain()

    override fun save(payment: Payment): Payment {
        val id = requireNotNull(payment.id) { "새 결제는 create 로 저장한다" }
        val entity = jpaRepository.findById(id).orElseThrow { NotFoundException("Payment", id) }
        entity.syncFrom(payment)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Payment? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findByOrderNo(orderNo: String): Payment? = jpaRepository.findByOrderNo(orderNo)?.toDomain()

    override fun findAllByOrderNoIn(orderNos: Collection<String>): List<Payment> =
        if (orderNos.isEmpty()) emptyList() else jpaRepository.findAllByOrderNoIn(orderNos).map { it.toDomain() }

    override fun findDueForInquiry(now: Instant, limit: Int): List<Payment> =
        jpaRepository.findAllByStatusInAndNextInquiryAtLessThanEqualOrderByNextInquiryAtAsc(
            listOf(PaymentStatus.READY, PaymentStatus.UNKNOWN), now, PageRequest.of(0, limit),
        ).map { it.toDomain() }

    override fun findCapturedBetween(from: Instant, to: Instant): List<Payment> =
        jpaRepository.findAllByCapturedAtGreaterThanEqualAndCapturedAtLessThan(from, to).map { it.toDomain() }
}
