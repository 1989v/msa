package com.kgd.place.application.market.usecase

import com.kgd.place.domain.market.model.MarketType
import com.kgd.place.domain.market.model.GoodPriceMenu

interface SearchMarketsUseCase {
    fun search(query: String, lang: String, page: Int, size: Int): Result
    fun contentIds(): List<String>

    data class Result(val query: String, val markets: List<MarketSummary>, val stores: StorePage)
    /** [attraction] is the detail page to open: the requested language first, else Korean. */
    data class MarketSummary(val contentId: String, val name: String, val region: String?,
        val marketType: MarketType, val storeCount: Long, val attraction: AttractionRef?)
    data class AttractionRef(val id: Long, val lang: String)
    data class StorePage(val items: List<StoreSummary>, val total: Long, val page: Int, val size: Int)
    data class StoreSummary(val storeId: Long, val name: String, val items: String?, val category: String?,
        val marketContentId: String, val marketName: String, val zoneName: String?,
        val latitude: Double?, val longitude: Double?, val attraction: AttractionRef?, val goodPrice: GoodPrice? = null,
        val matchedBy: MatchedBy = MatchedBy.NAME, val relatedCategory: String? = null)
    enum class MatchedBy { NAME, ITEMS, MENU, CATEGORY, RELATED_CATEGORY }
    data class GoodPrice(val category: String?, val menus: List<GoodPriceMenu>)
}
