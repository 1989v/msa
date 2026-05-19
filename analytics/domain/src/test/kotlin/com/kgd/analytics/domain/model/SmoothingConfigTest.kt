package com.kgd.analytics.domain.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe

class SmoothingConfigTest : BehaviorSpec({

    Given("SmoothingConfig(alpha=1, beta=9) — 10% prior") {
        val cfg = SmoothingConfig(alpha = 1.0, beta = 9.0)

        When("denominator 가 0 일 때") {
            Then("prior mean (alpha/(alpha+beta)) = 0.1 로 수렴") {
                cfg.smooth(0, 0) shouldBe 0.1
            }
        }

        When("denominator 가 매우 클 때 (1만)") {
            Then("smoothed ≈ raw 비율 (예: 1000/10000)") {
                val smoothed = cfg.smooth(1000, 10000)
                val raw = 1000.0 / 10000.0
                kotlin.math.abs(smoothed - raw) shouldBeLessThan 0.001
            }
        }
    }

    Given("음수 입력") {
        val cfg = SmoothingConfig()

        When("numerator < 0") {
            Then("require 위반으로 예외") {
                try {
                    cfg.smooth(-1, 10)
                    error("require 가 발생하지 않음")
                } catch (e: IllegalArgumentException) {
                    e.message shouldBe "counts must be >= 0"
                }
            }
        }
    }

    Given("SmoothingConfig.NONE") {
        val none = SmoothingConfig.NONE

        When("clicks=50, impressions=1000") {
            Then("raw 와 거의 동일") {
                val smoothed = none.smooth(50, 1000)
                val raw = 50.0 / 1000.0
                kotlin.math.abs(smoothed - raw) shouldBeLessThan 1e-6
            }
        }
    }

    Given("invalid prior") {
        When("alpha <= 0") {
            Then("require 위반") {
                try {
                    SmoothingConfig(alpha = 0.0, beta = 1.0)
                    error("require 가 발생하지 않음")
                } catch (e: IllegalArgumentException) {
                    e.message shouldBe "alpha/beta must be > 0"
                }
            }
        }
    }
})
