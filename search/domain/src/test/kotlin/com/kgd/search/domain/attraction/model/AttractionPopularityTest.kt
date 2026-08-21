package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.data.forAll
import io.kotest.data.row
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe

class AttractionPopularityTest : BehaviorSpec({

    given("레코드 완결성 점수를 매길 때") {
        `when`("이미지·개요·전화 조합이 주어지면") {
            then("base 1.0 + 이미지 1.0 + 개요 구간(0.5/1.0/1.5) + 전화 0.2 이어야 한다") {
                forAll(
                    row("빈 레코드", null, null, null, 1.0),
                    row("이미지만", "http://img/1", null, null, 2.0),
                    row("짧은 개요", null, "가".repeat(50), null, 1.5),
                    row("중간 개요", null, "가".repeat(200), null, 2.0),
                    row("긴 개요", null, "가".repeat(500), null, 2.5),
                    row("전화만", null, null, "02-123-4567", 1.2),
                    row("전부", "http://img/1", "가".repeat(500), "02-123-4567", 3.7),
                ) { _, imageUrl, overview, tel, expected ->
                    AttractionPopularity.score(imageUrl, overview, tel) shouldBe
                        (expected plusOrMinus 1e-9)
                }
            }
        }
        `when`("공백뿐인 값이면") {
            then("없는 것으로 친다 — 원천이 빈 문자열을 주는 필드가 실제로 있다") {
                AttractionPopularity.score(" ", "  ", " ") shouldBe (1.0 plusOrMinus 1e-9)
            }
        }
    }

    given("AttractionDocument 를 색인용으로 만들 때") {
        `when`("popularityScore 를 넘기지 않으면") {
            then("완결성 공식으로 계산된다 — 색인 경로가 따로 계산할 필요가 없다") {
                val document = AttractionDocument(
                    id = "1", contentId = "126508", lang = "ko", title = "경복궁",
                    latitude = 37.5788, longitude = 126.977,
                    imageUrl = "http://img/1", overview = "가".repeat(200), tel = "02-3700-3900",
                )
                document.popularityScore shouldBe (3.2 plusOrMinus 1e-9)
            }
        }
    }
})
