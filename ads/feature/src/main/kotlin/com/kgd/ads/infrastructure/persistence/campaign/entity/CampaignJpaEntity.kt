package com.kgd.ads.infrastructure.persistence.campaign.entity

import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.campaign.model.CampaignStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/**
 * 캠페인 행. 타기팅 지면·카테고리는 [CampaignPlacementJpaEntity]·[CampaignCategoryJpaEntity] 가 따로 갖는다 —
 * 후보 인덱스가 모든 캠페인의 타기팅을 한 번에 읽어야 해서 연관관계 대신 id 로 묶는다.
 * 우선순위 컬럼은 없다(소유 광고주 종류에서 파생).
 */
@Entity
@Table(name = "ad_campaign")
class CampaignJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "advertiser_id", nullable = false)
    val advertiserId: Long,

    @Column(name = "name", nullable = false, length = 100)
    val name: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    val status: CampaignStatus,

    @Enumerated(EnumType.STRING)
    @Column(name = "bid_type", length = 8)
    val bidType: BidType?,

    @Column(name = "bid_micros")
    val bidMicros: Long?,

    @Column(name = "daily_budget_micros")
    val dailyBudgetMicros: Long?,

    @Column(name = "total_budget_micros")
    val totalBudgetMicros: Long?,

    @Column(name = "start_at", nullable = false)
    val startAt: LocalDateTime,

    @Column(name = "end_at")
    val endAt: LocalDateTime?,

    @Column(name = "frequency_cap_per_day")
    val frequencyCapPerDay: Int?,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime,
) {
    fun toDomain(advertiserKind: AdvertiserKind, placementKeys: Set<String>, categoryCodes: Set<String>): Campaign =
        Campaign.restore(
            id = requireNotNull(id),
            advertiserId = advertiserId,
            advertiserKind = advertiserKind,
            name = name,
            status = status,
            bid = if (bidType != null && bidMicros != null) Bid(bidType, bidMicros) else null,
            dailyBudgetMicros = dailyBudgetMicros,
            totalBudgetMicros = totalBudgetMicros,
            startAt = startAt,
            endAt = endAt,
            frequencyCapPerDay = frequencyCapPerDay,
            placementKeys = placementKeys,
            categoryCodes = categoryCodes,
        )
}
