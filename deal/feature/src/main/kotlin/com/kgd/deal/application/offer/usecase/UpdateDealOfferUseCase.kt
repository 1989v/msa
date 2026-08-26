package com.kgd.deal.application.offer.usecase

import com.kgd.deal.application.offer.dto.DealOfferAdminResponse
import com.kgd.deal.application.offer.dto.DealOfferRequest

interface UpdateDealOfferUseCase {
    fun execute(command: Command): DealOfferAdminResponse

    data class Command(val id: Long, val request: DealOfferRequest)
}
