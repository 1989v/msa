package com.kgd.deal.application.category.usecase

interface DeleteDealCategoryUseCase {
    fun execute(command: Command)

    data class Command(val id: Long)
}
