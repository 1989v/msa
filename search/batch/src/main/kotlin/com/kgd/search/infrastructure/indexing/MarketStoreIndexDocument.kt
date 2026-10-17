package com.kgd.search.infrastructure.indexing

import com.fasterxml.jackson.annotation.JsonInclude

@JsonInclude(JsonInclude.Include.NON_NULL)
data class MarketStoreIndexDocument(
    val contentId: String = "", val marketName: String = "", val storeId: Long = 0,
    val name: String = "", val nameRoman: String? = null, val nameEn: String? = null,
    val items: String? = null, val itemsEn: String? = null,
    val categoryMajor: String? = null, val categoryMid: String? = null, val categorySub: String? = null,
    val categoryMajorEn: String? = null, val categoryMidEn: String? = null, val categorySubEn: String? = null,
    val menus: List<String> = emptyList(), val dishes: List<String> = emptyList(), val dishesEn: List<String> = emptyList(),
    val membership: String = "UNKNOWN", val nearby: Boolean = false,
    val location: GeoPoint? = null, val zoneId: Long? = null, val pathId: Long? = null,
    val roadAddress: String? = null, val jibunAddress: String? = null,
    val buildingName: String? = null, val dong: String? = null, val floor: String? = null, val ho: String? = null,
    val goodPrice: Boolean = false, val goodPriceMenus: List<String> = emptyList(), val sources: List<String> = emptyList(),
    val marketNameEn: String? = null, val region: String? = null, val marketType: String? = null,
    val attractionIdKo: Long? = null, val attractionIdEn: Long? = null,
)
