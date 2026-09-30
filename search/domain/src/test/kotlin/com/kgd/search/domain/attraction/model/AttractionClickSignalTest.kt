package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.LocalDate
import kotlin.math.ln

class AttractionClickSignalTest : BehaviorSpec({

    given("최소 표본 경계") {
        then("표본 미만·신호 없음은 계수 1.0 이고 표시도 없다") {
            AttractionClickSignal.boost(null) shouldBe 1.0
            AttractionClickSignal.boost(0) shouldBe 1.0
            AttractionClickSignal.boost(AttractionClickSignal.MIN_SAMPLE - 1) shouldBe 1.0
            AttractionClickSignal.isFrequentlyClicked(null) shouldBe false
            AttractionClickSignal.isFrequentlyClicked(4) shouldBe false
        }
        then("표본에 닿으면 표시가 붙고, 계수는 1.0 에서 끊김 없이 올라가기 시작한다") {
            AttractionClickSignal.isFrequentlyClicked(5) shouldBe true
            AttractionClickSignal.boost(5) shouldBe (1.0 plusOrMinus 1e-12)
            AttractionClickSignal.boost(10) shouldBe (1.0 + AttractionClickSignal.ALPHA * ln(2.0) plusOrMinus 1e-12)
        }
    }

    given("많이 눌린 곳") {
        then("100명 안팎에서 상한에 닿고 그 뒤로는 상한에 머문다") {
            AttractionClickSignal.boost(90) shouldBe (1.29 plusOrMinus 0.01)
            AttractionClickSignal.boost(101) shouldBe AttractionClickSignal.CAP
            AttractionClickSignal.boost(1_000_000) shouldBe AttractionClickSignal.CAP
        }
        then("표본 이상에서 단조 증가한다") {
            val values = (5..200).map { AttractionClickSignal.boost(it) }
            values shouldBe values.sorted()
        }
    }

    given("14일 창 — KST 날짜 기준") {
        then("KST 자정 직후면 KST 오늘을 빼고 어제까지 14일이다") {
            // UTC 9/30 15:00 = KST 10/1 00:00
            AttractionClickSignal.windowOf(Instant.parse("2026-09-30T15:00:00Z")) shouldBe
                (LocalDate.of(2026, 9, 17)..LocalDate.of(2026, 9, 30))
        }
        then("KST 자정 직전이면 하루 앞 창이다") {
            AttractionClickSignal.windowOf(Instant.parse("2026-09-30T14:59:59Z")) shouldBe
                (LocalDate.of(2026, 9, 16)..LocalDate.of(2026, 9, 29))
        }
    }
})
