package com.kgd.ads.infrastructure.persistence.ledger.repository

import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerAccountJpaEntity
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerEntryJpaEntity
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerTransactionJpaEntity
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface LedgerAccountJpaRepository : JpaRepository<LedgerAccountJpaEntity, Long> {
    fun findByAdvertiserId(advertiserId: Long): LedgerAccountJpaEntity?
    fun findFirstByTypeAndAdvertiserIdIsNull(type: LedgerAccountType): LedgerAccountJpaEntity?

    /** id 오름차순으로 잠근다 — 두 거래가 같은 계정 쌍을 반대 순서로 잠가 교착되지 않게. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from LedgerAccountJpaEntity a where a.id in :ids order by a.id")
    fun lockAllByIdOrdered(@Param("ids") ids: Collection<Long>): List<LedgerAccountJpaEntity>
}

interface LedgerTransactionJpaRepository : JpaRepository<LedgerTransactionJpaEntity, Long>

interface LedgerEntryJpaRepository : JpaRepository<LedgerEntryJpaEntity, Long>
