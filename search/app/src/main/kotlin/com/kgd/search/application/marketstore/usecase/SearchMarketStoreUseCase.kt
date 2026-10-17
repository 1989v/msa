package com.kgd.search.application.marketstore.usecase

interface SearchMarketStoreUseCase {
    fun search(query: Query): Result
    data class Query(val q: String, val contentId: String? = null, val lang: String = "ko", val page: Int = 0, val size: Int = 20)
    data class Item(val storeId: Long, val contentId: String, val matchedBy: List<String>, val score: Double)
    data class Market(val contentId: String, val marketName: String, val count: Long)
    data class Result(val items: List<Item>, val total: Long, val markets: List<Market>)
}
