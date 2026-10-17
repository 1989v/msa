package com.kgd.search.infrastructure.indexing

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.ObjectMapper

class MarketStoreDocumentConverterTest : BehaviorSpec({
    val mapper = ObjectMapper()
    val converter = MarketStoreDocumentConverter()
    val ko = mapper.readTree("""{"market":{"contentId":"34550","name":"남대문시장"},"stores":[
        {"id":1,"name":"할머니집","items":"순대 국밥","categorySub":"한식","membership":"UNKNOWN","zoneId":3,"pathId":4,
         "goodPrice":{"menus":[{"name":"칼국수","price":5000}]},"tourMenu":{"firstMenu":"떡볶이"}}]}""")
    val en = mapper.readTree("""{"stores":[{"id":1,"nameEn":"Grandma Kitchen","itemsEn":"sundae soup","categoryEn":"Korean food"}]}""")
    val dictionary = mapper.readTree("""[{"dish":"순대국밥","categorySub":"국밥","dishEn":"sundae soup"},
        {"dish":"떡볶이","categorySub":"분식","dishEn":"tteokbokki"}]""")
    given("bilingual public projections") {
        val doc = converter.convert(ko, en, dictionary).single()
        then("merge by store id, expand sole API dictionary including spacing") {
            doc.nameEn shouldBe "Grandma Kitchen"
            doc.itemsEn shouldBe "sundae soup"
            doc.dishes shouldBe listOf("순대국밥", "떡볶이")
            doc.dishesEn shouldBe listOf("sundae soup", "tteokbokki")
            doc.categorySubEn shouldBe "Korean food"
            doc.menus shouldBe listOf("떡볶이", "칼국수")
        }
        then("missing coordinates keep document and omit location; unknown roman stays absent") {
            doc.location shouldBe null
            doc.nameRoman shouldBe null
            doc.zoneId shouldBe 3L
            doc.pathId shouldBe 4L
            mapper.readTree(mapper.writeValueAsString(doc)).has("location") shouldBe false
        }
    }
    given("index contract") {
        then("mapping and write fields match without a custom dictionary") {
            val mapping = mapper.readTree(requireNotNull(javaClass.getResourceAsStream("/opensearch/market-stores-index.json")))
            mapping.path("mappings").path("properties").propertyNames().toSet() shouldBe
                MarketStoreIndexDocument::class.java.declaredFields.filterNot { it.isSynthetic }.map { it.name }.toSet()
            mapping.toString().contains("user_dictionary") shouldBe false
            mapping.path("mappings").path("properties").path("location").path("type").asText() shouldBe "geo_point"
        }
    }
})
