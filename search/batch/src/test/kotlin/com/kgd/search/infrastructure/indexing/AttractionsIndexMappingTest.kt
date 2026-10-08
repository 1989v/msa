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

    given("관광지 색인 정의의 무장애·웰니스 필드") {
        then("필터 축(무장애 코드 · 웰니스 테마)은 색인되는 keyword, 원천 문장·테마 이름은 색인하지 않는다") {
            listOf("barrierFree", "wellnessTheme").forEach { field ->
                (field to properties.path(field).path("type").asString()) shouldBe (field to "keyword")
                (field to properties.path(field).path("index").isMissingNode) shouldBe (field to true)
            }
            properties.path("barrierFreeDetail").path("type").asString() shouldBe "object"
            properties.path("barrierFreeDetail").path("enabled").asBoolean(true) shouldBe false
            properties.path("wellnessThemeName").path("index").asBoolean(true) shouldBe false
        }
    }

    given("관광지 색인 정의의 출처·요금 텍스트 필드") {
        then("출처·공공누리 유형은 keyword, 요금 텍스트는 표시 전용이라 색인하지 않는 text 다") {
            listOf("source", "copyrightDivCd").forEach { field ->
                (field to properties.path(field).path("type").asString()) shouldBe (field to "keyword")
            }
            properties.path("feeText").path("type").asString() shouldBe "text"
            properties.path("feeText").path("index").asBoolean(true) shouldBe false
        }
    }

    given("관광지 색인 정의의 집중률 필드") {
        then("날짜·값 배열은 표시 전용이라 색인하지 않는 객체다 — 하루 한 번 30개가 바뀌는 값으로 필드 수를 늘리지 않는다") {
            properties.path("congestion").path("type").asString() shouldBe "object"
            properties.path("congestion").path("enabled").asBoolean(true) shouldBe false
        }
    }

    given("관광지 색인 정의의 연관 관광지 필드") {
        then("순위·id·제목·분류 배열은 표시 전용이라 색인하지 않는 객체다") {
            properties.path("relatedPlaces").path("type").asString() shouldBe "object"
            properties.path("relatedPlaces").path("enabled").asBoolean(true) shouldBe false
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

        `when`("다른 시도의 비슷한 곳 목록을 보면") {
            then("하위 필드를 만들지 않는 객체여야 한다") {
                val similar = properties.path("similarElsewhere")
                similar.path("type").asString() shouldBe "object"
                similar.path("enabled").asBoolean(true) shouldBe false
            }
        }
    }

    given("관광지 색인 정의의 행사·코스 필드") {
        then("유효 기간 둘은 범위 질의가 거는 색인되는 날짜이고, 형식은 쓰기 문서가 내는 yyyy-MM-dd 다") {
            listOf("eventStartEffective", "eventEndEffective").forEach { field ->
                val mapping = properties.path(field)
                (field to mapping.path("type").asString()) shouldBe (field to "date")
                (field to mapping.path("format").asString()) shouldBe (field to "yyyy-MM-dd")
                (field to mapping.path("index").asBoolean(true)) shouldBe (field to true)
            }
        }
        then("코스 구성은 하위 필드를 만들지 않는 객체다") {
            properties.path("courseStops").path("type").asString() shouldBe "object"
            properties.path("courseStops").path("enabled").asBoolean(true) shouldBe false
        }
    }

    given("관광지 색인 정의의 클릭 신호 필드") {
        then("방문자 수는 표시 전용이라 색인하지 않고, 계수는 점수 함수가 읽는 숫자 필드다") {
            properties.path("uniqueClickers14d").path("type").asString() shouldBe "integer"
            properties.path("uniqueClickers14d").path("index").asBoolean(true) shouldBe false
            // fvf 는 doc_values 를 읽는다 — index:false 는 괜찮지만 doc_values 를 끄면 점수 함수가 실패한다
            properties.path("clickBoost").path("type").asString() shouldBe "float"
            properties.path("clickBoost").path("doc_values").asBoolean(true) shouldBe true
        }
    }

    given("관광지 색인 정의의 언어 대체 짝·본문 변경 시각 필드") {
        then("짝 id 는 keyword, 본문 변경 시각은 쓰기 문서 형식의 date 이고 둘 다 doc_values 를 끄지 않는다 — 짝 점검 스크롤·최근 갱신 정렬이 읽는다") {
            properties.path("alternateId").path("type").asString() shouldBe "keyword"
            properties.path("alternateId").path("doc_values").asBoolean(true) shouldBe true
            properties.path("contentUpdatedAt").path("type").asString() shouldBe "date"
            properties.path("contentUpdatedAt").path("format").asString() shouldBe "yyyy-MM-dd'T'HH:mm:ss"
            properties.path("contentUpdatedAt").path("doc_values").asBoolean(true) shouldBe true
        }
    }
})
