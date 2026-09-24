package com.kgd.ads.application.creative.usecase

import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.application.creative.dto.HouseCreativeDraft

/** 운영자의 HOUSE 소재. 만든 운영자가 곧 심사자라 승인 상태로 시작한다. */
interface ManageHouseCreativeUseCase {
    fun list(campaignId: Long): List<CreativeView>
    fun create(actorMemberId: Long, campaignId: Long, draft: HouseCreativeDraft): CreativeView
    fun archive(actorMemberId: Long, creativeId: Long): CreativeView
}
