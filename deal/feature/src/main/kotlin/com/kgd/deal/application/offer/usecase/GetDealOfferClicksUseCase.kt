package com.kgd.deal.application.offer.usecase

import com.kgd.deal.application.offer.dto.DealClickDaily
import java.time.LocalDate

interface GetDealOfferClicksUseCase {
    fun execute(query: Query): List<DealClickDaily>

    data class Query(val offerId: Long, val from: LocalDate, val to: LocalDate)
}
