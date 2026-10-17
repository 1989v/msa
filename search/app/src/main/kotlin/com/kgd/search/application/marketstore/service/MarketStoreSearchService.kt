package com.kgd.search.application.marketstore.service

import com.kgd.search.application.marketstore.port.MarketStoreSearchPort
import com.kgd.search.application.marketstore.usecase.SearchMarketStoreUseCase
import org.springframework.stereotype.Service

@Service
class MarketStoreSearchService(private val port: MarketStoreSearchPort) : SearchMarketStoreUseCase {
    override fun search(query: SearchMarketStoreUseCase.Query) = port.search(query)
}
