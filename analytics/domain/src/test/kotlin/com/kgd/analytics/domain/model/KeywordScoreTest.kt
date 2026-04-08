package com.kgd.analytics.domain.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.shouldBe

class KeywordScoreTest : BehaviorSpec({
    Given("KeywordScore 계산") {
        When("정상적인 검색/클릭/주문 데이터로 계산하면") {
            val score = KeywordScore.compute(
                keyword = "노트북",
                searchCount = 500,
                totalClicks = 100,
                totalOrders = 10
            )

            Then("CTR = clicks / searchCount") {
                score.ctr shouldBe 0.2
            }

            Then("CVR = orders / clicks") {
                score.cvr shouldBe 0.1
            }

            Then("composite score가 0보다 크다") {
                score.score shouldBeGreaterThan 0.0
            }
        }

        When("검색은 있지만 클릭이 0이면") {
            val score = KeywordScore.compute(
                keyword = "희귀상품",
                searchCount = 50,
                totalClicks = 0,
                totalOrders = 0
            )

            Then("CTR, CVR 모두 0.0이다") {
                score.ctr shouldBe 0.0
                score.cvr shouldBe 0.0
            }
        }

        When("정규화 함수를 전달하면") {
            val score = KeywordScore.compute(
                keyword = "테스트",
                searchCount = 100,
                totalClicks = 20,
                totalOrders = 2,
                normalizer = { it / 1000.0 }
            )

            Then("score에 정규화가 적용된다") {
                // raw = 100*1 + 0.2*5 + 0.1*10 = 102.0
                score.score shouldBe 0.102
            }
        }
    }
})
