package com.kgd.ads.application.campaign.usecase

import com.kgd.ads.application.campaign.dto.CampaignAction
import com.kgd.ads.application.campaign.dto.CampaignView
import com.kgd.ads.application.campaign.dto.PaidCampaignDraft

/**
 * 광고주의 유료 캠페인 — 조회·생성·수정·상태 전이. 모든 조회는 (캠페인 id, 요청 회원의 광고주)로 하고
 * 남의 캠페인은 없는 것(404)으로 본다. 정지된 광고주는 조회만 된다.
 */
interface ManageCampaignUseCase {
    fun list(memberId: Long): List<CampaignView>
    fun get(memberId: Long, campaignId: Long): CampaignView
    fun create(memberId: Long, draft: PaidCampaignDraft): CampaignView
    fun update(memberId: Long, campaignId: Long, draft: PaidCampaignDraft): CampaignView
    fun changeStatus(memberId: Long, campaignId: Long, action: CampaignAction): CampaignView
}
