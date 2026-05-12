package com.kgd.recommendation.service

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ActionWeightedScoreTest : BehaviorSpec({

    given("산업 표준 비율 100:20:10:1") {
        `when`("reservation 1번만") {
            then("score = 100") {
                ActionWeightedScore.compute(
                    reservationCount = 1, clickCount = 0, addwishCount = 0, pageviewCount = 0
                ) shouldBe 100.0
            }
        }
        `when`("click 5번 + pageview 20번") {
            then("score = 5*20 + 20*1 = 120") {
                ActionWeightedScore.compute(
                    reservationCount = 0, clickCount = 5, addwishCount = 0, pageviewCount = 20
                ) shouldBe 120.0
            }
        }
        `when`("모든 행동 1번씩") {
            then("score = 100 + 20 + 10 + 1 = 131") {
                ActionWeightedScore.compute(
                    reservationCount = 1, clickCount = 1, addwishCount = 1, pageviewCount = 1
                ) shouldBe 131.0
            }
        }
    }

    given("비교 시나리오") {
        `when`("reservation 1번 vs pageview 100번") {
            then("같은 score 100.0 — funnel 변환률의 역수 비율 확인") {
                val resv = ActionWeightedScore.compute(1, 0, 0, 0)
                val pv = ActionWeightedScore.compute(0, 0, 0, 100)
                resv shouldBe pv
            }
        }
    }

    given("음수 입력") {
        `when`("compute 호출") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> {
                    ActionWeightedScore.compute(-1, 0, 0, 0)
                }
            }
        }
    }
})
