package com.kgd.analytics.domain.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe

class ProductScoreTest : BehaviorSpec({
    Given("ProductScore 계산 (no smoothing)") {
        When("정상적인 노출/클릭/주문 데이터로 계산하면") {
            val score = ProductScore.compute(
                productId = 1L,
                impressions = 1000,
                clicks = 50,
                orders = 5
            )

            Then("ctrRaw = clicks / impressions") {
                score.ctrRaw shouldBe 0.05
            }

            Then("cvrRaw = orders / clicks") {
                score.cvrRaw shouldBe 0.1
            }

            Then("popularityScore가 0보다 크다") {
                score.popularityScore shouldBeGreaterThan 0.0
            }

            Then("gmv1h 기본은 0.0") {
                score.gmv1h shouldBe 0.0
            }
        }

        When("노출이 0이면") {
            val score = ProductScore.compute(
                productId = 2L,
                impressions = 0,
                clicks = 0,
                orders = 0
            )

            Then("ctrRaw / cvrRaw 모두 0.0 (zero division 방어)") {
                score.ctrRaw shouldBe 0.0
                score.cvrRaw shouldBe 0.0
            }
        }

        When("클릭은 있지만 주문이 0이면") {
            val score = ProductScore.compute(
                productId = 3L,
                impressions = 100,
                clicks = 10,
                orders = 0
            )

            Then("cvrRaw 는 0.0, ctrRaw 는 정상") {
                score.cvrRaw shouldBe 0.0
                score.ctrRaw shouldBe 0.1
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
                score.popularityScore shouldBe 0.14
            }
        }
    }

    Given("ProductScore 계산 (Bayesian smoothing, ADR-0050 Phase 2)") {
        val smoothing = SmoothingConfig(alpha = 1.0, beta = 9.0)

        When("sparse arm — clicks=1, impressions=2 (raw CTR 50%)") {
            val score = ProductScore.compute(
                productId = 10L,
                impressions = 2,
                clicks = 1,
                orders = 0,
                smoothing = smoothing
            )

            Then("raw 는 0.5 그대로 보존") {
                score.ctrRaw shouldBe 0.5
            }
            Then("smoothed CTR 는 (1+1)/(2+1+9) = 2/12 ≈ 0.1667 — prior 가 dominate") {
                score.ctr shouldBe (2.0 / 12.0)
            }
            Then("smoothed CTR < raw CTR — prior 가 raw 를 끌어내림") {
                score.ctr shouldBeLessThan score.ctrRaw
            }
        }

        When("성숙한 arm — clicks=500, impressions=1000 (raw CTR 50%)") {
            val score = ProductScore.compute(
                productId = 11L,
                impressions = 1000,
                clicks = 500,
                orders = 50,
                smoothing = smoothing
            )

            Then("smoothed CTR ≈ raw CTR 로 수렴") {
                val smoothed = score.ctr
                val raw = score.ctrRaw
                kotlin.math.abs(smoothed - raw) shouldBeLessThan 0.01
            }
        }

        When("SmoothingConfig.NONE 적용") {
            val none = ProductScore.compute(
                productId = 12L,
                impressions = 1000,
                clicks = 50,
                orders = 5,
                smoothing = SmoothingConfig.NONE
            )

            Then("ctr ≈ ctrRaw") {
                kotlin.math.abs(none.ctr - none.ctrRaw) shouldBeLessThan 1e-6
            }
        }
    }

    Given("ProductScore 의 gmv1h") {
        When("gmv1h 를 전달하면") {
            val score = ProductScore.compute(
                productId = 20L,
                impressions = 100,
                clicks = 10,
                orders = 2,
                gmv1h = 12345.67
            )

            Then("필드에 그대로 저장된다") {
                score.gmv1h shouldBe 12345.67
            }
        }
    }
})
