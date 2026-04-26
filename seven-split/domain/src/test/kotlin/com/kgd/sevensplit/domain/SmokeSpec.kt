package com.kgd.sevensplit.domain

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class SmokeSpec : BehaviorSpec({
    Given("seven-split domain module") {
        When("smoke test 실행하면") {
            val ok = true
            Then("도메인 모듈이 빌드되고 Kotest가 동작한다") {
                ok shouldBe true
            }
        }
    }
})
