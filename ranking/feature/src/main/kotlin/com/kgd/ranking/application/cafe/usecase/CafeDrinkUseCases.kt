package com.kgd.ranking.application.cafe.usecase

import com.kgd.ranking.application.cafe.dto.*

interface SyncCafeDrinksUseCase {
    fun execute(request: CafeDrinkBulkRequest): CafeDrinkBulkResult
}
interface GetCafeDrinksUseCase {
    fun execute(query: CafeDrinkQuery): CafeDrinkPage
    fun find(drinkKey: String): CafeDrinkResponse?
    fun names(q: String): List<CafeDrinkNameCount>
    fun compare(name: String, query: CafeDrinkQuery): List<CafeDrinkBrandVariants>
    fun groups(): List<CafeGroupCount>
    fun brands(): List<CafeBrandCount>
}
