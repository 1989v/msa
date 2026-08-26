package com.kgd.ranking.application.ranking.usecase

import com.kgd.ranking.application.ranking.dto.RankingBoardSummary
import com.kgd.ranking.domain.model.RankingDomain

interface GetRankingBoardsUseCase {
    fun execute(query: Query): List<RankingBoardSummary>

    data class Query(val domain: RankingDomain?, val scopeKey: String?)
}
