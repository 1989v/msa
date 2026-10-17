package com.kgd.search.application.marketstore.usecase

interface SearchMarketStoreUseCase {
    fun search(query: Query): Result
    data class Query(val q: String, val contentId: String? = null, val lang: String = "ko", val page: Int = 0, val size: Int = 20)
    data class Item(val storeId: Long, val contentId: String, val matchedBy: List<String>, val score: Double,
        val name: String? = null, val nameEn: String? = null, val categorySub: String? = null, val categorySubEn: String? = null,
        val address: String? = null, val buildingName: String? = null, val dong: String? = null, val floor: String? = null, val ho: String? = null,
        val goodPrice: Boolean = false, val goodPriceMenus: List<String> = emptyList(), val sources: List<String> = emptyList(),
        val membership: String? = null, val nearby: Boolean = false, val marketName: String? = null, val attraction: Attraction? = null)
    data class Market(val contentId: String, val marketName: String, val count: Long, val marketNameEn: String? = null, val region: String? = null, val marketType: String? = null, val attraction: Attraction? = null)
    data class Attraction(val id: Long, val lang: String)
    data class Result(val items: List<Item>, val total: Long, val markets: List<Market>)
}
