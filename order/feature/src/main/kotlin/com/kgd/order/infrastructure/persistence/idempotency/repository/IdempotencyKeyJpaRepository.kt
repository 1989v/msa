package com.kgd.order.infrastructure.persistence.idempotency.repository

import com.kgd.order.infrastructure.persistence.idempotency.entity.IdempotencyKeyJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.Instant

interface IdempotencyKeyJpaRepository : JpaRepository<IdempotencyKeyJpaEntity, Long> {
    fun findByUserIdAndIdemKey(userId: String, idemKey: String): IdempotencyKeyJpaEntity?

    /** 리스가 끝난 PROCESSING 만 이어받는다 — 동시에 둘이 이어받지 못한다(행 잠금 + 조건) */
    @Modifying(clearAutomatically = true)
    @Query(
        "UPDATE IdempotencyKeyJpaEntity k SET k.leaseUntil = :leaseUntil " +
            "WHERE k.userId = :userId AND k.idemKey = :idemKey AND k.status = com.kgd.order.domain.idempotency.model.IdempotencyStatus.PROCESSING " +
            "AND k.leaseUntil <= :now",
    )
    fun takeOver(userId: String, idemKey: String, now: Instant, leaseUntil: Instant): Int

    @Modifying
    @Query(
        "DELETE FROM IdempotencyKeyJpaEntity k WHERE k.userId = :userId AND k.idemKey = :idemKey " +
            "AND k.status = com.kgd.order.domain.idempotency.model.IdempotencyStatus.PROCESSING",
    )
    fun deleteProcessing(userId: String, idemKey: String): Int

    @Modifying
    @Query("DELETE FROM IdempotencyKeyJpaEntity k WHERE k.createdAt < :cutoff")
    fun deleteCreatedBefore(cutoff: Instant): Int
}
