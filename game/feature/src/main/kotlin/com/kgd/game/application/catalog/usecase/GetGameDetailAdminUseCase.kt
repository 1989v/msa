package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameDetailDto

/** 편집 폼 프리필용 상세 — 공개 상세와 달리 상태 은닉 없이 그대로 돌려준다 */
interface GetGameDetailAdminUseCase {
    fun execute(query: Query): GameDetailDto

    data class Query(val slug: String)
}
