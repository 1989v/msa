package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.attraction.model.Admission
import com.kgd.search.domain.attraction.model.Availability
import com.kgd.search.domain.attraction.model.NearbyPlace
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.model.RegularClosure
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import tools.jackson.module.kotlin.readValue
import java.time.DayOfWeek

/**
 * 색인 문서 `_source` → 도메인. 재색인이 싣는 방문 속성·지역 안 위치(중첩 목록 포함)가
 * 읽는 쪽에서 값으로 살아나는지 본다. 매퍼 설정은 운영 OpenSearch 클라이언트와 같다.
 */
class AttractionSearchDocumentTest : BehaviorSpec({

    val mapper = jacksonMapperBuilder()
        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
        .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        .build()

    val base = """"id":"1","contentId":"126508","lang":"ko","title":"경복궁","location":{"lat":37.5,"lon":126.9}"""

    given("색인 문서에 원천 관광 유형이 있을 때") {
        `when`("도메인으로 바꾸면") {
            val doc = mapper.readValue<AttractionSearchDocument>("""{$base,"contentTypeId":"12"}""").toDomain()

            then("contentTypeId 가 살아 있어야 한다 — 상세 지역 문구의 유형 이름이 이 값에서 나온다") {
                doc.contentTypeId shouldBe "12"
            }
        }
    }

    given("색인 문서에 출처·공공누리 유형·요금 텍스트·반려동물 원문이 있을 때") {
        `when`("도메인으로 바꾸면") {
            val doc = mapper.readValue<AttractionSearchDocument>(
                """{$base,"source":"GOCAMPING","copyrightDivCd":"Type3","feeText":"<어린이> 무료","petAcmpyType":"일부구역 동반가능"}""",
            ).toDomain()

            then("네 값이 그대로 살아 있다 — 상세 확인 상태·license·요금 칸·반려동물 칸이 읽는다") {
                doc.source shouldBe "GOCAMPING"
                doc.copyrightDivCd shouldBe "Type3"
                doc.feeText shouldBe "<어린이> 무료"
                doc.petAcmpyType shouldBe "일부구역 동반가능"
            }
        }
    }

    given("재색인이 속성·지역 필드를 실은 문서를 읽을 때") {
        val source = """{$base,
            "closureState":"WEEKLY","closedWeekdays":["MON","TUE"],
            "attrParking":"YES","attrCreditCard":"NO","attrStrollerRental":"UNKNOWN",
            "petPolicy":"PARTIAL","attrAdmission":"PAID","attributeParserVersion":1,
            "sigunguName":"종로구","regionTypeCount":42,"regionCategoryCount":5,"lclsSystm3Name":"고궁",
            "sameCategoryNearby":[{"id":"2","title":"창덕궁","distanceMeters":1234}],
            "similarElsewhere":[{"id":"9","title":"경기전","sidoName":"전북특별자치도"},{"id":"8","title":"화성행궁"}]}"""

        `when`("도메인으로 바꾸면") {
            val doc = mapper.readValue<AttractionSearchDocument>(source).toDomain()

            then("속성이 도메인 값으로 복원되어야 한다") {
                val attributes = doc.attributes.shouldNotBeNull()
                attributes.regularClosure shouldBe RegularClosure.Weekly(setOf(DayOfWeek.MONDAY, DayOfWeek.TUESDAY))
                attributes.parking shouldBe Availability.YES
                attributes.creditCard shouldBe Availability.NO
                attributes.strollerRental shouldBe Availability.UNKNOWN
                attributes.petPolicy shouldBe PetPolicy.PARTIAL
                attributes.freeAdmission shouldBe Admission.PAID
                attributes.parserVersion shouldBe 1
            }

            then("지역 안 위치와 가까운 곳 목록이 실려야 한다") {
                val region = doc.region.shouldNotBeNull()
                region.sigunguName shouldBe "종로구"
                region.typeCount shouldBe 42
                region.categoryCount shouldBe 5
                region.categoryName shouldBe "고궁"
                region.sameCategoryNearby shouldBe listOf(NearbyPlace("2", "창덕궁", 1234, null))
            }

            then("다른 시도의 비슷한 곳이 순서대로 실린다 — 시도 이름이 없던 항목은 null") {
                doc.similarElsewhere shouldBe listOf(
                    com.kgd.search.domain.attraction.model.SimilarPlace("9", "경기전", "전북특별자치도", null),
                    com.kgd.search.domain.attraction.model.SimilarPlace("8", "화성행궁", null, null),
                )
            }
        }
    }

    given("새 필드가 생기기 전에 색인된 문서를 읽을 때") {
        `when`("도메인으로 바꾸면") {
            val doc = mapper.readValue<AttractionSearchDocument>("{$base}").toDomain()

            then("속성·지역은 「모름」이 아니라 「없음」(null)이어야 한다") {
                doc.attributes.shouldBeNull()
                doc.region.shouldBeNull()
                doc.similarElsewhere.shouldBeNull()
                doc.source.shouldBeNull()
                doc.copyrightDivCd.shouldBeNull()
                doc.feeText.shouldBeNull()
            }
        }
    }
})
