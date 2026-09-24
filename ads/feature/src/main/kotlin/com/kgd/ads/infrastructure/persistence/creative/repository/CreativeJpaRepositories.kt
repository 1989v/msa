package com.kgd.ads.infrastructure.persistence.creative.repository

import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.infrastructure.persistence.creative.entity.CreativeAssetContentJpaEntity
import com.kgd.ads.infrastructure.persistence.creative.entity.CreativeAssetJpaEntity
import com.kgd.ads.infrastructure.persistence.creative.entity.CreativeJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface CreativeJpaRepository : JpaRepository<CreativeJpaEntity, Long> {
    fun findAllByCampaignIdInAndStatus(campaignIds: Collection<Long>, status: CreativeStatus): List<CreativeJpaEntity>
}

interface CreativeAssetJpaRepository : JpaRepository<CreativeAssetJpaEntity, String>

interface CreativeAssetContentJpaRepository : JpaRepository<CreativeAssetContentJpaEntity, String>
