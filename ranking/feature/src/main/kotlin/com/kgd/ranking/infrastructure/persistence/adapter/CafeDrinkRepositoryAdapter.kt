package com.kgd.ranking.infrastructure.persistence.adapter

import com.kgd.ranking.application.cafe.dto.CafeDrinkQuery
import com.kgd.ranking.application.cafe.port.CafeDrinkRepositoryPort
import com.kgd.ranking.domain.cafe.model.CafeDrink
import com.kgd.ranking.infrastructure.persistence.entity.CafeDrinkJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.CafeDrinkJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.CafeDrinkQueryRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component

@Component
class CafeDrinkRepositoryAdapter(
    private val repository: CafeDrinkJpaRepository,
    private val queryRepository: CafeDrinkQueryRepository,
) : CafeDrinkRepositoryPort {
    override fun deleteByBrands(brands: Set<String>) {
        repository.deleteByBrandSlugIn(brands)
        // Flush deleted rows before inserting the same unique keys in this transaction.
        repository.flush()
    }
    override fun saveAll(drinks: List<CafeDrink>) {
        repository.saveAll(drinks.map(CafeDrinkJpaEntity::fromDomain))
    }
    override fun search(query: CafeDrinkQuery) = queryRepository.search(query, PageRequest.of(query.page, query.size))
    override fun find(drinkKey: String) = queryRepository.find(drinkKey)
    override fun groups() = queryRepository.groups()
    override fun brands() = queryRepository.brands()
}
