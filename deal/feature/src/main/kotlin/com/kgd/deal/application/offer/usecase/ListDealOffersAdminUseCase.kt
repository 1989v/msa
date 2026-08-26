package com.kgd.deal.application.offer.usecase

import com.kgd.deal.application.offer.dto.DealOfferAdminResponse
import com.kgd.deal.domain.model.LinkStatus

interface ListDealOffersAdminUseCase {
    fun execute(query: Query): List<DealOfferAdminResponse>

    data class Query(val categoryId: Long?, val linkStatus: LinkStatus?)
}
