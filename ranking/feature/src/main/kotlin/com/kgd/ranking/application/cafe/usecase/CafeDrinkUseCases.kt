package com.kgd.ranking.application.cafe.usecase

import com.kgd.ranking.application.cafe.dto.*

interface SyncCafeDrinksUseCase {
    fun execute(request: CafeDrinkBulkRequest): CafeDrinkBulkResult
}
interface GetCafeDrinksUseCase {
    fun execute(query: CafeDrinkQuery): CafeDrinkPage
    fun groups(): List<CafeGroupCount>
    fun brands(): List<CafeBrandCount>
}
