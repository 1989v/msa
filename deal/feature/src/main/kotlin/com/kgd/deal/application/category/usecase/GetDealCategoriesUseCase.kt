package com.kgd.deal.application.category.usecase

import com.kgd.deal.application.category.dto.DealCategoryResponse

/** 공개 — 전시 중(OPEN)인 카테고리만 */
interface GetDealCategoriesUseCase {
    fun execute(): List<DealCategoryResponse>
}
