package com.kgd.settlement.application.statement.service

import com.kgd.common.exception.NotFoundException
import com.kgd.settlement.application.ledger.port.JournalRepositoryPort
import com.kgd.settlement.application.statement.port.RefundedItemRepositoryPort
import com.kgd.settlement.application.statement.port.SettlementItemRepositoryPort
import com.kgd.settlement.application.statement.port.StatementRepositoryPort
import com.kgd.settlement.domain.ledger.model.JournalRules
import com.kgd.settlement.domain.statement.model.SettlementPeriod
import com.kgd.settlement.domain.statement.model.SettlementStatement
import com.kgd.settlement.domain.statement.model.StatementStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/** 정산 배치의 트랜잭션 단위 둘 — 송금(외부 IO 자리)은 이 둘 사이, 트랜잭션 밖에서 한다 */
@Service
class StatementTransactionalService(
    private val items: SettlementItemRepositoryPort,
    private val refundedItems: RefundedItemRepositoryPort,
    private val statements: StatementRepositoryPort,
    private val journals: JournalRepositoryPort,
) {
    /**
     * 초안 → 확정. 지급액 > 0 이면 CONFIRMED 로 두고 항목을 묶는다. ≤ 0 이면 CARRIED_OVER — 항목을 묶지 않아 다음 기간 정산서가 가져간다.
     * 담을 항목이 없으면 null. (판매자, 기간 시작) 유니크라 두 배치가 같은 정산서를 만들지 못한다.
     */
    @Transactional("settlementTransactionManager")
    fun open(sellerId: Long, period: SettlementPeriod, now: Instant): SettlementStatement? {
        val candidates = items.findPending(sellerId, period.endInstant)
        if (candidates.isEmpty()) return null
        val refunded = refundedItems.findRefundedKeys(candidates.map { it.key })
        val statement = SettlementStatement.draft(sellerId, period, candidates, refunded, now) ?: return null
        statement.confirm(now)
        if (statement.payout <= 0) statement.carryOver(now)
        val saved = statements.save(statement)
        if (saved.status == StatementStatus.CONFIRMED) items.assign(saved.lines.map { it.key }, requireNotNull(saved.id))
        return saved
    }

    /** 송금 뒤 — PAID + 지급 거래(차 판매자 미지급금 / 대 현금), 한 트랜잭션. 이미 PAID 면 그대로 */
    @Transactional("settlementTransactionManager")
    fun markPaid(statementId: Long, reference: String, now: Instant): SettlementStatement {
        val statement = statements.findById(statementId) ?: throw NotFoundException("정산서", statementId)
        if (statement.status == StatementStatus.PAID) return statement
        statement.pay(reference, now)
        val payout = JournalRules.payout(statementId, statement.sellerId, statement.payout, now)
        if (!journals.existsBySourceKey(payout.sourceKey)) journals.append(payout)
        return statements.save(statement)
    }
}
