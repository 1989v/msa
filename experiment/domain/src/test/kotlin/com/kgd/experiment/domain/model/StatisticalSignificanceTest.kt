package com.kgd.experiment.domain.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.doubles.shouldBeLessThan

class StatisticalSignificanceTest : BehaviorSpec({
    Given("StatisticalSignificance") {
        When("clearly different proportions") {
            val result = StatisticalSignificance.twoProportionZTest(
                controlSuccess = 100, controlTotal = 1000,
                treatmentSuccess = 200, treatmentTotal = 1000
            )

            Then("result is significant") {
                result.isSignificant shouldBe true
                result.pValue shouldBeLessThan 0.05
            }
        }

        When("similar proportions") {
            val result = StatisticalSignificance.twoProportionZTest(
                controlSuccess = 100, controlTotal = 1000,
                treatmentSuccess = 102, treatmentTotal = 1000
            )

            Then("result is not significant") {
                result.isSignificant shouldBe false
            }
        }

        When("no data") {
            val result = StatisticalSignificance.twoProportionZTest(
                controlSuccess = 0, controlTotal = 0,
                treatmentSuccess = 0, treatmentTotal = 0
            )

            Then("result is not significant") {
                result.isSignificant shouldBe false
                result.pValue shouldBe 1.0
            }
        }
    }
})
