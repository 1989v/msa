package com.kgd.ranking.application.ranking.usecase

import com.kgd.ranking.application.ranking.dto.RankingBoardDetail

interface GetRankingBoardUseCase {
    fun execute(slug: String): RankingBoardDetail
}
