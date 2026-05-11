package com.kgd.search.bandit

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe
import kotlin.math.abs

/**
 * BetaSampler 의 분포 특성 검증.
 *
 * Beta(α, β) 의 이론 평균 = α / (α + β).
 * 충분히 많은 샘플을 뽑으면 표본 평균이 이론 평균에 근접한다.
 */
class BetaSamplerTest : BehaviorSpec({

    given("Beta sampling 의 분포 특성") {

        `when`("Beta(1,1) — uninformative prior") {
            then("샘플은 0~1 범위 안") {
                repeat(10_000) {
                    val s = BetaSampler.sample(1.0, 1.0)
                    s.shouldBeGreaterThan(0.0)
                    s.shouldBeLessThan(1.0)
                }
            }
        }

        `when`("Beta(101, 901) — 강한 데이터 (CTR ≈ 10%)") {
            then("표본 평균이 0.1 근처에 좁게 모인다") {
                val n = 5_000
                var sum = 0.0
                var aboveQuarter = 0
                repeat(n) {
                    val s = BetaSampler.sample(101.0, 901.0)
                    sum += s
                    if (s > 0.25) aboveQuarter += 1
                }
                val mean = sum / n
                abs(mean - 0.1).shouldBeLessThan(0.02)
                // 좁은 분포라 25% 초과 샘플은 0.1% 미만이어야 한다
                (aboveQuarter < n / 1000).shouldBe(true)
            }
        }

        `when`("Beta(2, 2) — 약한 데이터 (uncertainty 큼)") {
            then("표본 평균은 0.5 근처, 그러나 분산이 크다") {
                val n = 5_000
                var sum = 0.0
                var nearExtremes = 0
                repeat(n) {
                    val s = BetaSampler.sample(2.0, 2.0)
                    sum += s
                    if (s < 0.1 || s > 0.9) nearExtremes += 1
                }
                val mean = sum / n
                abs(mean - 0.5).shouldBeLessThan(0.05)
                // 좁은 Beta(101,901) 대비 극단 샘플이 훨씬 많이 나와야 한다
                (nearExtremes > n / 20).shouldBe(true)
            }
        }

        `when`("Beta(α<1, β<1)") {
            then("샘플은 여전히 0~1 안") {
                repeat(2_000) {
                    val s = BetaSampler.sample(0.3, 0.7)
                    s.shouldBeGreaterThan(0.0)
                    s.shouldBeLessThan(1.0)
                }
            }
        }
    }
})
