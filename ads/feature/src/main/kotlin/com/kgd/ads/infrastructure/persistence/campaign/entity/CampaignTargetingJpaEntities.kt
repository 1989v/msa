package com.kgd.ads.infrastructure.persistence.campaign.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable

@Entity
@Table(name = "ad_campaign_placement")
@IdClass(CampaignPlacementJpaEntity.Key::class)
class CampaignPlacementJpaEntity(
    @Id
    @Column(name = "campaign_id", nullable = false)
    val campaignId: Long,

    @Id
    @Column(name = "placement_key", nullable = false, length = 64)
    val placementKey: String,
) {
    data class Key(val campaignId: Long = 0, val placementKey: String = "") : Serializable
}

@Entity
@Table(name = "ad_campaign_category")
@IdClass(CampaignCategoryJpaEntity.Key::class)
class CampaignCategoryJpaEntity(
    @Id
    @Column(name = "campaign_id", nullable = false)
    val campaignId: Long,

    @Id
    @Column(name = "category_code", nullable = false, length = 32)
    val categoryCode: String,
) {
    data class Key(val campaignId: Long = 0, val categoryCode: String = "") : Serializable
}
