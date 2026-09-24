package com.kgd.ads.application.campaign.service

import com.kgd.ads.application.advertiser.service.AdvertiserAccess
import com.kgd.ads.application.campaign.dto.CampaignAction
import com.kgd.ads.application.campaign.dto.CampaignView
import com.kgd.ads.application.campaign.dto.PaidCampaignDraft
import com.kgd.ads.application.campaign.port.CampaignPort
import com.kgd.ads.application.campaign.usecase.ManageCampaignUseCase
import com.kgd.ads.domain.campaign.model.Bid
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class CampaignService(
    private val access: AdvertiserAccess,
    private val campaignPort: CampaignPort,
    private val rules: CampaignRules,
    @Qualifier("adsClock") private val clock: Clock,
) : ManageCampaignUseCase {

    private val log = KotlinLogging.logger {}

    override fun list(memberId: Long): List<CampaignView> {
        val advertiserId = requireNotNull(access.require(memberId).id)
        val now = LocalDateTime.now(clock)
        return campaignPort.findAllByAdvertiser(advertiserId).sortedByDescending { it.id }.map { CampaignView.of(it, now) }
    }

    override fun get(memberId: Long, campaignId: Long): CampaignView =
        CampaignView.of(owned(requireNotNull(access.require(memberId).id), campaignId), LocalDateTime.now(clock))

    @Transactional("adsTransactionManager")
    override fun create(memberId: Long, draft: PaidCampaignDraft): CampaignView {
        val advertiser = access.requireWritable(memberId)
        rules.requireCategories(draft.categoryCodes)
        val campaign = Campaign.draftPaid(
            advertiser = advertiser,
            name = draft.name,
            bid = bid(draft),
            dailyBudgetMicros = draft.dailyBudgetMicros,
            totalBudgetMicros = draft.totalBudgetMicros,
            startAt = draft.startAt,
            endAt = draft.endAt,
            placements = rules.placements(draft.placementKeys),
            categoryCodes = draft.categoryCodes,
            frequencyCapPerDay = draft.frequencyCapPerDay ?: Campaign.DEFAULT_FREQUENCY_CAP_PER_DAY,
        )
        val now = LocalDateTime.now(clock)
        val saved = campaignPort.save(campaign, now)
        log.info { "캠페인 생성: campaignId=${saved.id} advertiserId=${advertiser.id}" }
        return CampaignView.of(saved, now)
    }

    @Transactional("adsTransactionManager")
    override fun update(memberId: Long, campaignId: Long, draft: PaidCampaignDraft): CampaignView {
        val advertiser = access.requireWritable(memberId)
        val current = owned(requireNotNull(advertiser.id), campaignId)
        rules.requireCategories(draft.categoryCodes)
        val revised = current.revisePaid(
            advertiser = advertiser,
            name = draft.name,
            bid = bid(draft),
            dailyBudgetMicros = draft.dailyBudgetMicros,
            totalBudgetMicros = draft.totalBudgetMicros,
            startAt = draft.startAt,
            endAt = draft.endAt,
            placements = rules.placements(draft.placementKeys),
            categoryCodes = draft.categoryCodes,
            frequencyCapPerDay = draft.frequencyCapPerDay ?: current.frequencyCapPerDay ?: Campaign.DEFAULT_FREQUENCY_CAP_PER_DAY,
        )
        val now = LocalDateTime.now(clock)
        return CampaignView.of(campaignPort.save(revised, now), now)
    }

    @Transactional("adsTransactionManager")
    override fun changeStatus(memberId: Long, campaignId: Long, action: CampaignAction): CampaignView {
        val advertiser = access.requireWritable(memberId)
        val campaign = owned(requireNotNull(advertiser.id), campaignId)
        rules.apply(campaign, action)
        val now = LocalDateTime.now(clock)
        log.info { "캠페인 상태: campaignId=$campaignId action=$action → ${campaign.status}" }
        return CampaignView.of(campaignPort.save(campaign, now), now)
    }

    private fun owned(advertiserId: Long, campaignId: Long): Campaign =
        campaignPort.findByIdAndAdvertiser(campaignId, advertiserId) ?: throw BusinessException(ErrorCode.NOT_FOUND, "캠페인이 없습니다")

    private fun bid(draft: PaidCampaignDraft): Bid {
        if (draft.bidMicros <= 0) throw BusinessException(ErrorCode.INVALID_INPUT, "입찰가는 0 보다 커야 합니다")
        return Bid(draft.bidType, draft.bidMicros)
    }
}
