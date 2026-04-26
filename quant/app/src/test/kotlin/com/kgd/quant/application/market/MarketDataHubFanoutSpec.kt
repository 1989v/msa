package com.kgd.quant.application.market

import com.kgd.quant.application.port.marketdata.Symbol
import com.kgd.quant.application.port.marketdata.Tick
import com.kgd.quant.application.port.marketdata.TickSource
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import java.math.BigDecimal
import java.time.Instant

/**
 * TG-P2-07.4 — MarketDataHubFanoutSpec.
 *
 * 다중 구독자가 동일 tick 을 동시 수신하는지 검증한다 (in-process broadcast).
 */
class MarketDataHubFanoutSpec : BehaviorSpec({

    Given("MarketDataHub with two subscribers") {
        val metrics = QuantMetrics(SimpleMeterRegistry())
        val hub = MarketDataHub(metrics)

        When("두 구독자가 동시에 asFlow() 를 구독하고 producer 가 3개 tick 을 발행") {
            Then("두 구독자 모두 동일 3개 tick 을 수신한다") {
                runBlocking {
                    val flow = hub.asFlow()

                    val collector1 = async { flow.take(3).toList() }
                    val collector2 = async { flow.take(3).toList() }

                    // 두 구독자가 실제로 subscribe 될 때까지 잠깐 대기
                    waitUntil { hub.subscriberCount() >= 2 }

                    sampleTicks(3).forEach { hub.emit(it) }

                    val received1 = collector1.await()
                    val received2 = collector2.await()

                    received1 shouldHaveSize 3
                    received2 shouldHaveSize 3
                    received1.map { it.price } shouldBe received2.map { it.price }
                }
            }
        }
    }
})

private suspend fun waitUntil(timeoutMs: Long = 1_000L, condition: () -> Boolean) {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (!condition() && System.currentTimeMillis() < deadline) {
        delay(10)
    }
}

internal fun sampleTicks(count: Int, basePrice: Long = 30_000_000L): List<Tick> =
    (0 until count).map { i ->
        Tick(
            symbol = Symbol("BTC_KRW"),
            price = BigDecimal.valueOf(basePrice + i),
            volume = BigDecimal.ONE,
            timestamp = Instant.parse("2026-04-26T00:00:0${i}Z"),
            source = TickSource.WS,
        )
    }
