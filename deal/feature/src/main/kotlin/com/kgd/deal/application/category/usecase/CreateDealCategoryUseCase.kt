package com.kgd.deal.application.category.usecase

import com.kgd.deal.application.category.dto.DealCategoryAdminResponse
import com.kgd.deal.application.category.dto.DealCategoryRequest

interface CreateDealCategoryUseCase {
    fun execute(request: DealCategoryRequest): DealCategoryAdminResponse
}
