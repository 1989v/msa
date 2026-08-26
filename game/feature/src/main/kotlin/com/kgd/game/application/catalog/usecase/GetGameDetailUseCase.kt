package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameDetailDto

/** DRAFT/REVIEW/SUSPENDED 는 존재 여부 은닉 — NOT_FOUND */
interface GetGameDetailUseCase {
    fun execute(query: Query): GameDetailDto

    data class Query(val slug: String)
}
