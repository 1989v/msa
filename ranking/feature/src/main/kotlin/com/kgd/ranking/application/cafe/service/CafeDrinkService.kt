package com.kgd.ranking.application.cafe.service

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.port.CafeDrinkRepositoryPort
import com.kgd.ranking.application.cafe.usecase.GetCafeDrinksUseCase
import com.kgd.ranking.application.cafe.usecase.SyncCafeDrinksUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class CafeDrinkService(private val repository: CafeDrinkRepositoryPort) : SyncCafeDrinksUseCase, GetCafeDrinksUseCase {
    @Transactional("rankingTransactionManager")
    override fun execute(request: CafeDrinkBulkRequest): CafeDrinkBulkResult {
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
    override fun groups() = repository.groups()
    @Transactional("rankingTransactionManager", readOnly = true)
    override fun brands() = repository.brands()
}
