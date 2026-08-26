package com.kgd.ranking.application.ranking.usecase

import com.kgd.ranking.application.ranking.dto.RankingScopeResponse
import com.kgd.ranking.domain.model.RankingDomain

/** 고를 수 있는 지역 — 보드가 있는 곳만. 데이터 없는 지역을 고르게 하면 빈 화면이 된다. */
interface GetRankingScopesUseCase {
    fun execute(domain: RankingDomain): List<RankingScopeResponse>
}
