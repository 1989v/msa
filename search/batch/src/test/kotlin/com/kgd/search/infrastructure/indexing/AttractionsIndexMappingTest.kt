package com.kgd.search.infrastructure.indexing

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * 관광지 매핑의 인리치먼트 필드 선언.
 *
 * 필터·집계에 쓰는 속성만 색인하고, 상세에만 보여 주는 지역 필드는 색인하지 않는다 —
 * 표시용 목록을 객체로 색인하면 문서마다 하위 필드가 늘어 색인 크기와 필드 수만 커진다.
 * 판정은 재색인이 실제로 쓰는 정의 파일([IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION])을 읽어서 한다.
 */
class AttractionsIndexMappingTest : BehaviorSpec({

    val properties: JsonNode = ObjectMapper()
        .readTree(javaClass.getResourceAsStream(IndexAliasManager.ATTRACTIONS_INDEX_DEFINITION))
        .path("mappings").path("properties")

    given("관광지 색인 정의의 속성 필드") {
        `when`("필터·집계 대상 속성을 보면") {
            then("색인되는 keyword 여야 한다") {
                listOf(
                    "closureState", "closedWeekdays", "attrParking", "attrCreditCard",
                    "attrStrollerRental", "petPolicy", "attrAdmission",
                ).forEach { field ->
                    val mapping = properties.path(field)
                    (field to mapping.path("type").asString()) shouldBe (field to "keyword")
                    (field to mapping.path("index").isMissingNode) shouldBe (field to true)
                }
                properties.path("attributeParserVersion").path("type").asString() shouldBe "integer"
            }
        }
    }

    given("관광지 색인 정의의 지역 안 위치 필드") {
        `when`("표시에만 쓰는 값을 보면") {
            then("색인하지 않아야 한다") {
                mapOf(
                    "sigunguName" to "keyword",
                    "lclsSystm3Name" to "keyword",
                    "regionTypeCount" to "integer",
                    "regionCategoryCount" to "integer",
                ).forEach { (field, type) ->
                    val mapping = properties.path(field)
                    (field to mapping.path("type").asString()) shouldBe (field to type)
                    (field to mapping.path("index").asBoolean(true)) shouldBe (field to false)
                }
            }
        }

        `when`("같은 분류 가까운 곳 목록을 보면") {
            then("하위 필드를 만들지 않는 객체여야 한다") {
                val nearby = properties.path("sameCategoryNearby")
                nearby.path("type").asString() shouldBe "object"
                nearby.path("enabled").asBoolean(true) shouldBe false
            }
        }
    }
})
