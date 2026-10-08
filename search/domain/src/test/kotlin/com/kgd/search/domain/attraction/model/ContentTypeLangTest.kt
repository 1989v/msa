package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * 국·영 유형 대응표가 수집기 원본과 같은지 본다.
 * 아래 기대값은 `place/ingest/src/sync_tour.py` 의 `CONTENT_TYPES` 와 같은 수치다(관광지 12/76 · 문화 14/78 · 레포츠 28/75 ·
 * 쇼핑 38/79 · 음식 39/82 · 숙박 32/80 · 행사 15/85 · 코스 25/없음).
 */
class ContentTypeLangTest : BehaviorSpec({

    given("유형 대응표") {
        then("언어 중립 유형마다 국문·영문 코드와 짝 판정 대상 여부가 수집기 값과 같다") {
            ContentTypeLang.entries.associate { it.name to Triple(it.ko, it.en, it.pairable) } shouldBe mapOf(
                "ATTRACTION" to Triple("12", "76", true),
                "CULTURE" to Triple("14", "78", true),
                "LEISURE" to Triple("28", "75", true),
                "SHOPPING" to Triple("38", "79", true),
                "FOOD" to Triple("39", "82", true),
                "STAY" to Triple("32", "80", true),
                "FESTIVAL" to Triple("15", "85", false),
                "COURSE" to Triple("25", null, false),
            )
        }
    }

    given("문서 언어와 코드로 유형을 찾을 때") {
        then("같은 유형의 국·영 코드는 같은 값으로, 언어가 다른 코드·표에 없는 코드는 없음으로 읽는다") {
            ContentTypeLang.of("ko", "28") shouldBe ContentTypeLang.LEISURE
            ContentTypeLang.of("en", "75") shouldBe ContentTypeLang.LEISURE
            ContentTypeLang.of("ko", "75") shouldBe null
            ContentTypeLang.of("en", "12") shouldBe null
            ContentTypeLang.of("ko", "99") shouldBe null
            ContentTypeLang.of("ko", null) shouldBe null
            ContentTypeLang.of("ja", "12") shouldBe null
        }
    }
})
