package com.kgd.game.application.ads.dto

import com.kgd.game.domain.ads.model.AdType
import com.kgd.game.application.ads.service.HouseCreativeDto

data class AdPlacementDto(
    val placementKey: String,
    val adType: AdType,
    val provider: String,
    val creatives: List<HouseCreativeDto>,
)
