package com.kgd.ads.presentation.decision.dto

import com.kgd.ads.application.decision.usecase.DecideAdsUseCase
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * 한 페이지의 지면 결정 요청.
 * @param contextKey `blog:{카테고리 slug}` · `game:{장르 slug}` · `place:{광역 코드}`, 키가 없는 화면은 비운다
 */
data class DecisionRequest(
    @field:Size(min = 1, max = MAX_PLACEMENTS)
    val placements: List<@Size(min = 1, max = 64) String>,
    @field:NotBlank
    @field:Size(max = 128)
    val host: String,
    @field:Size(max = 128)
    val contextKey: String? = null,
) {
    companion object {
        const val MAX_PLACEMENTS = 10
    }
}

data class DecisionResponse(val decisionId: String, val placements: List<PlacementDecisionResponse>) {
    companion object {
        fun from(result: DecideAdsUseCase.Result) = DecisionResponse(
            decisionId = result.decisionId,
            placements = result.placements.map(PlacementDecisionResponse::from),
        )
    }
}

/** 지면 하나. [ad] 가 없으면 [reason] 이 있다. [house] 는 유료가 없을 때 AdSense 다음으로 쓰는 자체 홍보 목록이다. */
data class PlacementDecisionResponse(
    val placementKey: String,
    val ad: AdResponse?,
    val reason: String?,
    val house: List<HouseCreativeResponse>,
) {
    companion object {
        fun from(decision: DecideAdsUseCase.PlacementDecision) = PlacementDecisionResponse(
            placementKey = decision.placementKey,
            ad = decision.ad?.let(AdResponse::from),
            reason = decision.noAdReason?.code,
            house = decision.house.map(HouseCreativeResponse::from),
        )
    }
}

/** 유료 광고 카드. 광고주 문자열은 화면에서 텍스트 노드로만 그린다. 카드 링크는 [clickUrl](클릭 리다이렉터). */
data class AdResponse(
    val creativeId: Long,
    val title: String,
    val body: String,
    val advertiserName: String,
    val imageUrl: String,
    val clickUrl: String,
    val impressionToken: String,
) {
    companion object {
        fun from(ad: DecideAdsUseCase.ServedAdView) = AdResponse(
            creativeId = ad.creativeId,
            title = ad.title,
            body = ad.body,
            advertiserName = ad.advertiserName,
            imageUrl = assetUrl(ad.imageHash),
            clickUrl = "$ADS_BASE/click/${ad.clickToken}",
            impressionToken = ad.impressionToken,
        )
    }
}

data class HouseCreativeResponse(
    val creativeId: Long,
    val title: String,
    val body: String,
    val emoji: String?,
    val link: String,
    val imageUrl: String?,
) {
    companion object {
        fun from(house: DecideAdsUseCase.HouseCreativeView) = HouseCreativeResponse(
            creativeId = house.creativeId,
            title = house.title,
            body = house.body,
            emoji = house.emoji,
            link = house.link,
            imageUrl = house.imageHash?.let(::assetUrl),
        )
    }
}

private const val ADS_BASE = "/api/v1/ads"

private fun assetUrl(hash: String) = "$ADS_BASE/assets/$hash"
