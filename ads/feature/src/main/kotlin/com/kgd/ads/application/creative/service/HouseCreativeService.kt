package com.kgd.ads.application.creative.service

import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.application.audit.dto.AdminAction
import com.kgd.ads.application.audit.port.AdminAuditPort
import com.kgd.ads.application.campaign.port.CampaignPort
import com.kgd.ads.application.campaign.service.CampaignRules
import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.application.creative.dto.HouseCreativeDraft
import com.kgd.ads.application.creative.port.CreativePort
import com.kgd.ads.application.creative.usecase.ManageHouseCreativeUseCase
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.creative.model.HouseCreativeContent
import com.kgd.ads.domain.creative.model.HouseLink
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class HouseCreativeService(
    private val advertiserPort: AdvertiserPort,
    private val campaignPort: CampaignPort,
    private val creativePort: CreativePort,
    private val campaignRules: CampaignRules,
    private val imageService: CreativeImageService,
    private val auditPort: AdminAuditPort,
    @Qualifier("adsClock") private val clock: Clock,
) : ManageHouseCreativeUseCase {

    override fun list(campaignId: Long): List<CreativeView> =
        creativePort.findAllByCampaign(requireNotNull(houseCampaign(campaignId).id)).sortedByDescending { it.id }.map(CreativeView::from)

    @Transactional("adsTransactionManager")
    override fun create(actorMemberId: Long, campaignId: Long, draft: HouseCreativeDraft): CreativeView {
        val campaign = houseCampaign(campaignId)
        val now = LocalDateTime.now(clock)
        val link = HouseLink.of(draft.link)
        val hash = draft.image?.let { imageService.store(it, campaignRules.placements(campaign.placementKeys), now) }
        val content = HouseCreativeContent(draft.title, draft.body, draft.emoji?.takeIf { it.isNotBlank() }, link, hash)
        val saved = creativePort.save(Creative.createHouse(campaign, content, actorMemberId, now), now)
        auditPort.record(AdminAction(actorMemberId, "HOUSE_CREATIVE_CREATE", TARGET, saved.id.toString(), "campaign=$campaignId", now))
        return CreativeView.from(saved)
    }

    @Transactional("adsTransactionManager")
    override fun archive(actorMemberId: Long, creativeId: Long): CreativeView {
        val systemId = requireNotNull(advertiserPort.findSystem().id)
        val creative = creativePort.findByIdAndAdvertiser(creativeId, systemId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "HOUSE 소재가 없습니다")
        creative.archive()
        val now = LocalDateTime.now(clock)
        auditPort.record(AdminAction(actorMemberId, "HOUSE_CREATIVE_ARCHIVE", TARGET, creativeId.toString(), null, now))
        return CreativeView.from(creativePort.save(creative, now))
    }

    private fun houseCampaign(campaignId: Long): Campaign =
        campaignPort.findByIdAndAdvertiser(campaignId, requireNotNull(advertiserPort.findSystem().id))
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "HOUSE 캠페인이 없습니다")

    private companion object {
        const val TARGET = "CREATIVE"
    }
}
