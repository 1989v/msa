package com.kgd.ranking.application.cafe.service

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.port.CafeDrinkRepositoryPort
import com.kgd.ranking.application.cafe.port.CafeStoreRepositoryPort
import com.kgd.ranking.application.cafe.usecase.*
import com.kgd.ranking.domain.cafe.model.CafeGeo
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.Clock
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@Service
class CafeNearbyService(
    private val stores: CafeStoreRepositoryPort, private val drinks: CafeDrinkRepositoryPort,
    @Value("\${ranking.cafe.nearby-verified:false}") private val verified: Boolean = false,
) : GetCafeNearbyUseCase, SyncCafeStoresUseCase {
    private val clock = Clock.systemUTC()
    private fun age(meta: CafeSnapshotMeta) = ChronoUnit.DAYS.between(meta.sourceAsOf ?: meta.fetchedAt.atZone(clock.zone).toLocalDate(), LocalDate.now(clock))
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun capability(): CafeNearbyCapability {
        val meta = stores.metadata()
        val regionsReady = stores.areas(null).isNotEmpty()
        val enabled = verified && regionsReady && meta != null && age(meta) <= 90
        return CafeNearbyCapability(enabled, when { meta == null -> "SOURCE_NOT_READY"; !verified -> "VALIDATION_PENDING"; !regionsReady -> "AREAS_NOT_READY"; age(meta) > 90 -> "EXPIRED"; age(meta) > 45 -> "STALE"; else -> "READY" }, meta?.sourceAsOf, meta?.fetchedAt)
    }
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun areas(parent: String?) = if (capability().nearbyEnabled) stores.areas(parent) else emptyList()

    @Transactional("rankingTransactionManager")
    override fun sync(snapshot: CafeStoreSnapshot): Int {
        require(snapshot.complete && snapshot.sourceTotal > 0 && snapshot.sourceTotal == snapshot.receivedTotal)
        require(snapshot.version.matches(Regex("[A-Za-z0-9._-]{1,80}")))
        require(snapshot.stores.isNotEmpty() && snapshot.stores.size <= 100000)
        require(snapshot.stores.distinctBy { it.storeKey }.size == snapshot.stores.size)
        require(snapshot.fetchedAt <= clock.instant().plusSeconds(300))
        require(snapshot.sourceAsOf == null || snapshot.sourceAsOf <= LocalDate.now(clock))
        require(snapshot.stores.all { it.storeKey.isNotBlank() && !it.storeKey.startsWith("SAMPLE") && it.latitude.isFinite() && it.longitude.isFinite() && it.latitude in 33.0..39.0 && it.longitude in 124.0..132.0 && it.mappingStatus in setOf("CONFIRMED", "REVIEW", "UNMAPPED") && (it.mappingStatus != "CONFIRMED" || it.brandSlug in BRANDS) && it.raw.isNotEmpty() })
        require(snapshot.areas.distinctBy { it.code }.size == snapshot.areas.size)
        require(snapshot.areas.filter { it.level == "DISTRICT" }.all { child -> snapshot.areas.any { it.code == child.parentCode && it.level == "PROVINCE" } })
        require(snapshot.areas.all { it.code.matches(Regex("[0-9]{10}")) && it.level in setOf("PROVINCE", "DISTRICT") && it.centerSource.startsWith("https://") && (it.latitude != null && it.longitude != null && it.latitude in 33.0..39.0 && it.longitude in 124.0..132.0) && (if (it.level == "DISTRICT") it.code.endsWith("00000") && it.parentCode == it.code.take(2) + "00000000" else it.code.drop(2) == "00000000") })
        return stores.replace(snapshot)
    }

    @Transactional("rankingTransactionManager", readOnly = true)
    override fun search(request: CafeNearbyRequest): CafeNearbyResult {
        if (!capability().nearbyEnabled) throw CafeNearbyUnavailable()
        val r = request
        if (r.radiusKm !in setOf(0.5, 1.0, 3.0) || r.page !in 0..1000 || r.size !in 1..50 || (r.brands + r.storeBrands).any { it !in BRANDS } || (r.q?.length ?: 0) > 120 || (r.drinkName?.length ?: 0) > 255 || r.selectedDrinkKeys.size > 9 || r.sort !in setOf("distance", "sugar", "caffeine", "kcal") || r.direction !in setOf("asc", "desc") || (r.group.isNullOrBlank() && r.groups.isEmpty() && r.drinkName.isNullOrBlank() && r.q.isNullOrBlank())) throw CafeNearbyInvalid()
        val query = try { CafeDrinkQuery(q = r.q, brands = r.brands, group = r.group, temperature = null, maxSugar = r.maxSugar, maxCaffeine = r.maxCaffeine, caffeine = r.caffeine, basis = r.basis, sort = if (r.sort == "distance") "sugar" else r.sort, caffeineStatus = r.caffeineStatus, maxKcal = r.maxKcal, sizeLabel = r.sizeLabel, groups = r.groups) } catch (_: IllegalArgumentException) { throw CafeNearbyInvalid() }
        val location = r.location
        val area = if (location.kind == "AREA") {
            if (location.lat != null || location.lng != null || location.areaCode == null) throw CafeNearbyInvalid()
            stores.area(location.areaCode) ?: throw CafeNearbyNotFound()
        } else null
        val lat: Double; val lng: Double
        if (area != null) { lat = area.latitude ?: throw CafeNearbyInvalid(); lng = area.longitude ?: throw CafeNearbyInvalid() }
        else {
            if (location.kind != "CURRENT" || location.areaCode != null) throw CafeNearbyInvalid()
            lat = location.lat ?: throw CafeNearbyInvalid(); lng = location.lng ?: throw CafeNearbyInvalid()
            if (!lat.isFinite() || !lng.isFinite() || lat !in -90.0..90.0 || lng !in -180.0..180.0) throw CafeNearbyInvalid()
        }
        val meta = stores.metadata() ?: throw CafeNearbyUnavailable()
        val selected = r.selectedDrinkKeys.map { drinks.find(it) ?: throw CafeNearbyNotFound() }
        if (selected.distinctBy { it.brandSlug }.size != selected.size) throw CafeNearbyInvalid()
        // Read every candidate variant before sorting/paging. No first-page approximation.
        val variants = mutableListOf<CafeDrinkResponse>()
        if (r.drinkName != null) variants += drinks.variants(r.drinkName)
        else { var page = 0; do { val found = drinks.search(query.copy(page = page, size = 200)); variants += found.content; page++ } while (page * 200 < found.totalElements) }
        val eligible = variants.filter { d ->
            (r.brands.isEmpty() || d.brandSlug in r.brands) && (query.selectedGroups.isEmpty() || d.drinkGroup in query.selectedGroups) &&
            (r.temperature == null || d.drinkKey in r.selectedDrinkKeys || d.temperature == r.temperature || variants.none { it.brandSlug == d.brandSlug && it.drinkName == d.drinkName && it.temperature == r.temperature }) && (r.caffeineStatus.isEmpty() || d.caffeineStatus in r.caffeineStatus) &&
            (r.sizeLabel == null || d.sizeLabel == r.sizeLabel) &&
            (r.maxKcal == null || d.kcal?.let { it <= r.maxKcal } == true) &&
            (r.maxSugar == null || d.sugarG?.let { it <= r.maxSugar } == true) &&
            (r.maxCaffeine == null || (d.caffeineStatus != CaffeineStatus.UNDISCLOSED && d.caffeineMg?.let { it <= r.maxCaffeine } == true)) &&
            (r.caffeine == null || when (r.caffeine) { "none" -> d.caffeineStatus in setOf(CaffeineStatus.ZERO, CaffeineStatus.DECAF); "zero" -> d.caffeineStatus == CaffeineStatus.ZERO; else -> d.caffeineStatus == CaffeineStatus.DECAF })
        }.distinctBy { it.drinkKey }.groupBy { it.brandSlug }
        if (selected.any { d -> eligible[d.brandSlug]?.none { it.drinkKey == d.drinkKey } != false }) throw CafeNearbyInvalid()
        val latDelta = CafeGeo.latitudeDelta(r.radiusKm); val lngDelta = CafeGeo.longitudeDelta(r.radiusKm, lat)
        val candidateRows = if (lat in 33.0..39.0 && lng in 124.0..132.0) stores.candidates(lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta, 5001) else emptyList()
        val limited = candidateRows.size > 5000
        val withoutNutrition = candidateRows.take(5000).count { s ->
            (r.brands.isEmpty() || s.brandSlug in r.brands) && eligible[s.brandSlug].isNullOrEmpty() &&
                CafeGeo.distanceM(lat, lng, s.latitude, s.longitude) <= r.radiusKm * 1000
        }
        val rows = candidateRows.take(5000).mapNotNull { s ->
            val options = eligible[s.brandSlug] ?: return@mapNotNull null
            val distance = CafeGeo.distanceM(lat, lng, s.latitude, s.longitude)
            if (distance > r.radiusKm * 1000) return@mapNotNull null
            val explicit = selected.find { it.brandSlug == s.brandSlug }
            val drink = explicit ?: options.singleOrNull()
            CafeNearbyItem(s.storeKey, s.brandSlug!!, s.brandName ?: s.storeName, s.storeName, s.branchName, s.address, s.latitude, s.longitude, distance.toLong(), s.mappingStatus, drink, options.sortedBy { it.drinkKey }, drink == null, explicit == null && drink != null, meta.sourceAsOf)
        }
        fun metric(item: CafeNearbyItem): Pair<BigDecimal, BigDecimal>? {
            val d = item.selectedDrink ?: return null
            val value = when (r.sort) { "caffeine" -> if (d.caffeineStatus == CaffeineStatus.UNDISCLOSED) null else d.caffeineMg; "kcal" -> d.kcal; else -> d.sugarG } ?: return null
            return value to if (r.basis == "100ml") d.cupVolumeMl?.takeIf { it.signum() > 0 } ?: return null else BigDecimal.ONE
        }
        val filtered = rows.filter { r.storeBrands.isEmpty() || it.brandSlug in r.storeBrands }
        val sorted = filtered.sortedWith { a, b ->
            val comparison = if (r.sort == "distance") a.distanceM.compareTo(b.distanceM) else {
                val l = metric(a); val v = metric(b)
                when { l == null && v == null -> 0; l == null -> 1; v == null -> -1; else -> (l.first * v.second).compareTo(v.first * l.second) * if (r.direction == "desc") -1 else 1 }
            }
            comparison.takeIf { it != 0 } ?: a.distanceM.compareTo(b.distanceM).takeIf { it != 0 } ?: a.storeKey.compareTo(b.storeKey)
        }
        val status = when { limited -> "LIMITED"; lat !in 33.0..39.0 || lng !in 124.0..132.0 -> "UNSUPPORTED"; age(meta) > 45 -> "STALE"; else -> "SUPPORTED" }
        return CafeNearbyResult(r.basis, r.sort, r.radiusKm, location.kind, area?.name, CafeCoverage(status, if (meta.sourceAsOf == null) "SOURCE_DATE_UNKNOWN; fetched-date age used" else "Nationwide source; mapped brands only", eligible.keys.sorted()), "소상공인시장진흥공단 상가정보", meta.sourceAsOf, meta.fetchedAt, meta.projectionAsOf, meta.mappingRuleVersion, if (limited) null else filtered.size, filtered.map { it.brandSlug }.distinct().size, r.page, r.size, (r.page + 1) * r.size < filtered.size, sorted.drop(r.page * r.size).take(r.size), nearbyStoresWithoutNutrition = withoutNutrition, brandCounts = rows.groupBy { it.brandSlug }.map { (slug, stores) -> CafeSearchBrandCount(slug, stores.first().brandName, stores.size) }.sortedBy { it.brandSlug })
    }
    companion object { val BRANDS = setOf("starbucks", "mega", "compose", "paik", "ediya", "twosome", "theventi", "dunkin", "parisbaguette", "gongcha", "paulbassett", "hollys", "pascucci", "uzi", "mammoth", "mammothexpress") }
}
