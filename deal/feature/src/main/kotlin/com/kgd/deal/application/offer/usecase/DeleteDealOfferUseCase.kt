package com.kgd.deal.application.offer.usecase

interface DeleteDealOfferUseCase {
    fun execute(command: Command)

    data class Command(val id: Long)
}
