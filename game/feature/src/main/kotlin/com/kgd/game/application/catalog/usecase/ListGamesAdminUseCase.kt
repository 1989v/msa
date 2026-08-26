package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.AdminGameSummaryDto
import com.kgd.game.application.catalog.dto.GameSort
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import org.springframework.data.domain.Page

/** 상태 무관 전체 목록 — 공개 리스트로는 볼 수 없는 게임을 운영자가 다룬다 */
interface ListGamesAdminUseCase {
    fun execute(query: Query): Page<AdminGameSummaryDto>

    data class Query(
        val q: String?,
        val status: GameStatus?,
        val genre: Genre?,
        val tag: String?,
        val sort: GameSort,
        val page: Int,
        val size: Int,
    )
}
