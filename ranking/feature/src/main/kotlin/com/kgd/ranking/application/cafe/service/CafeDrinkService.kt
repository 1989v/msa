package com.kgd.ranking.application.cafe.service

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.port.CafeDrinkRepositoryPort
import com.kgd.ranking.application.cafe.usecase.GetCafeDrinksUseCase
import com.kgd.ranking.application.cafe.usecase.SyncCafeDrinksUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class CafeDrinkService(private val repository: CafeDrinkRepositoryPort, private val adminIngest: com.kgd.ranking.application.admin.usecase.CafeAdminIngestUseCase? = null) : SyncCafeDrinksUseCase, GetCafeDrinksUseCase {
    override fun execute(request: CafeDrinkBulkRequest): CafeDrinkBulkResult {
        adminIngest?.let { return it.sync(request) }
        val drinks = request.drinks.map { it.toDomain() }
        require(drinks.all { it.brandSlug.isNotBlank() && it.menuName.isNotBlank() }) { "Brand and menu required" }
        require(drinks.distinctBy { listOf(it.brandSlug, it.menuName, it.temperature.orEmpty(), it.sizeLabel.orEmpty(), it.caffeineStatus.name) }.size == drinks.size) {
            "Duplicate brand/menu/temperature/size/caffeineStatus"
        }
        val brands = drinks.map { it.brandSlug }.toSet()
        if (brands.isNotEmpty()) {
            repository.deleteByBrands(brands)
            repository.saveAll(drinks)
        }
        return CafeDrinkBulkResult(drinks.size, brands)
    }

    @Transactional("rankingTransactionManager", readOnly = true)
    override fun execute(query: CafeDrinkQuery) = repository.search(query)
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun find(drinkKey: String) = repository.find(drinkKey)
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun names(q: String) = repository.names(q.take(120))
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun compare(name: String, query: CafeDrinkQuery): List<CafeDrinkBrandVariants> {
        val groups = repository.variants(name).filter {
            (query.brands.isEmpty() || it.brandSlug in query.brands) &&
                (query.caffeineStatus.isEmpty() || it.caffeineStatus in query.caffeineStatus) &&
                (query.caffeine == null || when (query.caffeine) { "none" -> it.caffeineStatus.name in setOf("ZERO", "DECAF"); "zero" -> it.caffeineStatus.name == "ZERO"; else -> it.caffeineStatus.name == "DECAF" }) &&
                (query.selectedGroups.isEmpty() || it.drinkGroup in query.selectedGroups) &&
                (query.sizeLabel == null || it.sizeLabel == query.sizeLabel) &&
                (query.maxKcal == null || it.kcal?.let { value -> value <= query.maxKcal } == true) &&
                (query.maxSugar == null || it.sugarG?.let { value -> value <= query.maxSugar } == true) &&
                (query.maxCaffeine == null || (it.caffeineStatus != com.kgd.ranking.domain.cafe.model.CaffeineStatus.UNDISCLOSED && it.caffeineMg?.let { value -> value <= query.maxCaffeine } == true))
        }.groupBy { it.brandSlug }.map { (brand, rows) ->
            val variants = rows.sortedWith(representativeOrder(query.temperature))
            CafeDrinkBrandVariants(brand, variants.first().brandName, variants.first(), variants)
        }
        val order = metricOrder(query)
        return groups.sortedWith { a, b -> order.compare(a.representative, b.representative) }
    }
    /** Group the entire matching catalogue before sorting/paging; pages count brands. */
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun grouped(query: CafeDrinkQuery): CafeDrinkPage {
        val all = mutableListOf<CafeDrinkResponse>()
        var page = 0
        do {
            val found = repository.search(query.copy(page = page, size = 200, temperature = null, brands = emptyList()))
            all += found.content
            page++
        } while (page * 200 < found.totalElements)
        val order = metricOrder(query)
        val brands = all.groupBy { it.brandSlug }.map { (slug, rows) ->
            val menus = rows.groupBy { it.drinkName.ifBlank { it.menuName } }.map { (_, variants) ->
                val sorted = variants.sortedWith(representativeOrder(query.temperature))
                CafeDrinkBrandVariants(slug, sorted.first().brandName, sorted.first(), sorted)
            }.sortedWith { a, b -> order.compare(a.representative, b.representative) }
            CafeSearchBrand(slug, menus.first().brandName, menus)
        }.sortedWith { a, b -> order.compare(a.menus.first().representative, b.menus.first().representative) }
        val matching = brands.filter { query.brands.isEmpty() || it.brandSlug in query.brands }
        val slice = matching.drop(query.page * query.size).take(query.size)
        return CafeDrinkPage(slice.flatMap { it.menus.map { menu -> menu.representative } }, matching.size.toLong(), query.page, query.size,
            all.mapNotNull { it.sizeLabel }.distinct().sorted(), slice, matching.sumOf { it.menus.size },
            brands.map { CafeSearchBrandCount(it.brandSlug, it.brandName, it.menus.size) })
    }

    private fun representativeOrder(temperature: String?) = compareBy<CafeDrinkResponse>(
        { if (it.caffeineStatus == com.kgd.ranking.domain.cafe.model.CaffeineStatus.DECAF) 1 else 0 },
        { if (it.temperature == (temperature ?: "ICE")) 0 else if (it.temperature in setOf("ICE", "HOT")) 1 else 2 },
        { it.cupVolumeMl?.takeIf { volume -> volume.signum() > 0 } ?: java.math.BigDecimal.valueOf(Long.MAX_VALUE) },
        { when (it.sizeLabel?.uppercase()?.substringBefore("(")) { "S", "SHORT" -> 0; "R", "REGULAR", "TALL", null, "" -> 1; "M" -> 2; "L", "LARGE", "GRANDE" -> 3; else -> 4 } },
        { it.sizeLabel.orEmpty() }, { it.drinkKey },
    )

    private fun metricOrder(query: CafeDrinkQuery): Comparator<CafeDrinkResponse> {
        fun value(row: CafeDrinkResponse): Pair<java.math.BigDecimal, java.math.BigDecimal>? {
            val numerator = when (query.sort) { "caffeine" -> if (row.caffeineStatus == com.kgd.ranking.domain.cafe.model.CaffeineStatus.UNDISCLOSED) null else row.caffeineMg; "kcal" -> row.kcal; else -> row.sugarG } ?: return null
            val denominator = if (query.basis == "100ml" || query.sort == "sugarPer100ml") row.cupVolumeMl?.takeIf { it.signum() > 0 } ?: return null else java.math.BigDecimal.ONE
            return numerator to denominator
        }
        return Comparator { a, b ->
            val left = value(a); val right = value(b)
            val cmp = when { left == null && right == null -> 0; left == null -> 1; right == null -> -1; else -> (left.first * right.second).compareTo(right.first * left.second) * if (query.direction == "desc") -1 else 1 }
            cmp.takeIf { it != 0 } ?: compareValuesBy(a, b, { it.brandSlug }, { it.drinkName }, { it.drinkKey })
        }
    }
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun groups() = repository.groups()
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun brands() = repository.brands()
}
