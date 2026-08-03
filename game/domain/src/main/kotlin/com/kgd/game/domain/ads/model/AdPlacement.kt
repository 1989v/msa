package com.kgd.game.domain.ads.model

/**
 * 광고 슬롯 — 플랫폼은 슬롯/정책/보상만 소유하고 집행은 provider 에 위임 (설계 §4.3).
 * HOUSE 는 creativesJson(자체 홍보 크리에이티브 배열)을 직접 서빙한다.
 */
class AdPlacement private constructor(
    val id: Long? = null,
    val placementKey: String,
    val adType: AdType,
    var provider: AdProvider,
    var providerSlotId: String?,
    var creativesJson: String?,
    var active: Boolean
) {
    companion object {
        private val KEY_PATTERN = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

        fun create(
            placementKey: String,
            adType: AdType,
            provider: AdProvider,
            providerSlotId: String? = null,
            creativesJson: String? = null
        ): AdPlacement {
            require(KEY_PATTERN.matches(placementKey)) { "placementKey는 소문자/숫자/하이픈 형식이어야 합니다: $placementKey" }
            require(provider != AdProvider.HOUSE || !creativesJson.isNullOrBlank()) {
                "HOUSE 슬롯은 creativesJson이 필요합니다"
            }
            return AdPlacement(
                placementKey = placementKey,
                adType = adType,
                provider = provider,
                providerSlotId = providerSlotId,
                creativesJson = creativesJson,
                active = true
            )
        }

        fun restore(
            id: Long?,
            placementKey: String,
            adType: AdType,
            provider: AdProvider,
            providerSlotId: String?,
            creativesJson: String?,
            active: Boolean
        ): AdPlacement = AdPlacement(id, placementKey, adType, provider, providerSlotId, creativesJson, active)
    }

    fun isServable(): Boolean = active && (provider != AdProvider.HOUSE || !creativesJson.isNullOrBlank())
}
