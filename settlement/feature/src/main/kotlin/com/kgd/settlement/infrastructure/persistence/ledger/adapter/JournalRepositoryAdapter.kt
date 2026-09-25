package com.kgd.settlement.infrastructure.persistence.ledger.adapter

import com.kgd.settlement.application.ledger.port.AccountBalance
import com.kgd.settlement.application.ledger.port.JournalRepositoryPort
import com.kgd.settlement.domain.ledger.model.Account
import com.kgd.settlement.domain.ledger.model.EntrySide
import com.kgd.settlement.domain.ledger.model.Journal
import com.kgd.settlement.domain.ledger.model.JournalEntry
import com.kgd.settlement.infrastructure.persistence.ledger.entity.LedgerEntryJpaEntity
import com.kgd.settlement.infrastructure.persistence.ledger.entity.LedgerJournalJpaEntity
import com.kgd.settlement.infrastructure.persistence.ledger.repository.LedgerEntryJpaRepository
import com.kgd.settlement.infrastructure.persistence.ledger.repository.LedgerJournalJpaRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import java.time.Clock

/** 원장 어댑터 — 거래 행과 분개 줄을 같은 트랜잭션(호출자의 settlement TM)에 추가한다. 갱신·삭제 경로가 없다 */
@Component
class JournalRepositoryAdapter(
    private val journals: LedgerJournalJpaRepository,
    private val entries: LedgerEntryJpaRepository,
    @Qualifier("settlementClock") private val clock: Clock,
) : JournalRepositoryPort {

    override fun existsBySourceKey(sourceKey: String): Boolean = journals.existsBySourceKey(sourceKey)

    override fun findById(id: Long): Journal? = journals.findById(id).orElse(null)?.let(::toDomain)

    override fun findBySourceKey(sourceKey: String): Journal? = journals.findBySourceKey(sourceKey)?.let(::toDomain)

    override fun append(journal: Journal): Journal {
        val saved = journals.saveAndFlush(
            LedgerJournalJpaEntity(
                type = journal.type, sourceKey = journal.sourceKey, sourceEventId = journal.sourceEventId,
                orderId = journal.orderId, reversalOf = journal.reversalOf, actorId = journal.actorId, reason = journal.reason,
                occurredAt = journal.occurredAt, createdAt = clock.instant(),
            ),
        )
        val id = requireNotNull(saved.id)
        entries.saveAll(journal.entries.map { LedgerEntryJpaEntity(journalId = id, account = it.account, side = it.side, amount = it.amount, sellerId = it.sellerId) })
        return journal.withId(id)
    }

    override fun sumByAccount(): List<AccountBalance> =
        entries.sumByAccountAndSide()
            .groupBy { it[0] as Account }
            .map { (account, rows) -> AccountBalance(account, sumOf(rows, EntrySide.DEBIT), sumOf(rows, EntrySide.CREDIT)) }

    override fun sellerPayableBalances(): Map<Long, Long> =
        entries.sumSellerPayableBySide()
            .groupBy { (it[0] as Number).toLong() }
            .mapValues { (_, rows) -> sumOf(rows, EntrySide.CREDIT) - sumOf(rows, EntrySide.DEBIT) }

    private fun toDomain(e: LedgerJournalJpaEntity): Journal {
        val id = requireNotNull(e.id)
        return Journal.restore(
            id, e.type, e.sourceKey, e.sourceEventId, e.orderId, e.reversalOf, e.occurredAt,
            entries.findAllByJournalIdOrderById(id).map { JournalEntry(it.account, it.side, it.amount, it.sellerId) },
            e.actorId, e.reason,
        )
    }

    private fun sumOf(rows: List<Array<Any>>, side: EntrySide): Long =
        rows.filter { it[1] == side }.sumOf { (it[2] as Number).toLong() }
}
