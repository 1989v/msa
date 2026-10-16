package com.kgd.place.application.market.usecase

interface MarketDishUseCase {
    fun dishes(): List<Dish>
    data class Dish(val dish: String, val categorySub: String, val dishEn: String)
}
