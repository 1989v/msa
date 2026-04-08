package com.kgd.analytics.domain.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.shouldBe

class ProductScoreTest : BehaviorSpec({
    Given("ProductScore 계산") {
        When("정상적인 노출/클릭/주문 데이터로 계산하면") {
            val score = ProductScore.compute(
                productId = 1L,
                impressions = 1000,
                clicks = 50,
                orders = 5
            )

            Then("CTR = clicks / impressions") {
                score.ctr shouldBe 0.05
            }

            Then("CVR = orders / clicks") {
                score.cvr shouldBe 0.1
            }

            Then("popularityScore가 0보다 크다") {
                score.popularityScore shouldBeGreaterThan 0.0
            }
        }

        When("노출이 0이면") {
            val score = ProductScore.compute(
                productId = 2L,
                impressions = 0,
                clicks = 0,
                orders = 0
            )

            Then("CTR은 0.0이다 (zero division 방어)") {
                score.ctr shouldBe 0.0
            }

            Then("CVR은 0.0이다") {
                score.cvr shouldBe 0.0
            }
        }

        When("클릭은 있지만 주문이 0이면") {
            val score = ProductScore.compute(
                productId = 3L,
                impressions = 100,
                clicks = 10,
                orders = 0
            )

            Then("CVR은 0.0이다") {
                score.cvr shouldBe 0.0
            }

            Then("CTR은 정상 계산된다") {
                score.ctr shouldBe 0.1
            }
        }

        When("정규화 함수를 전달하면") {
            val score = ProductScore.compute(
                productId = 4L,
                impressions = 100,
                clicks = 10,
                orders = 1,
                normalizer = { it / 1000.0 }
            )

            Then("popularityScore에 정규화가 적용된다") {
                // raw = 100*1 + 10*3 + 1*10 = 140
                score.popularityScore shouldBe 0.14
            }
        }
    }
})
