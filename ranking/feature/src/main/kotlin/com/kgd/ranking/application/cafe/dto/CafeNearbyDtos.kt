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
    val maxKcal: BigDecimal? = null, val sizeLabel: String? = null,
    val groups: List<String> = emptyList(),
    val storeBrands: List<String> = emptyList(),
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
) {
    /** Query-only presentation; the source trade and branch names remain unchanged. */
    val displayName: String get() {
        val raw = storeName.trim()
        val branch = branchName?.trim().orEmpty()
        val aliases = STORE_ALIASES[brandSlug].orEmpty().sortedByDescending { it.length }
        val alias = aliases.firstOrNull { raw.startsWith(it, ignoreCase = true) }
            ?: return listOf(raw, branch).filter { it.isNotEmpty() }.distinct().joinToString(" · ")
        val remainder = raw.substring(alias.length).trim()
        val local = when {
            branch.isEmpty() -> remainder
            remainder.isEmpty() || remainder == branch -> branch
            remainder.endsWith(branch) -> remainder
            branch.endsWith(remainder) -> branch
            // Conflicting complete branches cannot safely be concatenated.
            remainder.endsWith("점") && branch.endsWith("점") -> return "$raw · $branch"
            remainder.endsWith("점") -> branch + remainder
            else -> remainder + branch
        }
        return listOf(brandName, local).filter { it.isNotBlank() }.joinToString(" ")
    }

    private companion object {
        val STORE_ALIASES = mapOf(
            "starbucks" to listOf("스타벅스", "starbucks"),
            "mega" to listOf("메가MGC커피", "메가엠지씨커피", "메가커피", "megamgccoffee", "megacoffee"),
            "compose" to listOf("컴포즈커피", "composecoffee"),
            "paik" to listOf("빽다방", "paikdabang"),
            "ediya" to listOf("이디야커피", "이디야", "ediya"),
            "twosome" to listOf("투썸플레이스", "atwosomeplace", "twosomeplace"),
            "theventi" to listOf("더벤티", "theventi"),
            "dunkin" to listOf("던킨도너츠", "던킨", "dunkindonuts", "dunkin"),
            "parisbaguette" to listOf("파리바게뜨", "파리바게트", "parisbaguette"),
            "gongcha" to listOf("공차", "gongcha"),
            "paulbassett" to listOf("폴바셋", "바리스타폴바셋", "paulbassett"),
            "hollys" to listOf("할리스커피", "할리스", "hollyscoffee", "hollys"),
            "pascucci" to listOf("카페파스쿠찌", "파스쿠찌", "caffepascucci", "pascucci"),
            "uzi" to listOf("우지커피", "oozycoffee"),
            "mammoth" to listOf("매머드커피", "mammothcoffee"),
            "mammothexpress" to listOf("매머드익스프레스", "mammothexpress"),
            "coffeebean" to listOf("커피빈", "coffeebean"),
            "dalkomm" to listOf("달콤커피", "dalkommcoffee", "dalkomm"),
            "coffeebanhada" to listOf("커피에반하다", "coffeebanhada"),
        )
    }
}
data class CafeNearbyResult(
    val basis: String, val sort: String, val radiusKm: Double, val locationKind: String, val areaLabel: String?,
    val coverage: CafeCoverage, val storeSource: String, val storeSourceAsOf: LocalDate?, val storeFetchedAt: Instant,
    val projectionAsOf: Instant, val mappingRuleVersion: String, val totalStores: Int?, val matchedBrands: Int,
    val page: Int, val size: Int, val hasNext: Boolean, val items: List<CafeNearbyItem>,
    val nearbyStoresWithoutNutrition: Int = 0,
    val brandCounts: List<CafeSearchBrandCount> = emptyList(),
)
