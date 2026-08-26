package com.kgd.deal.application.offer.usecase

import com.kgd.deal.application.offer.dto.DealOfferAdminResponse
import com.kgd.deal.application.offer.dto.DealOfferRequest

interface CreateDealOfferUseCase {
    fun execute(request: DealOfferRequest): DealOfferAdminResponse
}
