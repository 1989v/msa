package com.kgd.ads.application.campaign.service

import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.application.audit.dto.AdminAction
import com.kgd.ads.application.audit.port.AdminAuditPort
import com.kgd.ads.application.campaign.dto.CampaignAction
import com.kgd.ads.application.campaign.dto.CampaignView
import com.kgd.ads.application.campaign.dto.HouseCampaignDraft
import com.kgd.ads.application.campaign.port.CampaignPort
import com.kgd.ads.application.campaign.usecase.ManageHouseCampaignUseCase
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class HouseCampaignService(
    private val advertiserPort: AdvertiserPort,
    private val campaignPort: CampaignPort,
    private val rules: CampaignRules,
    private val auditPort: AdminAuditPort,
    @Qualifier("adsClock") private val clock: Clock,
) : ManageHouseCampaignUseCase {

    override fun list(): List<CampaignView> {
        val now = LocalDateTime.now(clock)
        return campaignPort.findAllByAdvertiser(requireNotNull(advertiserPort.findSystem().id))
            .sortedByDescending { it.id }
            .map { CampaignView.of(it, now) }
    }

    @Transactional("adsTransactionManager")
    override fun create(actorMemberId: Long, draft: HouseCampaignDraft): CampaignView {
        rules.requireCategories(draft.categoryCodes)
        val campaign = Campaign.draftHouse(
            advertiser = advertiserPort.findSystem(),
            name = draft.name,
            startAt = draft.startAt,
            endAt = draft.endAt,
            placementKeys = rules.placements(draft.placementKeys).map { it.key }.toSet(),
            categoryCodes = draft.categoryCodes,
        )
        val now = LocalDateTime.now(clock)
        val saved = campaignPort.save(campaign, now)
        auditPort.record(AdminAction(actorMemberId, "HOUSE_CAMPAIGN_CREATE", TARGET, saved.id.toString(), saved.name, now))
        return CampaignView.of(saved, now)
    }

    @Transactional("adsTransactionManager")
    override fun changeStatus(actorMemberId: Long, campaignId: Long, action: CampaignAction): CampaignView {
        val systemId = requireNotNull(advertiserPort.findSystem().id)
        val campaign = campaignPort.findByIdAndAdvertiser(campaignId, systemId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "HOUSE 캠페인이 없습니다")
        rules.apply(campaign, action)
        val now = LocalDateTime.now(clock)
        val saved = campaignPort.save(campaign, now)
        auditPort.record(AdminAction(actorMemberId, "HOUSE_CAMPAIGN_$action", TARGET, campaignId.toString(), saved.status.name, now))
        return CampaignView.of(saved, now)
    }

    private companion object {
        const val TARGET = "CAMPAIGN"
    }
}
