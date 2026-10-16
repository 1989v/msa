package com.kgd.place.application.market.service

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component

/** Reviewed fixed labels. Unknown source values deliberately remain untranslated. */
@Component
class MarketEnglishDictionary {
    private val log = KotlinLogging.logger {}
    private val categories = read("categories-en.csv")
    private val items = read("items-en.csv")
    private val dishes = MarketDishDictionary().dishes().associate { it.dish to it.dishEn }

    fun category(value: String?): String? = categories[value]
    fun items(value: String?): String? = items[value] ?: dishes[value]
    fun categoryLabels(query: String): Set<String> = categories.filterValues {
        MarketDishDictionary.normalize(it).contains(MarketDishDictionary.normalize(query))
    }.keys
    fun warnMissing(values: Collection<String>) {
        values.filter { it !in categories }.distinct().sorted().forEach { log.warn { "Missing market English category label: $it" } }
    }
    private fun read(file: String): Map<String, String> = requireNotNull(javaClass.getResourceAsStream("/market/$file"))
        .bufferedReader().useLines { lines -> lines.drop(1).filter { it.isNotBlank() }.map { row ->
            // Split at the last comma: Korean source labels may themselves contain commas.
            row.substringBeforeLast(',').removeSurrounding("\"") to row.substringAfterLast(',')
        }.toList().also { rows -> require(rows.all { it.first.isNotBlank() && it.second.isNotBlank() })
            require(rows.map { it.first }.distinct().size == rows.size) }.toMap() }

    companion object { val DEFAULT = MarketEnglishDictionary() }
}
