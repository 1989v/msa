package com.kgd.deal.application.category.usecase

import com.kgd.deal.application.category.dto.DealCategoryAdminResponse
import com.kgd.deal.application.category.dto.DealCategoryRequest

interface UpdateDealCategoryUseCase {
    fun execute(command: Command): DealCategoryAdminResponse

    data class Command(val id: Long, val request: DealCategoryRequest)
}
