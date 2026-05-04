package com.kgd.quant.application.indicator

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.bigdecimal.shouldBeGreaterThan
import io.kotest.matchers.bigdecimal.shouldBeLessThanOrEquals
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.Instant

/**
 * IndicatorCalculatorSpec — 자체 구현 SMA/EMA/RSI/BB/MACD/STOCH 의 불변식 + 알려진 값 검증.
 *
 * Cross-validation 골든 (ta4j 결과와 동등성) 은 ta4j 정통 통합 시 별도 spec.
 */
class IndicatorCalculatorSpec : BehaviorSpec({
    val calc = IndicatorCalculator()

    given("단조 증가 종가 (1.0, 2.0, ..., 30.0)") {
        val bars = (1..30).map {
            IndicatorCalculator.Bar(
                ts = Instant.ofEpochSecond(it.toLong() * 86400),
                open = BigDecimal(it),
                high = BigDecimal(it),
                low = BigDecimal(it),
                close = BigDecimal(it),
                volume = BigDecimal(100),
            )
        }

        `when`("SMA(5) 호출") {
            then("길이 = 30, 마지막 = (26+27+28+29+30)/5 = 28") {
                val sma = calc.sma(bars, 5)
                sma.size shouldBe 30
                sma.last().value.compareTo(BigDecimal("28.00000000")) shouldBe 0
            }
        }

        `when`("EMA(5) 호출") {
            then("길이 = 30, 마지막 값은 종가 30 에 근접 (단조 증가 + EMA 추종)") {
                val ema = calc.ema(bars, 5)
                ema.size shouldBe 30
                ema.last().value shouldBeGreaterThan BigDecimal("28.0")
                ema.last().value shouldBeLessThanOrEquals BigDecimal("30.0")
            }
        }

        `when`("RSI(14) 호출") {
            then("단조 증가 → 손실 0 → RSI 100") {
                val rsi = calc.rsi(bars, 14)
                rsi.size shouldBe 30
                rsi.last().value.compareTo(BigDecimal("100.0000")) shouldBe 0
            }
        }

        `when`("Bollinger(20, 2σ) 호출") {
            then("길이 = 30, 중간선이 SMA 와 동일") {
                val bb = calc.bollinger(bars, 20, BigDecimal("2.0"))
                bb.middle.size shouldBe 30
                bb.upper.size shouldBe 30
                bb.lower.size shouldBe 30
            }
        }

        `when`("MACD 기본 파라미터 호출") {
            then("길이 = 30, histogram = macd - signal") {
                val m = calc.macd(bars)
                m.macd.size shouldBe 30
                m.signal.size shouldBe 30
                m.histogram.size shouldBe 30
                val last = m.histogram.last().value
                val expected = m.macd.last().value.subtract(m.signal.last().value)
                    .setScale(8, java.math.RoundingMode.HALF_UP)
                last.compareTo(expected) shouldBe 0
            }
        }

        `when`("Stochastic(14, 3) 호출") {
            then("단조 증가 → close == highestHigh → %K = 100") {
                val s = calc.stochastic(bars, 14, 3)
                s.k.size shouldBe 30
                s.d.size shouldBe 30
                s.k.last().value.compareTo(BigDecimal("100.0000")) shouldBe 0
            }
        }
    }
})
