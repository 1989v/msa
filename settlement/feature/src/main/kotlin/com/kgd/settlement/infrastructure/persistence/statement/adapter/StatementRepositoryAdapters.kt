package com.kgd.settlement.infrastructure.persistence.statement.adapter

import com.kgd.settlement.application.statement.port.RefundedItemRepositoryPort
import com.kgd.settlement.application.statement.port.SettlementItemRepositoryPort
import com.kgd.settlement.application.statement.port.StatementRepositoryPort
import com.kgd.settlement.domain.statement.model.SettlementItem
import com.kgd.settlement.domain.statement.model.SettlementStatement
import com.kgd.settlement.domain.statement.model.StatementStatus
import com.kgd.settlement.infrastructure.persistence.statement.entity.SettlementItemJpaEntity
import com.kgd.settlement.infrastructure.persistence.statement.entity.SettlementRefundedItemJpaEntity
import com.kgd.settlement.infrastructure.persistence.statement.entity.SettlementStatementJpaEntity
import com.kgd.settlement.infrastructure.persistence.statement.entity.SettlementStatementLineJpaEntity
import com.kgd.settlement.infrastructure.persistence.statement.repository.SettlementItemJpaRepository
import com.kgd.settlement.infrastructure.persistence.statement.repository.SettlementRefundedItemJpaRepository
import com.kgd.settlement.infrastructure.persistence.statement.repository.SettlementStatementJpaRepository
import com.kgd.settlement.infrastructure.persistence.statement.repository.SettlementStatementLineJpaRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import java.time.LocalDate

@Component
class SettlementItemRepositoryAdapter(
    private val repository: SettlementItemJpaRepository,
    @Qualifier("settlementClock") private val clock: Clock,
) : SettlementItemRepositoryPort {

    override fun existsByKey(key: String): Boolean = repository.existsByItemKey(key)

    override fun save(item: SettlementItem) {
        repository.save(SettlementItemJpaEntity.from(item, clock.instant()))
    }

    override fun findPending(sellerId: Long, before: Instant): List<SettlementItem> =
        repository.findBySellerIdAndStatementIdIsNullAndConfirmedAtBefore(sellerId, before).map { it.toDomain() }

    override fun findPendingSellerIds(): List<Long> = repository.findPendingSellerIds()

    override fun assign(keys: Collection<String>, statementId: Long) {
        val updated = repository.assign(keys, statementId)
        if (updated != keys.size) {
            throw OptimisticLockingFailureException("정산 항목 ${keys.size}건 중 ${updated}건만 묶였다 — 다른 배치가 먼저 가져갔다(statement=$statementId)")
        }
    }
}

@Component
class RefundedItemRepositoryAdapter(
    private val repository: SettlementRefundedItemJpaRepository,
) : RefundedItemRepositoryPort {

    override fun markRefunded(keys: Collection<String>, claimId: Long, at: Instant) {
        val existing = repository.findAllById(keys).map { it.itemKey }.toSet()
        repository.saveAll(keys.filterNot { it in existing }.distinct().map { SettlementRefundedItemJpaEntity(it, claimId, at) })
    }

    override fun findRefundedKeys(keys: Collection<String>): Set<String> =
        if (keys.isEmpty()) emptySet() else repository.findAllById(keys).map { it.itemKey }.toSet()
}

@Component
class StatementRepositoryAdapter(
    private val statements: SettlementStatementJpaRepository,
    private val lines: SettlementStatementLineJpaRepository,
    @Qualifier("settlementClock") private val clock: Clock,
) : StatementRepositoryPort {

    override fun save(statement: SettlementStatement): SettlementStatement {
        val now = clock.instant()
        val id = statement.id
        if (id == null) {
            val saved = statements.saveAndFlush(SettlementStatementJpaEntity.newFrom(statement, now))
            val newId = requireNotNull(saved.id)
            lines.saveAll(statement.lines.map { SettlementStatementLineJpaEntity.from(newId, it) })
            return statement.withId(newId)
        }
        val entity = statements.findById(id).orElseThrow { IllegalStateException("정산서 $id 가 없다") }
        entity.syncFrom(statement, now)
        statements.saveAndFlush(entity)
        return statement
    }

    override fun findById(id: Long): SettlementStatement? = statements.findById(id).orElse(null)?.let { withLines(listOf(it)).single() }

    override fun existsBySellerAndPeriodStart(sellerId: Long, periodStart: LocalDate): Boolean =
        statements.existsBySellerIdAndPeriodStart(sellerId, periodStart)

    override fun findByStatus(status: StatementStatus): List<SettlementStatement> = withLines(statements.findByStatusOrderByIdAsc(status))

    override fun findBySeller(sellerId: Long): List<SettlementStatement> =
        withLines(statements.findBySellerIdOrderByPeriodStartDescIdDesc(sellerId))

    override fun search(status: StatementStatus?, sellerId: Long?, limit: Int): List<SettlementStatement> =
        withLines(statements.search(status, sellerId, PageRequest.of(0, limit)))

    /** 정산서 여럿의 줄을 한 번에 읽는다(N+1 없이) */
    private fun withLines(rows: List<SettlementStatementJpaEntity>): List<SettlementStatement> {
        if (rows.isEmpty()) return emptyList()
        val byStatement = lines.findByStatementIdIn(rows.map { requireNotNull(it.id) }).groupBy { it.statementId }
        return rows.map { s -> s.toDomain(byStatement[s.id].orEmpty().sortedBy { it.id }.map { it.toDomain(s.sellerId) }) }
    }
}
