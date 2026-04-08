package com.kgd.analytics.domain.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThanOrEqual
import io.kotest.matchers.doubles.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe

class ScoreNormalizerTest : BehaviorSpec({
    Given("ScoreNormalizer") {
        When("정상 범위의 값을 정규화하면") {
            val result = ScoreNormalizer.normalize(50.0, 0.0, 100.0)

            Then("0~1 사이 값을 반환한다") {
                result shouldBeGreaterThanOrEqual 0.0
                result shouldBeLessThanOrEqual 1.0
            }
        }

        When("min과 max가 같으면") {
            val result = ScoreNormalizer.normalize(5.0, 5.0, 5.0)

            Then("0.0을 반환한다") {
                result shouldBe 0.0
            }
        }

        When("upperBound(max * clipPercentile)가 min 이하이면") {
            val result = ScoreNormalizer.normalize(1.0, 10.0, 10.0, 0.5)

            Then("0.0을 반환한다") {
                result shouldBe 0.0
            }
        }

        When("값이 upperBound를 초과하면") {
            val result = ScoreNormalizer.normalize(200.0, 0.0, 100.0, 0.95)

            Then("1.0으로 클리핑된다") {
                result shouldBe 1.0
            }
        }

        When("값이 min 미만이면") {
            val result = ScoreNormalizer.normalize(-10.0, 0.0, 100.0)

            Then("0.0으로 클리핑된다") {
                result shouldBe 0.0
            }
        }

        When("min이 0이고 max도 0이면") {
            val result = ScoreNormalizer.normalize(0.0, 0.0, 0.0)

            Then("0.0을 반환한다") {
                result shouldBe 0.0
            }
        }
    }
})
