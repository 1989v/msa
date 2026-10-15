package com.kgd.place.application.market.port

import com.kgd.place.application.market.usecase.SearchMarketsUseCase

interface MarketSearchPort {
    fun search(query: String, lang: String, page: Int, size: Int): SearchMarketsUseCase.Result
    fun contentIds(): List<String>
}
