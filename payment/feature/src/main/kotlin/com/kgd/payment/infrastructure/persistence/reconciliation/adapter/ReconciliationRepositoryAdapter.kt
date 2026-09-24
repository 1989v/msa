package com.kgd.payment.infrastructure.persistence.reconciliation.adapter

import com.kgd.payment.application.payment.port.ReconciliationRepositoryPort
import com.kgd.payment.domain.reconciliation.model.ReconciliationRecord
import com.kgd.payment.infrastructure.persistence.reconciliation.entity.ReconciliationJpaEntity
import com.kgd.payment.infrastructure.persistence.reconciliation.repository.ReconciliationJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDate

@Component
class ReconciliationRepositoryAdapter(
    private val jpaRepository: ReconciliationJpaRepository,
) : ReconciliationRepositoryPort {
    override fun exists(settleDate: LocalDate, orderNo: String): Boolean =
        jpaRepository.existsBySettleDateAndOrderNo(settleDate, orderNo)

    override fun save(record: ReconciliationRecord) {
        jpaRepository.save(ReconciliationJpaEntity.from(record))
    }

    override fun delete(settleDate: LocalDate, orderNo: String) {
        jpaRepository.deleteBySettleDateAndOrderNo(settleDate, orderNo)
    }
}
