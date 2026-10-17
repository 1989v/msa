package com.kgd.search.application.marketstore.port

import com.kgd.search.application.marketstore.usecase.SearchMarketStoreUseCase

interface MarketStoreSearchPort {
    fun search(query: SearchMarketStoreUseCase.Query): SearchMarketStoreUseCase.Result
}
