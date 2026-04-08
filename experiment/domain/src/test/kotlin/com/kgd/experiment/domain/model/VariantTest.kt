package com.kgd.experiment.domain.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class VariantTest : BehaviorSpec({
    Given("Variant 생성") {
        When("유효한 데이터로 생성하면") {
            val variant = Variant(null, "control", 50, mapOf("boost" to 1.0))

            Then("정상 생성된다") {
                variant.name shouldBe "control"
                variant.weight shouldBe 50
            }
        }

        When("weight가 0이하이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Variant(null, "bad", 0, emptyMap())
                }
            }
        }

        When("name이 빈 문자열이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Variant(null, "", 50, emptyMap())
                }
            }
        }
    }
})
