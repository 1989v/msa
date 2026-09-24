package com.kgd.ads.infrastructure.persistence.campaign.adapter

import com.kgd.ads.application.campaign.port.CampaignPort
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.infrastructure.persistence.advertiser.repository.AdvertiserJpaRepository
import com.kgd.ads.infrastructure.persistence.campaign.entity.CampaignCategoryJpaEntity
import com.kgd.ads.infrastructure.persistence.campaign.entity.CampaignJpaEntity
import com.kgd.ads.infrastructure.persistence.campaign.entity.CampaignPlacementJpaEntity
import com.kgd.ads.infrastructure.persistence.campaign.repository.CampaignCategoryJpaRepository
import com.kgd.ads.infrastructure.persistence.campaign.repository.CampaignJpaRepository
import com.kgd.ads.infrastructure.persistence.campaign.repository.CampaignPlacementJpaRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class CampaignRepositoryAdapter(
    private val campaignRepository: CampaignJpaRepository,
    private val placementRepository: CampaignPlacementJpaRepository,
    private val categoryRepository: CampaignCategoryJpaRepository,
    private val advertiserRepository: AdvertiserJpaRepository,
) : CampaignPort {

    override fun findById(id: Long): Campaign? = campaignRepository.findByIdOrNull(id)?.let(::toDomain)

    override fun findByIdAndAdvertiser(id: Long, advertiserId: Long): Campaign? =
        campaignRepository.findByIdAndAdvertiserId(id, advertiserId)?.let(::toDomain)

    override fun findAllByAdvertiser(advertiserId: Long): List<Campaign> {
        val rows = campaignRepository.findAllByAdvertiserId(advertiserId)
        if (rows.isEmpty()) return emptyList()
        val kind = requireNotNull(advertiserRepository.findByIdOrNull(advertiserId)).kind
        val ids = rows.mapNotNull { it.id }
        val placements = placementRepository.findAllByCampaignIdIn(ids).groupBy({ it.campaignId }, { it.placementKey })
        val categories = categoryRepository.findAllByCampaignIdIn(ids).groupBy({ it.campaignId }, { it.categoryCode })
        return rows.map { it.toDomain(kind, placements[it.id].orEmpty().toSet(), categories[it.id].orEmpty().toSet()) }
    }

    /**
     * 타기팅은 지금 행과 비교해 빠진 것만 지우고 새 것만 넣는다 — 전부 지우고 다시 넣으면 같은 키의 행이
     * 한 영속성 컨텍스트 안에서 삭제·병합으로 부딪힌다.
     */
    override fun save(campaign: Campaign, now: LocalDateTime): Campaign {
        val createdAt = campaign.id?.let { campaignRepository.findByIdOrNull(it)?.createdAt } ?: now
        val saved = campaignRepository.save(CampaignJpaEntity.of(campaign, createdAt, now))
        val campaignId = requireNotNull(saved.id)

        val currentPlacements = placementRepository.findAllByCampaignId(campaignId)
        placementRepository.deleteAll(currentPlacements.filter { it.placementKey !in campaign.placementKeys })
        (campaign.placementKeys - currentPlacements.map { it.placementKey }.toSet())
            .forEach { placementRepository.save(CampaignPlacementJpaEntity(campaignId, it)) }

        val currentCategories = categoryRepository.findAllByCampaignId(campaignId)
        categoryRepository.deleteAll(currentCategories.filter { it.categoryCode !in campaign.categoryCodes })
        (campaign.categoryCodes - currentCategories.map { it.categoryCode }.toSet())
            .forEach { categoryRepository.save(CampaignCategoryJpaEntity(campaignId, it)) }

        return saved.toDomain(campaign.advertiserKind, campaign.placementKeys, campaign.categoryCodes)
    }

    private fun toDomain(row: CampaignJpaEntity): Campaign {
        val campaignId = requireNotNull(row.id)
        val kind = requireNotNull(advertiserRepository.findByIdOrNull(row.advertiserId)) { "광고주 없음: ${row.advertiserId}" }.kind
        return row.toDomain(
            kind,
            placementRepository.findAllByCampaignId(campaignId).map { it.placementKey }.toSet(),
            categoryRepository.findAllByCampaignId(campaignId).map { it.categoryCode }.toSet(),
        )
    }
}
