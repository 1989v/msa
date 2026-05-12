package com.kgd.common.statistics

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe

class WilsonTest : BehaviorSpec({

    given("total=0 일 때") {
        `when`("lowerConfidenceBound 호출") {
            then("0.0 을 반환한다") {
                Wilson.lowerConfidenceBound(positives = 0, total = 0) shouldBe 0.0
                Wilson.lowerConfidenceBound(positives = 0, total = -1) shouldBe 0.0
            }
        }
    }

    given("CTR 5% (positives=500, total=10000) 처럼 노출이 충분할 때") {
        `when`("z=1.96 (95% 신뢰) 으로 계산") {
            then("empirical (0.05) 에 가까운 LCB 가 나온다 — 약 0.046") {
                val lcb = Wilson.lowerConfidenceBound(positives = 500, total = 10000)
                lcb shouldBeGreaterThan 0.045
                lcb shouldBeLessThan 0.048
            }
        }
    }

    given("CTR 50% (positives=5, total=10) 처럼 노출이 적을 때") {
        `when`("LCB 계산") {
            then("empirical(0.5) 보다 크게 하향된다 — 약 0.23") {
                val lcb = Wilson.lowerConfidenceBound(positives = 5, total = 10)
                lcb shouldBeGreaterThan 0.20
                lcb shouldBeLessThan 0.27
            }
        }
    }

    given("CTR 100% (positives=1, total=1) — 극단적 sparse") {
        `when`("LCB 계산") {
            then("empirical(1.0) 보다 매우 크게 하향된다 — 약 0.21") {
                val lcb = Wilson.lowerConfidenceBound(positives = 1, total = 1)
                lcb shouldBeGreaterThan 0.15
                lcb shouldBeLessThan 0.27
            }
        }
    }

    given("노출이 많은 5% 와 노출이 적은 50% 와 노출 1번의 100%") {
        `when`("LCB ranking 비교") {
            then("empirical 순위 (100% > 50% > 5%) 가 LCB 에서는 (5% > 50% > 100%) 로 역전된다") {
                val lcbHighVolume = Wilson.lowerConfidenceBound(500, 10000)
                val lcbMidVolume = Wilson.lowerConfidenceBound(5, 10)
                val lcbLowVolume = Wilson.lowerConfidenceBound(1, 1)

                // 노출 적은 50% / 100% 는 노출 많은 5% 보다 보수적으로 하향되어,
                // ranking 시 노출 적은 쪽이 위로 올라오는 함정을 방지한다.
                lcbMidVolume shouldBeGreaterThan lcbHighVolume
                lcbLowVolume shouldBeGreaterThan lcbHighVolume
                // 1번 관측은 10번 관측보다 더 보수적이어야 한다
                lcbLowVolume shouldBeLessThan lcbMidVolume
            }
        }
    }

    given("z 파라미터") {
        `when`("99% 신뢰 (z=2.576) vs 95% (z=1.96)") {
            then("99% 신뢰가 더 보수적 (LCB 더 낮음)") {
                val ninetyFive = Wilson.lowerConfidenceBound(5, 10, z = 1.96)
                val ninetyNine = Wilson.lowerConfidenceBound(5, 10, z = 2.576)
                ninetyNine shouldBeLessThan ninetyFive
            }
        }
    }

    given("positives 가 total 을 초과") {
        `when`("호출") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> {
                    Wilson.lowerConfidenceBound(positives = 11, total = 10)
                }
            }
        }
        `when`("음수 positives") {
            then("IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> {
                    Wilson.lowerConfidenceBound(positives = -1, total = 10)
                }
            }
        }
    }
})
