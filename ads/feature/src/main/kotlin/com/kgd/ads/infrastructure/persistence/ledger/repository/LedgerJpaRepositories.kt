package com.kgd.ads.infrastructure.persistence.ledger.repository

import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.domain.ledger.model.LedgerTransactionType
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerAccountJpaEntity
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerEntryJpaEntity
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerTransactionJpaEntity
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface LedgerAccountJpaRepository : JpaRepository<LedgerAccountJpaEntity, Long> {
    fun findAllByAdvertiserIdIn(advertiserIds: Collection<Long>): List<LedgerAccountJpaEntity>

    @Query("select a.id from LedgerAccountJpaEntity a where a.advertiserId = :advertiserId")
    fun findIdByAdvertiserId(@Param("advertiserId") advertiserId: Long): Long?

    @Query("select a.id from LedgerAccountJpaEntity a where a.type = :type and a.advertiserId is null order by a.id")
    fun findSystemAccountIds(@Param("type") type: LedgerAccountType): List<Long>

    /** id 오름차순으로 잠근다 — 두 거래가 같은 계정 쌍을 반대 순서로 잠가 교착되지 않게. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from LedgerAccountJpaEntity a where a.id in :ids order by a.id")
    fun lockAllByIdOrdered(@Param("ids") ids: Collection<Long>): List<LedgerAccountJpaEntity>
}

interface LedgerTransactionJpaRepository : JpaRepository<LedgerTransactionJpaEntity, Long> {
    @Query("select t.id from LedgerTransactionJpaEntity t where t.idempotencyKey = :key")
    fun findIdByIdempotencyKey(@Param("key") idempotencyKey: String): Long?
}

interface LedgerEntryJpaRepository : JpaRepository<LedgerEntryJpaEntity, Long> {

    /** 한 계정에 [from, until) 동안 [type] 거래로 들어온 분개 합. */
    @Query(
        "select coalesce(sum(e.amountMicros), 0) from LedgerEntryJpaEntity e, LedgerTransactionJpaEntity t " +
            "where t.id = e.transactionId and e.accountId = :accountId and t.type = :type " +
            "and t.createdAt >= :from and t.createdAt < :until",
    )
    fun sumByTransactionType(
        @Param("accountId") accountId: Long,
        @Param("type") type: LedgerTransactionType,
        @Param("from") from: LocalDateTime,
        @Param("until") until: LocalDateTime,
    ): Long

    @Query("select coalesce(sum(e.amountMicros), 0) from LedgerEntryJpaEntity e")
    fun sumAll(): Long
}
