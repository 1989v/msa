package com.kgd.game.application.ads.usecase

import com.kgd.game.application.ads.service.AdPlacementDto

/** 노출 가능하면 슬롯+크리에이티브, frequency cap 에 걸리면 null */
interface GetServablePlacementUseCase {
    fun execute(query: Query): AdPlacementDto?

    data class Query(val placementKey: String, val subject: String)
}
