package com.kgd.wishlist.infrastructure.persistence.entity

import com.kgd.wishlist.domain.model.CollectionShare
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** 묶음 공유 링크 (ADR-0107). 만료·폐기는 행을 지우지 않고 시각으로 남는다 */
@Entity
@Table(name = "collection_share")
class CollectionShareJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, length = 10, unique = true, columnDefinition = "char(10)")
    val token: String,
    @Column(name = "collection_id", nullable = false)
    val collectionId: Long,
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant,
    @Column(name = "expires_at")
    val expiresAt: Instant?,
    revokedAt: Instant?,
) {
    /** 바뀌는 값은 이것 하나다 — 폐기 */
    @Column(name = "revoked_at")
    var revokedAt: Instant? = revokedAt
        private set

    fun revoke(at: Instant) {
        if (revokedAt == null) revokedAt = at
    }

    fun toDomain(): CollectionShare = CollectionShare.restore(
        id = id,
        collectionId = collectionId,
        memberId = memberId,
        token = token,
        createdAt = createdAt,
        expiresAt = expiresAt,
        revokedAt = revokedAt,
    )

    companion object {
        fun fromDomain(share: CollectionShare) = CollectionShareJpaEntity(
            id = share.id,
            token = share.token,
            collectionId = share.collectionId,
            memberId = share.memberId,
            createdAt = share.createdAt,
            expiresAt = share.expiresAt,
            revokedAt = share.revokedAt,
        )
    }
}
