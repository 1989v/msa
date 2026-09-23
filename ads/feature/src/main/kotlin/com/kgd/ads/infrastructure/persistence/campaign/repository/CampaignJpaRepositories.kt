package com.kgd.ads.infrastructure.persistence.campaign.repository

import com.kgd.ads.domain.campaign.model.CampaignStatus
import com.kgd.ads.infrastructure.persistence.campaign.entity.CampaignCategoryJpaEntity
import com.kgd.ads.infrastructure.persistence.campaign.entity.CampaignJpaEntity
import com.kgd.ads.infrastructure.persistence.campaign.entity.CampaignPlacementJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface CampaignJpaRepository : JpaRepository<CampaignJpaEntity, Long> {
    fun findAllByStatus(status: CampaignStatus): List<CampaignJpaEntity>
}

interface CampaignPlacementJpaRepository : JpaRepository<CampaignPlacementJpaEntity, CampaignPlacementJpaEntity.Key> {
    fun findAllByCampaignIdIn(campaignIds: Collection<Long>): List<CampaignPlacementJpaEntity>
}

interface CampaignCategoryJpaRepository : JpaRepository<CampaignCategoryJpaEntity, CampaignCategoryJpaEntity.Key> {
    fun findAllByCampaignIdIn(campaignIds: Collection<Long>): List<CampaignCategoryJpaEntity>
}
