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
                (query.temperature == null || it.temperature == query.temperature) &&
                (query.caffeineStatus.isEmpty() || it.caffeineStatus in query.caffeineStatus) &&
                (query.caffeine == null || when (query.caffeine) { "none" -> it.caffeineStatus.name in setOf("ZERO", "DECAF"); "zero" -> it.caffeineStatus.name == "ZERO"; else -> it.caffeineStatus.name == "DECAF" }) &&
                (query.selectedGroups.isEmpty() || it.drinkGroup in query.selectedGroups) &&
                (query.maxSugar == null || it.sugarG?.let { value -> value <= query.maxSugar } == true) &&
                (query.maxCaffeine == null || (it.caffeineStatus != com.kgd.ranking.domain.cafe.model.CaffeineStatus.UNDISCLOSED && it.caffeineMg?.let { value -> value <= query.maxCaffeine } == true))
        }.groupBy { it.brandSlug }.map { (brand, rows) ->
            // A published basic size first; this selection never depends on nutrient values.
            val variants = rows.sortedWith(compareBy<CafeDrinkResponse>(
                { when (it.sizeLabel?.uppercase()) { null, "", "R", "REGULAR", "TALL" -> 0; "S", "SHORT" -> 1; "M" -> 2; "L", "LARGE", "GRANDE" -> 3; else -> 4 } },
                { when (it.temperature) { "ICE" -> 0; "HOT" -> 1; else -> 2 } },
                { if (it.caffeineStatus == com.kgd.ranking.domain.cafe.model.CaffeineStatus.DECAF) 1 else 0 },
                { it.menuName }, { it.sizeLabel.orEmpty() }, { it.drinkKey },
            ))
            CafeDrinkBrandVariants(brand, variants.first().brandName, variants.first(), variants)
        }
        // Keep ratios exact for ordering; DTO concentrations are rounded for transport/display.
        fun metric(row: CafeDrinkResponse): Pair<java.math.BigDecimal, java.math.BigDecimal>? {
            val numerator = when (query.sort) {
                "caffeine" -> if (row.caffeineStatus == com.kgd.ranking.domain.cafe.model.CaffeineStatus.UNDISCLOSED) null else row.caffeineMg
                "kcal" -> row.kcal
                else -> row.sugarG
            } ?: return null
            val denominator = if (query.basis == "100ml" || query.sort == "sugarPer100ml")
                row.cupVolumeMl?.takeIf { it.signum() > 0 } ?: return null
            else java.math.BigDecimal.ONE
            return numerator to denominator
        }
        return groups.sortedWith { a, b ->
            val left = metric(a.representative); val right = metric(b.representative)
            when { left == null && right == null -> a.brandSlug.compareTo(b.brandSlug); left == null -> 1; right == null -> -1
                else -> ((left.first * right.second).compareTo(right.first * left.second) * if (query.direction == "desc") -1 else 1).takeIf { it != 0 } ?: a.brandSlug.compareTo(b.brandSlug) }
        }
    }
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun groups() = repository.groups()
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun brands() = repository.brands()
}
