package com.kgd.search.infrastructure.opensearch

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class MarketStoreSearchDocument(
    val contentId: String = "", val marketName: String = "", val storeId: Long = 0,
    val name: String = "", val nameRoman: String? = null, val nameEn: String? = null,
    val items: String? = null, val itemsEn: String? = null,
    val categoryMajor: String? = null, val categoryMid: String? = null, val categorySub: String? = null,
    val categoryMajorEn: String? = null, val categoryMidEn: String? = null, val categorySubEn: String? = null,
    val menus: List<String> = emptyList(), val dishes: List<String> = emptyList(), val dishesEn: List<String> = emptyList(),
    val membership: String = "UNKNOWN", val nearby: Boolean = false,
    val location: GeoPoint? = null, val zoneId: Long? = null, val pathId: Long? = null,
)
