package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.NotificationTargetEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

/**
 * TG-P2-04 — `notification_target` JpaRepository.
 *
 * - tenantId 격리는 [findAllByTenantId] / [findByTargetIdAndTenantId] 시그니처로 강제 (INV-05).
 * - lazy re-encryption polling 은 [findTop100ByKekVersionLessThanOrderByCreatedAtAsc].
 * - [updateEnvelopeWithLock] 는 optimistic lock 기반 갱신.
 */
interface NotificationTargetJpaRepository : JpaRepository<NotificationTargetEntity, UUID> {

    fun findByTargetIdAndTenantId(targetId: UUID, tenantId: String): NotificationTargetEntity?

    fun findAllByTenantId(tenantId: String): List<NotificationTargetEntity>

    fun findTop100ByKekVersionLessThanOrderByCreatedAtAsc(targetVersion: Int): List<NotificationTargetEntity>

    @Modifying
    @Query(
        "UPDATE NotificationTargetEntity n SET " +
            "n.botTokenCipher = :botTokenCt, " +
            "n.dekWrapped = :dekWrapped, " +
            "n.kekVersion = :newVersion " +
            "WHERE n.targetId = :targetId AND n.kekVersion = :expectedOldVersion"
    )
    fun updateEnvelopeWithLock(
        @Param("targetId") targetId: UUID,
        @Param("expectedOldVersion") expectedOldVersion: Int,
        @Param("botTokenCt") botTokenCt: ByteArray,
        @Param("dekWrapped") dekWrapped: ByteArray,
        @Param("newVersion") newVersion: Int
    ): Int
}
