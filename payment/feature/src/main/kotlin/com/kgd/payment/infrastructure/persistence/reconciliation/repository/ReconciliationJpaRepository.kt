package com.kgd.payment.infrastructure.persistence.reconciliation.repository

import com.kgd.payment.infrastructure.persistence.reconciliation.entity.ReconciliationJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.LocalDate

interface ReconciliationJpaRepository : JpaRepository<ReconciliationJpaEntity, Long> {
    fun existsBySettleDateAndOrderNo(settleDate: LocalDate, orderNo: String): Boolean

    @Modifying
    @Query("DELETE FROM ReconciliationJpaEntity r WHERE r.settleDate = :settleDate AND r.orderNo = :orderNo")
    fun deleteBySettleDateAndOrderNo(settleDate: LocalDate, orderNo: String): Int
}
