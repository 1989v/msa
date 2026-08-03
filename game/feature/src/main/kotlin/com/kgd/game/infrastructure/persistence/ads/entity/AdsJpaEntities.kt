package com.kgd.game.infrastructure.persistence.ads.entity

import com.kgd.game.domain.ads.model.AdPlacement
import com.kgd.game.domain.ads.model.AdPolicy
import com.kgd.game.domain.ads.model.AdProvider
import com.kgd.game.domain.ads.model.AdType
import com.kgd.game.domain.ads.model.RewardGrant
import com.kgd.game.domain.ads.model.RewardStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "ad_placement", indexes = [Index(name = "uk_placement_key", columnList = "placement_key", unique = true)])
class AdPlacementJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "placement_key", nullable = false, length = 64)
    val placementKey: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "ad_type", nullable = false, length = 16)
    val adType: AdType,
    provider: AdProvider,
    providerSlotId: String?,
    creativesJson: String?,
    active: Boolean,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var provider: AdProvider = provider
        private set

    @Column(name = "provider_slot_id", length = 100)
    var providerSlotId: String? = providerSlotId
        private set

    /** HOUSE 크리에이티브 배열 — [{title, body, href, emoji}] */
    @Column(name = "creatives", columnDefinition = "json")
    var creativesJson: String? = creativesJson
        private set

    @Column(nullable = false)
    var active: Boolean = active
        private set

    fun update(placement: AdPlacement) {
        provider = placement.provider
        providerSlotId = placement.providerSlotId
        creativesJson = placement.creativesJson
        active = placement.active
    }

    fun toDomain(): AdPlacement = AdPlacement.restore(
        id = id,
        placementKey = placementKey,
        adType = adType,
        provider = provider,
        providerSlotId = providerSlotId,
        creativesJson = creativesJson,
        active = active,
    )

    companion object {
        fun fromDomain(placement: AdPlacement): AdPlacementJpaEntity = AdPlacementJpaEntity(
            id = placement.id,
            placementKey = placement.placementKey,
            adType = placement.adType,
            provider = placement.provider,
            providerSlotId = placement.providerSlotId,
            creativesJson = placement.creativesJson,
            active = placement.active,
        )
    }
}

@Entity
@Table(name = "ad_policy", indexes = [Index(name = "uk_policy_type", columnList = "ad_type", unique = true)])
class AdPolicyJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Enumerated(EnumType.STRING)
    @Column(name = "ad_type", nullable = false, length = 16)
    val adType: AdType,
    minIntervalSec: Int,
    maxPerSession: Int,
) {
    @Column(name = "min_interval_sec", nullable = false)
    var minIntervalSec: Int = minIntervalSec
        private set

    @Column(name = "max_per_session", nullable = false)
    var maxPerSession: Int = maxPerSession
        private set

    fun toDomain(): AdPolicy = AdPolicy.restore(id, adType, minIntervalSec, maxPerSession)
}

@Entity
@Table(
    name = "reward_grant",
    indexes = [
        Index(name = "uk_reward_idem", columnList = "idempotency_key", unique = true),
        Index(name = "idx_reward_member", columnList = "member_id, issued_at"),
    ],
)
class RewardGrantJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "idempotency_key", nullable = false, length = 64)
    val idempotencyKey: String,
    @Column(name = "placement_key", nullable = false, length = 64)
    val placementKey: String,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(name = "session_key", length = 64)
    val sessionKey: String?,
    @Column(name = "member_id")
    val memberId: Long?,
    status: RewardStatus,
    @Column(name = "issued_at", nullable = false)
    val issuedAt: Instant,
    settledAt: Instant?,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: RewardStatus = status
        private set

    @Column(name = "settled_at")
    var settledAt: Instant? = settledAt
        private set

    fun update(grant: RewardGrant) {
        status = grant.status
        settledAt = grant.settledAt
    }

    fun toDomain(): RewardGrant = RewardGrant.restore(
        id = id,
        idempotencyKey = idempotencyKey,
        placementKey = placementKey,
        gameId = gameId,
        sessionKey = sessionKey,
        memberId = memberId,
        status = status,
        issuedAt = issuedAt,
        settledAt = settledAt,
    )

    companion object {
        fun fromDomain(grant: RewardGrant): RewardGrantJpaEntity = RewardGrantJpaEntity(
            id = grant.id,
            idempotencyKey = grant.idempotencyKey,
            placementKey = grant.placementKey,
            gameId = grant.gameId,
            sessionKey = grant.sessionKey,
            memberId = grant.memberId,
            status = grant.status,
            issuedAt = grant.issuedAt,
            settledAt = grant.settledAt,
        )
    }
}
