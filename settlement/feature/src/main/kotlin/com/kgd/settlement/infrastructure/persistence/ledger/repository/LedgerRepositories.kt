package com.kgd.settlement.infrastructure.persistence.ledger.repository

import com.kgd.settlement.infrastructure.persistence.ledger.entity.LedgerEntryJpaEntity
import com.kgd.settlement.infrastructure.persistence.ledger.entity.LedgerJournalJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface LedgerJournalJpaRepository : JpaRepository<LedgerJournalJpaEntity, Long> {
    fun existsBySourceKey(sourceKey: String): Boolean

    fun findBySourceKey(sourceKey: String): LedgerJournalJpaEntity?
}

interface LedgerEntryJpaRepository : JpaRepository<LedgerEntryJpaEntity, Long> {

    fun findAllByJournalIdOrderById(journalId: Long): List<LedgerEntryJpaEntity>

    /** [account, side, SUM(amount)] */
    @Query("SELECT e.account, e.side, SUM(e.amount) FROM LedgerEntryJpaEntity e GROUP BY e.account, e.side")
    fun sumByAccountAndSide(): List<Array<Any>>

    /** 판매자 미지급금 [sellerId, side, SUM(amount)] */
    @Query(
        "SELECT e.sellerId, e.side, SUM(e.amount) FROM LedgerEntryJpaEntity e " +
            "WHERE e.account = com.kgd.settlement.domain.ledger.model.Account.SELLER_PAYABLE GROUP BY e.sellerId, e.side",
    )
    fun sumSellerPayableBySide(): List<Array<Any>>
}
