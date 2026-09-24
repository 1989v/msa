package com.kgd.ads.application.campaign.usecase

import com.kgd.ads.application.campaign.dto.CampaignAction
import com.kgd.ads.application.campaign.dto.CampaignView
import com.kgd.ads.application.campaign.dto.HouseCampaignDraft

/** 운영자의 HOUSE 캠페인 — 소유자는 항상 「1989v 하우스」(SYSTEM). 광고주 API 로는 만들 수 없다. */
interface ManageHouseCampaignUseCase {
    fun list(): List<CampaignView>
    fun create(actorMemberId: Long, draft: HouseCampaignDraft): CampaignView
    fun changeStatus(actorMemberId: Long, campaignId: Long, action: CampaignAction): CampaignView
}
