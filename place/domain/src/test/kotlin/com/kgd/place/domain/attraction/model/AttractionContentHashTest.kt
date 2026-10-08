package com.kgd.place.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldMatch
import java.time.LocalDate

/**
 * 본문 해시는 「본문이 실제로 바뀌었나」만 가른다 — 공백·태그 같은 표기 차이는 같은 본문이고,
 * 화면에 보이는 값(요금·행사 날짜·이용정보 원문)이 바뀌면 다른 본문이다.
 */
class AttractionContentHashTest : BehaviorSpec({

    fun museum(
        overview: String? = "조선의 법궁",
        useFee: String? = "성인 3,000원",
        introRaw: String? = "{\"usetime\":\"09:00~18:00\"}",
        eventEndDate: LocalDate? = LocalDate.of(2026, 11, 8),
    ) = Attraction.create(
        contentId = "126508", lang = "ko", title = "경복궁",
        latitude = 37.5788, longitude = 126.977,
        address = "서울특별시 종로구 사직로 161", tel = "02-3700-3900",
        overview = overview, useFee = useFee, introRaw = introRaw,
        eventStartDate = LocalDate.of(2026, 11, 7), eventEndDate = eventEndDate,
    )

    Given("같은 본문") {
        Then("해시가 같다") {
            AttractionContentHash.of(museum()) shouldBe AttractionContentHash.of(museum())
        }
    }

    Given("공백·태그만 다른 본문") {
        Then("같은 해시다") {
            AttractionContentHash.of(museum(overview = "  <p>조선의\n\t 법궁</p><br/> ")) shouldBe
                AttractionContentHash.of(museum())
        }
        Then("유니코드 공백(U+00A0 · U+3000) 연속도 공백 하나로 본다") {
            AttractionContentHash.of(museum(overview = "조선의 　 법궁")) shouldBe
                AttractionContentHash.of(museum())
        }
    }

    Given("화면에 보이는 값이 바뀐 본문") {
        Then("요금이 바뀌면 다르다") {
            AttractionContentHash.of(museum(useFee = "성인 4,000원")) shouldNotBe AttractionContentHash.of(museum())
        }
        Then("행사 날짜만 바뀌어도 다르다") {
            AttractionContentHash.of(museum(eventEndDate = LocalDate.of(2026, 11, 9))) shouldNotBe
                AttractionContentHash.of(museum())
        }
        Then("이용정보 원문이 바뀌면 다르다") {
            AttractionContentHash.of(museum(introRaw = "{\"usetime\":\"09:00~17:00\"}")) shouldNotBe
                AttractionContentHash.of(museum())
        }
    }

    Given("null 과 빈 문자열") {
        Then("같은 값으로 본다") {
            val values = AttractionContentHash.HASH_FIELDS.associateWith { null as Any? }
            AttractionContentHash.compute(values) shouldBe
                AttractionContentHash.compute(values + ("overview" to "") + ("tel" to "  "))
        }
    }

    Given("저장값 모양") {
        Then("v1: 접두 + 64자 소문자 hex 다") {
            AttractionContentHash.of(museum()) shouldMatch Regex("v1:[0-9a-f]{64}")
            AttractionContentHash.isCurrentVersion(AttractionContentHash.of(museum())) shouldBe true
            AttractionContentHash.isCurrentVersion("v0:abc") shouldBe false
        }
    }

    Given("입력 필드 목록") {
        Then("스펙의 순서 그대로다 — 순서가 바뀌면 전 행 해시가 바뀌어 전량이 「변경」으로 잡힌다") {
            AttractionContentHash.HASH_FIELDS shouldBe listOf(
                "title", "overview", "address", "tel", "imageUrl", "useTime", "restDate", "useFee", "parking",
                "parkingFee", "infoCenter", "eventStartDate", "eventEndDate", "introRaw",
            )
        }
    }
})
