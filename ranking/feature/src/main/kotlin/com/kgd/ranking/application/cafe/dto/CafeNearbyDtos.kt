package com.kgd.ranking.application.cafe.dto

import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate

// Deliberately NOT data classes: generated toString/copy must never reveal user coordinates.
class CafeLocation(val kind: String, val lat: Double? = null, val lng: Double? = null, val areaCode: String? = null) {
    override fun toString() = "CafeLocation(redacted)"
}
class CafeNearbyRequest(
    val location: CafeLocation, val radiusKm: Double = 1.0,
    val group: String? = null, val q: String? = null, val brands: List<String> = emptyList(),
    val temperature: String? = null, val caffeineStatus: List<CaffeineStatus> = emptyList(),
    val maxSugar: BigDecimal? = null, val maxCaffeine: BigDecimal? = null,
    val basis: String = "serving", val sort: String = "distance", val direction: String = "asc",
    val selectedDrinkKeys: List<String> = emptyList(), val page: Int = 0, val size: Int = 20,
    val drinkName: String? = null, val caffeine: String? = null,
) { override fun toString() = "CafeNearbyRequest(redacted)" }

data class CafeStoreRecord(
    val storeKey: String, val brandSlug: String?, val brandName: String?, val storeName: String,
    val branchName: String?, val address: String, val latitude: Double, val longitude: Double,
    val areaCode: String?, val mappingStatus: String, val raw: Map<String, Any?>,
    val missingRounds: Int = 0,
)
data class CafeArea(
    val code: String, val name: String, val level: String, val parentCode: String?,
    val latitude: Double?, val longitude: Double?, val centerSource: String,
    val coverage: String = "SUPPORTED", val sourceAsOf: LocalDate? = null,
    val codeSystem: String = "KR_SIGUNGU_UPPER_10",
)
data class CafeStoreSnapshot(
    val version: String, val complete: Boolean, val sourceAsOf: LocalDate?, val fetchedAt: Instant,
    val mappingRuleVersion: String, val stores: List<CafeStoreRecord>, val areas: List<CafeArea> = emptyList(),
    val sourceTotal: Int, val receivedTotal: Int,
)
data class CafeSnapshotMeta(val version: String, val sourceAsOf: LocalDate?, val fetchedAt: Instant, val projectionAsOf: Instant, val mappingRuleVersion: String)
data class CafeNearbyCapability(val nearbyEnabled: Boolean, val reason: String, val sourceAsOf: LocalDate?, val fetchedAt: Instant?)
data class CafeCoverage(val status: String, val reason: String, val brands: List<String>)
data class CafeNearbyItem(
    val storeKey: String, val brandSlug: String, val brandName: String, val storeName: String,
    val branchName: String?, val address: String, val latitude: Double, val longitude: Double,
    val distanceM: Long, val mappingStatus: String, val selectedDrink: CafeDrinkResponse?,
    val variants: List<CafeDrinkResponse>, val selectionRequired: Boolean, val autoSelected: Boolean,
    val sourceAsOf: LocalDate?, val menuAvailability: String = "UNVERIFIED",
)
data class CafeNearbyResult(
    val basis: String, val sort: String, val radiusKm: Double, val locationKind: String, val areaLabel: String?,
    val coverage: CafeCoverage, val storeSource: String, val storeSourceAsOf: LocalDate?, val storeFetchedAt: Instant,
    val projectionAsOf: Instant, val mappingRuleVersion: String, val totalStores: Int?, val matchedBrands: Int,
    val page: Int, val size: Int, val hasNext: Boolean, val items: List<CafeNearbyItem>,
    val nearbyStoresWithoutNutrition: Int = 0,
)
