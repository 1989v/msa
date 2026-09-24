package com.kgd.settlement.infrastructure.persistence.statement.repository

import com.kgd.settlement.domain.statement.model.StatementStatus
import com.kgd.settlement.infrastructure.persistence.statement.entity.SettlementItemJpaEntity
import com.kgd.settlement.infrastructure.persistence.statement.entity.SettlementRefundedItemJpaEntity
import com.kgd.settlement.infrastructure.persistence.statement.entity.SettlementStatementJpaEntity
import com.kgd.settlement.infrastructure.persistence.statement.entity.SettlementStatementLineJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.time.LocalDate

interface SettlementItemJpaRepository : JpaRepository<SettlementItemJpaEntity, Long> {
    fun existsByItemKey(itemKey: String): Boolean

    fun findBySellerIdAndStatementIdIsNullAndConfirmedAtBefore(sellerId: Long, before: Instant): List<SettlementItemJpaEntity>

    @Query("SELECT DISTINCT i.sellerId FROM SettlementItemJpaEntity i WHERE i.statementId IS NULL")
    fun findPendingSellerIds(): List<Long>

    /** 아직 묶이지 않은 것만 묶는다 — 바뀐 행 수가 키 수보다 적으면 다른 배치가 먼저 가져갔다 */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE SettlementItemJpaEntity i SET i.statementId = :statementId WHERE i.itemKey IN :keys AND i.statementId IS NULL")
    fun assign(@Param("keys") keys: Collection<String>, @Param("statementId") statementId: Long): Int
}

interface SettlementRefundedItemJpaRepository : JpaRepository<SettlementRefundedItemJpaEntity, String>

interface SettlementStatementJpaRepository : JpaRepository<SettlementStatementJpaEntity, Long> {
    fun existsBySellerIdAndPeriodStart(sellerId: Long, periodStart: LocalDate): Boolean

    fun findByStatusOrderByIdAsc(status: StatementStatus): List<SettlementStatementJpaEntity>

    fun findBySellerIdOrderByPeriodStartDescIdDesc(sellerId: Long): List<SettlementStatementJpaEntity>

    @Query(
        "SELECT s FROM SettlementStatementJpaEntity s " +
            "WHERE (:status IS NULL OR s.status = :status) AND (:sellerId IS NULL OR s.sellerId = :sellerId) ORDER BY s.id DESC",
    )
    fun search(@Param("status") status: StatementStatus?, @Param("sellerId") sellerId: Long?, pageable: Pageable): List<SettlementStatementJpaEntity>
}

interface SettlementStatementLineJpaRepository : JpaRepository<SettlementStatementLineJpaEntity, Long> {
    fun findByStatementIdIn(statementIds: Collection<Long>): List<SettlementStatementLineJpaEntity>
}
