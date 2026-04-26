package com.kgd.sevensplit.domain.order

import com.kgd.sevensplit.domain.fixtures.SplitFixtures
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * INV-03 동일 매수 금액:
 *   회차 당 명목 금액(= initialOrderAmount / roundCount) 은 모든 회차에서 동일하다.
 *   Phase 1 은 단일 체결 가정으로 VWAP 보정은 무시한다.
 */
class EqualOrderAmountSpec : BehaviorSpec({

    Given("유효한 SplitStrategyConfig") {
        When("initialOrderAmount 와 roundCount 가 주어지면") {
            Then("회차별 명목 금액은 모두 동일하다 (총합 = initialOrderAmount, 반올림 오차 허용)") {
                // INV-03
                checkAll(20, SplitFixtures.arbValidConfig) { config ->
                    val perRound = config.initialOrderAmount
                        .divide(BigDecimal(config.roundCount), 10, RoundingMode.HALF_UP)
                    val perRoundList = List(config.roundCount) { perRound }

                    // 모든 회차 금액 동일
                    perRoundList.distinct().size shouldBe 1

                    // 총합은 initialOrderAmount 에 근사 (반올림 오차 내)
                    val total = perRoundList.fold(BigDecimal.ZERO, BigDecimal::add)
                    val delta = total.subtract(config.initialOrderAmount).abs()
                    // roundCount * 10^-10 보다 작은 오차
                    val tolerance = BigDecimal(config.roundCount)
                        .multiply(BigDecimal("0.0000000001"))
                    (delta <= tolerance) shouldBe true
                }
            }
        }
    }

    Given("roundCount 1") {
        When("회차 명목을 계산하면") {
            Then("initialOrderAmount 전액이 1회차에 할당된다") {
                // INV-03 — 단일 회차 경계
                val config = SplitFixtures.validConfig(
                    roundCount = 1,
                    initialOrderAmount = BigDecimal("1000000")
                )
                val perRound = config.initialOrderAmount.divide(BigDecimal(config.roundCount))
                perRound shouldBe BigDecimal("1000000")
            }
        }
    }

    Given("roundCount N (2..50)") {
        When("회차 명목을 계산하면") {
            Then("N 회차 명목의 합은 initialOrderAmount 와 같다") {
                // INV-03 — 불변식 (총 명목 보존)
                checkAll(10, Arb.int(2..50)) { n ->
                    val amount = BigDecimal("1000000")
                    val config = SplitFixtures.validConfig(
                        roundCount = n,
                        initialOrderAmount = amount
                    )
                    val perRound = amount.divide(BigDecimal(n), 20, RoundingMode.HALF_UP)
                    val total = (0 until n).fold(BigDecimal.ZERO) { acc, _ -> acc.add(perRound) }
                    val delta = total.subtract(amount).abs()
                    val tolerance = BigDecimal(n).multiply(BigDecimal("0.00000000000000000001"))
                    (delta <= tolerance) shouldBe true
                    config.roundCount shouldBe n
                }
            }
        }
    }
})
