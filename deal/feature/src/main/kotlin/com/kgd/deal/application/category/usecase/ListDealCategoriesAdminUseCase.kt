package com.kgd.deal.application.category.usecase

import com.kgd.deal.application.category.dto.DealCategoryAdminResponse

interface ListDealCategoriesAdminUseCase {
    fun execute(): List<DealCategoryAdminResponse>
}
