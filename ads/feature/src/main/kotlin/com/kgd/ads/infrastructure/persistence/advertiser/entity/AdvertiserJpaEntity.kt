package com.kgd.ads.infrastructure.persistence.advertiser.entity

import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.advertiser.model.AdvertiserStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "ad_advertiser")
class AdvertiserJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 16)
    val kind: AdvertiserKind,

    @Column(name = "member_id")
    val memberId: Long?,

    displayName: String,

    status: AdvertiserStatus,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,

    updatedAt: LocalDateTime,
) {
    @Column(name = "display_name", nullable = false, length = 100)
    var displayName: String = displayName
        private set

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    var status: AdvertiserStatus = status
        private set

    @Column(name = "suspend_reason", length = 255)
    var suspendReason: String? = null
        private set

    @Column(name = "suspended_by")
    var suspendedBy: Long? = null
        private set

    @Column(name = "suspended_at")
    var suspendedAt: LocalDateTime? = null
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = updatedAt
        private set

    fun toDomain(): Advertiser = Advertiser.restore(
        id = requireNotNull(id),
        kind = kind,
        memberId = memberId,
        displayName = displayName,
        status = status,
    )

    companion object {
        fun newOf(advertiser: Advertiser, now: LocalDateTime): AdvertiserJpaEntity = AdvertiserJpaEntity(
            kind = advertiser.kind,
            memberId = advertiser.memberId,
            displayName = advertiser.displayName,
            status = advertiser.status,
            createdAt = now,
            updatedAt = now,
        )
    }
}
