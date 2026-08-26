package com.kgd.analytics.application.score.usecase

import com.kgd.analytics.domain.model.ProductScore

/** 캐시 → 저장소 순으로 찾고, 찾은 것은 캐시에 채운다 */
interface GetProductScoreUseCase {
    fun execute(productId: Long): ProductScore?
}
