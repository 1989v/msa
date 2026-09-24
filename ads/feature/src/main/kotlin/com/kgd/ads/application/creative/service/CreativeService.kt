package com.kgd.ads.application.creative.service

import com.kgd.ads.application.advertiser.service.AdvertiserAccess
import com.kgd.ads.application.campaign.port.CampaignPort
import com.kgd.ads.application.campaign.service.CampaignRules
import com.kgd.ads.application.creative.dto.CreativeAsset
import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.application.creative.dto.PaidCreativeDraft
import com.kgd.ads.application.creative.port.CreativePort
import com.kgd.ads.application.creative.port.CreativeReadPort
import com.kgd.ads.application.creative.usecase.ManageCreativeUseCase
import com.kgd.ads.application.creative.usecase.PreviewCreativeImageUseCase
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.campaign.model.CampaignStatus
import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.creative.model.LandingUrl
import com.kgd.ads.domain.creative.model.PaidCreativeContent
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

/**
 * 광고주 소재. 이미지 처리는 CPU 작업이라 트랜잭션 안에서 해도 외부 IO 를 잡지 않는다 —
 * 캠페인 소유 확인·이미지 저장·소재 저장이 한 커밋이어야 반쯤 올라간 소재가 남지 않는다.
 */
@Service
class CreativeService(
    private val access: AdvertiserAccess,
    private val campaignPort: CampaignPort,
    private val creativePort: CreativePort,
    private val creativeReadPort: CreativeReadPort,
    private val campaignRules: CampaignRules,
    private val imageService: CreativeImageService,
    @Qualifier("adsClock") private val clock: Clock,
) : ManageCreativeUseCase, PreviewCreativeImageUseCase {

    private val log = KotlinLogging.logger {}

    override fun list(memberId: Long, campaignId: Long): List<CreativeView> {
        val campaign = ownedCampaign(requireNotNull(access.require(memberId).id), campaignId)
        return creativePort.findAllByCampaign(requireNotNull(campaign.id)).sortedByDescending { it.id }.map(CreativeView::from)
    }

    override fun get(memberId: Long, creativeId: Long): CreativeView =
        CreativeView.from(ownedCreative(requireNotNull(access.require(memberId).id), creativeId))

    @Transactional("adsTransactionManager")
    override fun create(memberId: Long, campaignId: Long, draft: PaidCreativeDraft): CreativeView {
        val advertiser = access.requireWritable(memberId)
        val campaign = ownedCampaign(requireNotNull(advertiser.id), campaignId)
        if (campaign.status == CampaignStatus.ENDED) throw InvalidCreativeException("종료된 캠페인에는 소재를 올릴 수 없습니다")
        val image = draft.image ?: throw InvalidCreativeException("유료 소재에는 이미지가 필요합니다")
        val now = LocalDateTime.now(clock)
        val landing = LandingUrl.of(draft.landingUrl)
        val hash = imageService.store(image, campaignRules.placements(campaign.placementKeys), now)
        val saved = creativePort.save(Creative.submit(campaign, PaidCreativeContent(draft.title, draft.body, landing, hash)), now)
        log.info { "소재 제출: creativeId=${saved.id} campaignId=$campaignId" }
        return CreativeView.from(saved)
    }

    @Transactional("adsTransactionManager")
    override fun revise(memberId: Long, creativeId: Long, draft: PaidCreativeDraft): CreativeView {
        val advertiser = access.requireWritable(memberId)
        val creative = ownedCreative(requireNotNull(advertiser.id), creativeId)
        val now = LocalDateTime.now(clock)
        val landing = LandingUrl.of(draft.landingUrl)
        val hash = draft.image?.let { image ->
            val campaign = ownedCampaign(requireNotNull(advertiser.id), creative.campaignId)
            imageService.store(image, campaignRules.placements(campaign.placementKeys), now)
        } ?: requireNotNull(creative.content.imageHash)
        creative.revise(PaidCreativeContent(draft.title, draft.body, landing, hash))
        log.info { "소재 수정(심사 대기로): creativeId=$creativeId" }
        return CreativeView.from(creativePort.save(creative, now))
    }

    @Transactional("adsTransactionManager")
    override fun archive(memberId: Long, creativeId: Long): CreativeView {
        val advertiser = access.requireWritable(memberId)
        val creative = ownedCreative(requireNotNull(advertiser.id), creativeId)
        creative.archive()
        return CreativeView.from(creativePort.save(creative, LocalDateTime.now(clock)))
    }

    override fun ofAdvertiser(memberId: Long, creativeId: Long): CreativeAsset =
        assetOf(ownedCreative(requireNotNull(access.require(memberId).id), creativeId))

    override fun ofAnyCreative(creativeId: Long): CreativeAsset =
        assetOf(creativePort.findById(creativeId) ?: throw BusinessException(ErrorCode.NOT_FOUND, "소재가 없습니다"))

    private fun assetOf(creative: Creative): CreativeAsset {
        val hash = creative.content.imageHash ?: throw BusinessException(ErrorCode.NOT_FOUND, "이미지가 없는 소재입니다")
        return creativeReadPort.findAsset(hash) ?: throw BusinessException(ErrorCode.NOT_FOUND, "이미지가 없습니다")
    }

    private fun ownedCampaign(advertiserId: Long, campaignId: Long): Campaign =
        campaignPort.findByIdAndAdvertiser(campaignId, advertiserId) ?: throw BusinessException(ErrorCode.NOT_FOUND, "캠페인이 없습니다")

    private fun ownedCreative(advertiserId: Long, creativeId: Long): Creative =
        creativePort.findByIdAndAdvertiser(creativeId, advertiserId) ?: throw BusinessException(ErrorCode.NOT_FOUND, "소재가 없습니다")
}
