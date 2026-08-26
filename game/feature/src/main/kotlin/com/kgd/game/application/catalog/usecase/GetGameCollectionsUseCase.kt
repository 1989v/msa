package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameCollectionDto

/** 홈 큐레이션 행 — 노출 순서는 display_order 그대로, 행 간 중복만 제거. 빈 행은 뺀다 */
interface GetGameCollectionsUseCase {
    fun execute(): List<GameCollectionDto>
}
