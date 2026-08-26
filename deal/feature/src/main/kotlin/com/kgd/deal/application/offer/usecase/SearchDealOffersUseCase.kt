package com.kgd.deal.application.offer.usecase

import com.kgd.deal.application.offer.dto.DealCategorySection
import java.time.LocalDateTime

/** 이름·제공처·혜택·요약으로 찾는다. 응답 모양은 목록([GetDealSectionsUseCase])과 같다 */
interface SearchDealOffersUseCase {
    fun execute(query: Query): List<DealCategorySection>

    data class Query(val keyword: String, val now: LocalDateTime = LocalDateTime.now())
}
