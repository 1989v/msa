package com.kgd.place.application.market.usecase

interface MarketTourMenuUseCase {
    fun attach(marketId: Long): Summary
    fun attachAll(): Summary
    data class Summary(val markets: Int, val matched: Int)
    data class Menu(val firstMenu: String?, val treatMenu: String?, val attraction: SearchMarketsUseCase.AttractionRef,
        val firstMenuEn: String? = null, val treatMenuEn: String? = null)
    data class Restaurant(val attraction: SearchMarketsUseCase.AttractionRef, val title: String,
        val firstMenu: String?, val treatMenu: String?, val latitude: Double, val longitude: Double,
        val contentId: String = "", val koreanAttractionId: Long? = null)
}
