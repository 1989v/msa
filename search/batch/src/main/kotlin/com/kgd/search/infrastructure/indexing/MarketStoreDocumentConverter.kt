package com.kgd.search.infrastructure.indexing

import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode

@Component
class MarketStoreDocumentConverter {
    fun convert(ko: JsonNode, en: JsonNode, dictionary: JsonNode, metadataKo: JsonNode? = null, metadataEn: JsonNode? = null): List<MarketStoreIndexDocument> {
        val english = en.path("stores").associateBy { it.path("id").asLong() }
        return ko.path("stores").toList().map { store ->
            val id = requireNotNull(store.get("id")?.takeUnless { it.isNull }) { "Store ID missing" }.asLong()
            val translated = english[id] ?: store
            val categoryMajor = store.text("categoryMajor")
            val categoryMid = store.text("categoryMid")
            val categorySub = store.text("categorySub")
            val categoryEn = translated.text("categoryEn") ?: store.text("categoryEn")
            val menus = (listOfNotNull(store.path("tourMenu").text("firstMenu"), store.path("tourMenu").text("treatMenu"),
                translated.path("tourMenu").text("firstMenuEn"), translated.path("tourMenu").text("treatMenuEn")) +
                store.path("goodPrice").path("menus").mapNotNull { it.text("name") }).distinct()
            val items = store.text("items")
            val searchable = (listOfNotNull(items, categoryMajor, categoryMid, categorySub) + menus).joinToString(" ")
                .replace(Regex("\\s+"), "")
            val dishes = dictionary.filter { dish ->
                val term = dish.text("dish")
                val category = dish.text("categorySub")
                (term != null && searchable.contains(term.replace(" ", ""))) ||
                    (category != null && category == categorySub)
            }
            val lat = store.get("latitude")?.takeUnless { it.isNull }?.asDouble()
            val lon = store.get("longitude")?.takeUnless { it.isNull }?.asDouble()
            MarketStoreIndexDocument(
                contentId = ko.path("market").path("contentId").asText(), marketName = ko.path("market").path("name").asText(),
                storeId = id, name = store.path("name").asText(), nameRoman = store.text("nameRoman"),
                nameEn = translated.text("nameEn") ?: store.text("nameEn"), items = items,
                itemsEn = translated.text("itemsEn") ?: store.text("itemsEn"),
                categoryMajor = categoryMajor, categoryMid = categoryMid, categorySub = categorySub,
                categorySubEn = categoryEn.takeIf { categorySub != null },
                categoryMidEn = categoryEn.takeIf { categorySub == null && categoryMid != null },
                categoryMajorEn = categoryEn.takeIf { categorySub == null && categoryMid == null },
                menus = menus, dishes = dishes.mapNotNull { it.text("dish") }.distinct(),
                dishesEn = dishes.mapNotNull { it.text("dishEn") }.distinct(),
                membership = store.path("membership").asText("UNKNOWN"), nearby = store.path("nearby").asBoolean(false),
                location = if (lat != null && lon != null && lat.isFinite() && lon.isFinite() && lat in -90.0..90.0 && lon in -180.0..180.0) GeoPoint(lat, lon) else null,
                zoneId = store.get("zoneId")?.takeUnless { it.isNull }?.asLong(),
                roadAddress = store.text("roadAddress"), jibunAddress = store.text("jibunAddress"),
                buildingName = store.text("buildingName"), dong = store.text("dong"), floor = store.text("floor"), ho = store.text("ho"),
                goodPrice = store.get("goodPrice")?.let { !it.isNull } ?: false,
                goodPriceMenus = store.path("goodPrice").path("menus").mapNotNull { it.text("name") },
                sources = store.path("sources").toList().map { it.asText() },
                marketNameEn = en.path("market").text("nameEn"),
                region = metadataKo?.text("region"), marketType = ko.path("market").text("marketType"),
                attractionIdKo = metadataKo.attractionId("ko"), attractionIdEn = metadataEn.attractionId("en"),
                pathId = store.get("pathId")?.takeUnless { it.isNull }?.asLong(),
            )
        }
    }
    private fun JsonNode?.attractionId(lang: String): Long? = this?.path("attraction")
        ?.takeIf { it.path("lang").asText() == lang }?.get("id")?.takeUnless { it.isNull }?.asLong()
    private fun JsonNode.text(field: String): String? = get(field)?.takeUnless { it.isNull }?.asText()?.takeIf { it.isNotBlank() }
}
