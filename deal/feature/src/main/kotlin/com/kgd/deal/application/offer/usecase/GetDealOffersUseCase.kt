package com.kgd.deal.application.offer.usecase

import com.kgd.deal.application.offer.dto.DealOfferResponse
import java.time.LocalDateTime

interface GetDealOffersUseCase {
    fun execute(query: Query): List<DealOfferResponse>

    data class Query(val categoryCode: String, val now: LocalDateTime = LocalDateTime.now())
}
