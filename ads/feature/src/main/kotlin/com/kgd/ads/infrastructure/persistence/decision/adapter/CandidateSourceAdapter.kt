package com.kgd.ads.infrastructure.persistence.decision.adapter

import com.kgd.ads.application.decision.dto.CandidateSource
import com.kgd.ads.application.decision.dto.CreativeDelivery
import com.kgd.ads.application.decision.dto.ImageSize
import com.kgd.ads.application.decision.port.CandidateSourcePort
import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.campaign.model.CampaignStatus
import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.creative.model.CreativeContent
import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.domain.creative.model.HouseCreativeContent
import com.kgd.ads.domain.creative.model.HouseLink
import com.kgd.ads.domain.creative.model.LandingUrl
import com.kgd.ads.domain.creative.model.PaidCreativeContent
import com.kgd.ads.infrastructure.persistence.advertiser.repository.AdvertiserJpaRepository
import com.kgd.ads.infrastructure.persistence.campaign.repository.CampaignCategoryJpaRepository
import com.kgd.ads.infrastructure.persistence.campaign.repository.CampaignJpaRepository
import com.kgd.ads.infrastructure.persistence.campaign.repository.CampaignPlacementJpaRepository
import com.kgd.ads.infrastructure.persistence.category.repository.ContextMappingJpaRepository
import com.kgd.ads.infrastructure.persistence.category.repository.HostCategoryJpaRepository
import com.kgd.ads.infrastructure.persistence.creative.entity.CreativeJpaEntity
import com.kgd.ads.infrastructure.persistence.creative.repository.CreativeAssetJpaRepository
import com.kgd.ads.infrastructure.persistence.creative.repository.CreativeJpaRepository
import com.kgd.ads.infrastructure.persistence.ledger.repository.LedgerAccountJpaRepository
import com.kgd.ads.infrastructure.persistence.placement.repository.PlacementJpaRepository
import com.kgd.ads.infrastructure.persistence.settlement.repository.AdvertiserSettledThroughJpaRepository
import com.kgd.ads.infrastructure.persistence.settlement.repository.SettlementJpaRepository
import com.kgd.ads.infrastructure.persistence.stats.repository.CreativeHourlyJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 후보 인덱스의 원료를 읽는다. 한 읽기 트랜잭션 안에서 읽어(InnoDB 일관 읽기) 잔액·정산 완료 시각·청구 누계가
 * 같은 시점의 값이 되게 한다 — 정산이 사이에 끼면 지갑 여유에서 같은 지출을 두 번 빼거나 빠뜨린다.
 *
 * 도메인 불변식을 어긴 행(손으로 고친 데이터 등)은 그 행만 빼고 경고한다. 한 행 때문에 인덱스 전체가
 * 갱신되지 않으면 승인·정지가 반영되지 않는다.
 */
