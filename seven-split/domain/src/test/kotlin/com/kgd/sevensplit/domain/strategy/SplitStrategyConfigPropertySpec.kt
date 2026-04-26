package com.kgd.sevensplit.domain.strategy

import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.exception.SplitStrategyConfigInvalidException
import com.kgd.sevensplit.domain.fixtures.SplitFixtures
import io.kotest.assertions.throwables.shouldNotThrow
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bigDecimal
import io.kotest.property.arbitrary.filter
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.map
import io.kotest.property.checkAll
import java.math.BigDecimal

/**
 * INV-07: SplitStrategyConfig 불변식 property-based 검증.
 *
 *  - roundCount ∈ [1, 50]
 *  - entryGapPercent < 0
 *  - takeProfitPercentPerRound.size == roundCount, 모든 원소 > 0
 *  - initialOrderAmount > 0
 *  - targetSymbol not blank
 */
class SplitStrategyConfigPropertySpec : BehaviorSpec({

    Given("임의의 유효 입력") {
        When("SplitFixtures.arbValidConfig 로부터 생성하면") {
            Then("항상 INV-07 을 만족하는 config 가 만들어진다") {
                // INV-07
                checkAll(20, SplitFixtures.arbValidConfig) { config ->
                    config.roundCount shouldBe config.takeProfitPercentPerRound.size
                    (config.roundCount in 1..50) shouldBe true
                    config.entryGapPercent.isNegative() shouldBe true
                    config.takeProfitPercentPerRound.all { it.isPositive() } shouldBe true
                    (config.initialOrderAmount > BigDecimal.ZERO) shouldBe true
                }
            }
        }
    }

    Given("roundCount 가 [1, 50] 범위 밖") {
        When("SplitStrategyConfig 를 생성하면") {
            Then("SplitStrategyConfigInvalidException 이 발생한다") {
                // INV-07
                checkAll(20, Arb.int(-100..200).filter { it !in 1..50 }) { invalidCount ->
                    shouldThrow<SplitStrategyConfigInvalidException> {
                        SplitStrategyConfig(
                            roundCount = invalidCount,
                            entryGapPercent = Percent.of("-3"),
                            takeProfitPercentPerRound = List(
                                invalidCount.coerceAtLeast(1)
                            ) { Percent.of("10") },
                            initialOrderAmount = BigDecimal("100000"),
                            targetSymbol = SplitFixtures.DEFAULT_SYMBOL
                        )
                    }
                }
            }
        }
    }

    Given("entryGapPercent 가 0 이상") {
        When("SplitStrategyConfig 를 생성하면") {
            Then("SplitStrategyConfigInvalidException 이 발생한다") {
                // INV-07
                val arbNonNegative = Arb.bigDecimal(BigDecimal.ZERO, BigDecimal("50"))
                    .map { Percent(it) }
                checkAll(20, arbNonNegative) { gap ->
                    shouldThrow<SplitStrategyConfigInvalidException> {
                        SplitFixtures.validConfig(entryGapPercent = gap)
                    }
                }
            }
        }
    }

    Given("takeProfitPercentPerRound 의 길이가 roundCount 와 다르거나, 원소 중 0 이하") {
        When("SplitStrategyConfig 를 생성하면") {
            Then("SplitStrategyConfigInvalidException 이 발생한다") {
                // INV-07 — 길이 불일치
                shouldThrow<SplitStrategyConfigInvalidException> {
                    SplitStrategyConfig(
                        roundCount = 7,
                        entryGapPercent = Percent.of("-3"),
                        takeProfitPercentPerRound = List(6) { Percent.of("10") },
                        initialOrderAmount = BigDecimal("100000"),
                        targetSymbol = SplitFixtures.DEFAULT_SYMBOL
                    )
                }
                // INV-07 — 0 또는 음수 원소 포함
                shouldThrow<SplitStrategyConfigInvalidException> {
                    SplitStrategyConfig(
                        roundCount = 3,
                        entryGapPercent = Percent.of("-3"),
                        takeProfitPercentPerRound = listOf(
                            Percent.of("10"),
                            Percent.ZERO,
                            Percent.of("10")
                        ),
                        initialOrderAmount = BigDecimal("100000"),
                        targetSymbol = SplitFixtures.DEFAULT_SYMBOL
                    )
                }
            }
        }
    }

    Given("initialOrderAmount 가 0 이하이거나 targetSymbol 이 공백") {
        When("SplitStrategyConfig 를 생성하면") {
            Then("SplitStrategyConfigInvalidException 이 발생한다") {
                // INV-07
                shouldThrow<SplitStrategyConfigInvalidException> {
                    SplitFixtures.validConfig(initialOrderAmount = BigDecimal.ZERO)
                }
                shouldThrow<SplitStrategyConfigInvalidException> {
                    SplitFixtures.validConfig(initialOrderAmount = BigDecimal("-10"))
                }
                shouldThrow<SplitStrategyConfigInvalidException> {
                    SplitFixtures.validConfig(targetSymbol = "   ")
                }
            }
        }
    }

    Given("경계값 1 / 50 roundCount") {
        When("허용 경계로 SplitStrategyConfig 를 생성하면") {
            Then("예외 없이 생성된다") {
                // INV-07 — 경계 포함 검증
                shouldNotThrow<Throwable> {
                    SplitFixtures.validConfig(roundCount = 1)
                }
                shouldNotThrow<Throwable> {
                    SplitFixtures.validConfig(roundCount = 50)
                }
            }
        }
    }
})
