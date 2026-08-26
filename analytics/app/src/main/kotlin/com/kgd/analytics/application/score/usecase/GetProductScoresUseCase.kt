package com.kgd.analytics.application.score.usecase

import com.kgd.analytics.domain.model.ProductScore

/** 벌크 조회 — 캐시에 없는 id 만 저장소에서 읽는다 */
interface GetProductScoresUseCase {
    fun execute(productIds: List<Long>): List<ProductScore>
}
