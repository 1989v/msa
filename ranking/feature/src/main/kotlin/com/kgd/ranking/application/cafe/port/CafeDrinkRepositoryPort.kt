package com.kgd.ranking.application.cafe.port

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.domain.cafe.model.CafeDrink

interface CafeDrinkRepositoryPort {
    fun deleteByBrands(brands: Set<String>)
    fun saveAll(drinks: List<CafeDrink>)
    fun search(query: CafeDrinkQuery): CafeDrinkPage
    fun find(drinkKey: String): CafeDrinkResponse?
    fun groups(): List<CafeGroupCount>
    fun brands(): List<CafeBrandCount>
}
