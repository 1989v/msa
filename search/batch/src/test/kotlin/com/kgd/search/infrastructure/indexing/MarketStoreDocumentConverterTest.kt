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
    given("display metadata from the source projections") {
        then("retain addresses, good price menus, sources and language-specific attraction IDs") {
            val source = mapper.readTree("""{"market":{"contentId":"100","name":"시장","marketType":"BUILDING"},"stores":[{"id":2,"name":"가게","roadAddress":"도로","jibunAddress":"지번","buildingName":"상가","dong":"A","floor":"2","ho":"201","sources":["ONNURI"],"goodPrice":{"menus":[{"name":"국수","price":5000}]}}]}""")
            val metadata = mapper.readTree("""{"region":"서울 중구","attraction":{"id":7,"lang":"ko"}}""")
            val doc = converter.convert(source, mapper.readTree("{}"), dictionary, metadata, metadata).single()
            doc.roadAddress shouldBe "도로"
            doc.jibunAddress shouldBe "지번"
            listOf(doc.buildingName, doc.dong, doc.floor, doc.ho) shouldBe listOf("상가", "A", "2", "201")
            doc.goodPrice shouldBe true
            doc.goodPriceMenus shouldBe listOf("국수")
            doc.sources shouldBe listOf("ONNURI")
            doc.region shouldBe "서울 중구"
            doc.marketType shouldBe "BUILDING"
            doc.attractionIdKo shouldBe 7L
            doc.attractionIdEn shouldBe null
            doc.marketNameEn shouldBe null
        }
        then("missing or null metadata remains absent without fabricated IDs") {
            val source = mapper.readTree("""{"market":{"contentId":"100"},"stores":[{"id":2,"name":"가게","goodPrice":null,"roadAddress":null,"sources":null}]}""")
            val doc = converter.convert(source, mapper.readTree("{}"), dictionary).single()
            doc.roadAddress shouldBe null
            doc.goodPrice shouldBe false
            doc.goodPriceMenus shouldBe emptyList()
            doc.sources shouldBe emptyList()
            doc.attractionIdKo shouldBe null
            doc.attractionIdEn shouldBe null
            doc.region shouldBe null
        }
        then("new display-only fields are stored without indexing") {
            val properties = mapper.readTree(requireNotNull(javaClass.getResourceAsStream("/opensearch/market-stores-index.json"))).path("mappings").path("properties")
            listOf("roadAddress", "jibunAddress", "buildingName", "dong", "floor", "ho", "goodPriceMenus", "sources", "marketNameEn", "region", "marketType").forEach {
                properties.path(it).path("type").asText() shouldBe "keyword"
                properties.path(it).path("index").asBoolean() shouldBe false
            }
            properties.path("goodPrice").path("type").asText() shouldBe "boolean"
            properties.path("attractionIdKo").path("type").asText() shouldBe "long"
        }
    }

})
