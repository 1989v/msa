package com.kgd.place.application.market.service

import com.kgd.place.application.market.usecase.MarketDishUseCase
import org.springframework.stereotype.Component
import java.text.Normalizer
import java.util.Locale

@Component
class MarketDishDictionary : MarketDishUseCase {
    private val entries = requireNotNull(javaClass.getResourceAsStream("/market/dishes.csv"))
        .bufferedReader().useLines { lines -> lines.drop(1).filter { it.isNotBlank() }.map { line ->
            val columns = line.split(',')
            require(columns.size == 3 && columns.none { it.isBlank() }) { "Invalid dish dictionary row" }
            MarketDishUseCase.Dish(columns[0], columns[1], columns[2])
        }.toList() }
    override fun dishes() = entries
    fun categories(query: String): Set<String> = entries.filter {
        normalize(it.dish) == normalize(query) || normalize(it.dishEn) == (if (normalize(query) == "kimbap") "gimbap" else normalize(query))
    }.map { it.categorySub }.toSet()
    companion object {
        fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC)
            .lowercase(Locale.ROOT).replace(Regex("[\\s\\p{Z}]+"), "")
    }
}
