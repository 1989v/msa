package com.kgd.ads.presentation.decision.dto

import com.kgd.ads.application.decision.usecase.GetLegacyPlacementUseCase

/** game 의 옛 지면 응답 모양(`placementKey`·`adType`·`provider`·`creatives[title, body, href, emoji]`). */
data class LegacyPlacementResponse(
    val placementKey: String,
    val adType: String,
    val provider: String,
    val creatives: List<LegacyHouseCreativeResponse>,
) {
    companion object {
        // 옛 응답에서 이 경로를 부르던 지면은 HOUSE 배너 하나뿐이었다.
        private const val AD_TYPE = "BANNER"
        private const val PROVIDER = "HOUSE"

        fun from(placement: GetLegacyPlacementUseCase.LegacyPlacement) = LegacyPlacementResponse(
            placementKey = placement.placementKey,
            adType = AD_TYPE,
            provider = PROVIDER,
            creatives = placement.creatives.map { LegacyHouseCreativeResponse(it.title, it.body, it.link, it.emoji) },
        )
    }
}

data class LegacyHouseCreativeResponse(val title: String?, val body: String?, val href: String?, val emoji: String?)
