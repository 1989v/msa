package com.kgd.place.application.market.dto

import com.kgd.place.domain.market.model.GoodPriceMenu
import tools.jackson.databind.json.JsonMapper

/** Decode the retained source once at each application boundary, without exposing it publicly. */
object GoodPriceProjection {
    private val json = JsonMapper.builder().build()

    data class Details(val category: String?, val menus: List<GoodPriceMenu>)

    fun from(raw: String?): Details? {
        if (raw == null) return null
        val source = json.readTree(raw)
        require(source.isObject) { "Good-price source must be a JSON object" }
        val fields = (listOf("업종") + (1..4).flatMap { listOf("메뉴$it", "가격$it") }).associateWith { key ->
            source[key]?.takeUnless { it.isNull }?.asText()
        }
        return Details(fields["업종"], GoodPriceMenu.from(fields))
    }
}
