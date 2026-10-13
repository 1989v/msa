package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import kotlin.math.ln

class AttractionContentUniquenessTest : BehaviorSpec({

    given("비교 열쇠") {
        then("앞뒤 공백을 떼고 앞 300자만 본다 — 끝에 지점명만 붙인 문구는 같은 열쇠다") {
            val brand = "가".repeat(300)
            AttractionContentUniqueness.key("  $brand 명동점 ") shouldBe brand
            AttractionContentUniqueness.key("$brand 홍대점") shouldBe AttractionContentUniqueness.key("$brand 명동점")
            AttractionContentUniqueness.key("  짧은 소개  ") shouldBe "짧은 소개"
        }
        then("소개문이 비면 열쇠가 없다 — 세지 않는다") {
            AttractionContentUniqueness.key(null) shouldBe null
            AttractionContentUniqueness.key("   ") shouldBe null
        }
    }

    given("계수 1/(1+ln n)") {
        then("혼자 쓰는 소개문(또는 세지 못한 문서)은 1.0") {
            AttractionContentUniqueness.weight(1) shouldBe 1.0
            AttractionContentUniqueness.weight(0) shouldBe 1.0
        }
        then("나눠 쓰는 문서가 늘수록 낮아진다") {
            AttractionContentUniqueness.weight(5) shouldBe (1.0 / (1.0 + ln(5.0)) plusOrMinus 1e-12)
            AttractionContentUniqueness.weight(5) shouldBe (0.383 plusOrMinus 0.001)
            val values = (1..500).map { AttractionContentUniqueness.weight(it) }
            values shouldBe values.sortedDescending()
        }
    }
})
