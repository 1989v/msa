package com.kgd.ads.application.campaign.service

import com.kgd.ads.application.campaign.dto.CampaignAction
import com.kgd.ads.application.category.port.CategoryPort
import com.kgd.ads.application.placement.port.PlacementPort
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Component

/** 광고주·HOUSE 캠페인이 함께 쓰는 확인 — 타기팅 지면·카테고리가 등록부에 있는지, 상태 전이. */
@Component
class CampaignRules(
    private val placementPort: PlacementPort,
    private val categoryPort: CategoryPort,
) {
    /** 키마다 등록된 지면. 하나라도 없으면 거절한다(없는 키를 조용히 빼면 광고주가 모른다). */
    fun placements(keys: Set<String>): List<AdPlacement> {
        val found = placementPort.findByKeys(keys)
        val missing = keys - found.map { it.key }.toSet()
        if (missing.isNotEmpty()) throw BusinessException(ErrorCode.INVALID_INPUT, "등록되지 않은 지면입니다: ${missing.sorted()}")
        return found
    }

    fun requireCategories(codes: Set<String>) {
        val missing = codes - categoryPort.categories().map { it.code }.toSet()
        if (missing.isNotEmpty()) throw BusinessException(ErrorCode.INVALID_INPUT, "없는 카테고리입니다: ${missing.sorted()}")
    }

    /** 게재를 켜는 전이(시작·재개)만 지금의 지면 값으로 저장 불변식을 다시 확인한다. */
    fun apply(campaign: Campaign, action: CampaignAction) {
        when (action) {
            CampaignAction.START -> {
                campaign.verifyTargeting(placements(campaign.placementKeys))
                campaign.start()
            }
            CampaignAction.RESUME -> {
                campaign.verifyTargeting(placements(campaign.placementKeys))
                campaign.resume()
            }
            CampaignAction.PAUSE -> campaign.pause()
            CampaignAction.END -> campaign.end()
        }
    }
}
