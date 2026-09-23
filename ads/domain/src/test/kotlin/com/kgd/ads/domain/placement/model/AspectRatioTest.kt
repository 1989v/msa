package com.kgd.ads.domain.placement.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class AspectRatioTest : BehaviorSpec({
    given("1.91:1 지면 형식") {
        val wide = AspectRatio.of("1.91:1")

        `when`("소재가 1200×628 이면") {
            then("상대 오차 1% 안이라 맞는다") { wide.fits(1200, 628) shouldBe true }
        }
        `when`("소재가 1:1 이면") {
            then("맞지 않는다") { wide.fits(600, 600) shouldBe false }
        }
        `when`("가로·세로가 0 이면") {
            then("맞지 않는다") { wide.fits(0, 0) shouldBe false }
        }
    }
})