@Component
class CandidateSourceAdapter(
    private val advertiserRepository: AdvertiserJpaRepository,
    private val campaignRepository: CampaignJpaRepository,
    private val campaignPlacementRepository: CampaignPlacementJpaRepository,
    private val campaignCategoryRepository: CampaignCategoryJpaRepository,
    private val creativeRepository: CreativeJpaRepository,
    private val creativeAssetRepository: CreativeAssetJpaRepository,
    private val placementRepository: PlacementJpaRepository,
    private val contextMappingRepository: ContextMappingJpaRepository,
    private val hostCategoryRepository: HostCategoryJpaRepository,
    private val ledgerAccountRepository: LedgerAccountJpaRepository,
    private val settledThroughRepository: AdvertiserSettledThroughJpaRepository,
    private val settlementRepository: SettlementJpaRepository,
    private val creativeHourlyRepository: CreativeHourlyJpaRepository,
) : CandidateSourcePort {

    private val log = KotlinLogging.logger {}

    @Transactional("adsTransactionManager", readOnly = true)
    override fun load(dayStart: LocalDateTime): CandidateSource {
        val campaignRows = campaignRepository.findAllByStatus(CampaignStatus.ACTIVE)
        val campaignIds = campaignRows.mapNotNull { it.id }
        val advertisers = advertiserRepository.findAllById(campaignRows.map { it.advertiserId }.toSet()).map { it.toDomain() }
        val kindOf = advertisers.associate { requireNotNull(it.id) to it.kind }
        val placementKeys = campaignPlacementRepository.findAllByCampaignIdIn(campaignIds)
            .groupBy({ it.campaignId }, { it.placementKey })
        val categoryCodes = campaignCategoryRepository.findAllByCampaignIdIn(campaignIds)
            .groupBy({ it.campaignId }, { it.categoryCode })

        val campaigns = campaignRows.mapNotNull { row ->
            val kind = kindOf[row.advertiserId] ?: return@mapNotNull null
            skipInvalid("캠페인 ${row.id}") {
                row.toDomain(kind, placementKeys[row.id].orEmpty().toSet(), categoryCodes[row.id].orEmpty().toSet())
            }
        }
        val kindOfCampaign = campaigns.associate { requireNotNull(it.id) to it.advertiserKind }
        val creativeRows = creativeRepository.findAllByCampaignIdInAndStatus(campaignIds, CreativeStatus.APPROVED)
        val creatives = creativeRows.mapNotNull { row ->
            val kind = kindOfCampaign[row.campaignId] ?: return@mapNotNull null
            skipInvalid("소재 ${row.id}") { row.toDomain(kind) }
        }
        val imageSizes = creativeAssetRepository.findAllById(creatives.mapNotNull { it.content.imageHash }.toSet())
            .associate { it.hash to ImageSize(it.width, it.height) }

        val memberAdvertiserIds = advertisers.filter { it.kind == AdvertiserKind.MEMBER }.mapNotNull { it.id }
        return CandidateSource(
            placements = placementRepository.findAllByActiveTrue().mapNotNull { skipInvalid("지면 ${it.placementKey}") { it.toDomain() } },
            contextMappings = contextMappingRepository.findAll().associate { it.contextKey to it.categoryCode },
            hostCategories = hostCategoryRepository.findAll().associate { it.host to it.categoryCode },
            advertisers = advertisers,
            campaigns = campaigns,
            creatives = creatives,
            imageSizes = imageSizes,
            walletBalances = ledgerAccountRepository.findAllByAdvertiserIdIn(memberAdvertiserIds)
                .associate { requireNotNull(it.advertiserId) to it.balanceMicros },
            settledThrough = settledThroughRepository.findAllById(memberAdvertiserIds)
                .associate { it.advertiserId to it.settledThroughHourKst },
            chargedToday = if (campaignIds.isEmpty()) emptyMap()
            else settlementRepository.sumChargedSince(campaignIds, dayStart).associate { it.campaignId to it.chargedMicros },
            chargedTotal = if (campaignIds.isEmpty()) emptyMap()
            else settlementRepository.sumCharged(campaignIds).associate { it.campaignId to it.chargedMicros },
            deliveries = if (creatives.isEmpty()) emptyList()
            else creativeHourlyRepository.sumDelivery(creatives.mapNotNull { it.id })
                .map { CreativeDelivery(it.creativeId, it.placementKey, it.impressions, it.clicks) },
        )
    }

    private fun CreativeJpaEntity.toDomain(kind: AdvertiserKind): Creative {
        val content: CreativeContent = when (kind) {
            AdvertiserKind.MEMBER -> PaidCreativeContent(title, body, LandingUrl.of(linkUrl), requireNotNull(imageHash) { "유료 소재에 이미지가 없습니다" })
            AdvertiserKind.SYSTEM -> HouseCreativeContent(title, body, emoji, HouseLink.of(linkUrl), imageHash)
        }
        return Creative.restore(requireNotNull(id), campaignId, advertiserId, content, status, rejectReason, reviewedBy, reviewedAt)
    }

    private fun <T> skipInvalid(what: String, block: () -> T): T? =
        try {
            block()
        } catch (e: RuntimeException) {
            log.warn { "광고 후보 인덱스에서 제외: $what — ${e.message}" }
            null
        }
}
