package com.kgd.common.messaging

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionStatus
import org.springframework.transaction.support.SimpleTransactionStatus
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

class IdempotentEventHandlerSpec : BehaviorSpec({

    Given("IdempotentEventHandler — 미처리 이벤트") {
        val (port, txTemplate, metrics, handler) = newHandler()
        val eventId = UUID.randomUUID()
        val group = "inventory-service"
        every { port.existsBy(eventId, group) } returns false
        every { port.mark(any()) } returns Unit
        var blockCalled = 0

        When("process() 호출") {
            val outcome = handler.process(eventId, group) { blockCalled++ }

            Then("block 1회 + mark 1회 + PROCESSED 반환") {
                blockCalled shouldBe 1
                outcome shouldBe IdempotentEventHandler.Outcome.PROCESSED
                outcome.isHandled() shouldBe true
                verify(exactly = 1) { port.mark(match { it.eventId == eventId && it.consumerGroup == group }) }
                metrics.processedCount(group) shouldBe 1.0
            }
        }
    }

    Given("IdempotentEventHandler — 이미 처리된 이벤트 (existsBy=true)") {
        val (port, _, metrics, handler) = newHandler()
        val eventId = UUID.randomUUID()
        val group = "order-service"
        every { port.existsBy(eventId, group) } returns true
        var blockCalled = 0

        When("process() 호출") {
            val outcome = handler.process(eventId, group) { blockCalled++ }

            Then("block 호출 안 됨 + SKIPPED 반환 + skipped 메트릭 1") {
                blockCalled shouldBe 0
                outcome shouldBe IdempotentEventHandler.Outcome.SKIPPED
                outcome.isHandled() shouldBe false
                verify(exactly = 0) { port.mark(any()) }
                metrics.skippedCount(group) shouldBe 1.0
            }
        }
    }

    Given("IdempotentEventHandler — mark 가 DataIntegrityViolationException (race)") {
        val (port, _, metrics, handler) = newHandler()
        val eventId = UUID.randomUUID()
        val group = "fulfillment-service"
        every { port.existsBy(eventId, group) } returns false
        every { port.mark(any()) } throws DataIntegrityViolationException("dup pk")
        var blockCalled = 0

        When("process() 호출") {
            val outcome = handler.process(eventId, group) { blockCalled++ }

            Then("block 1회 + RACE 반환 (예외 흡수) + race 메트릭 1") {
                blockCalled shouldBe 1
                outcome shouldBe IdempotentEventHandler.Outcome.RACE
                outcome.isHandled() shouldBe true
                metrics.raceCount(group) shouldBe 1.0
            }
        }
    }

    Given("IdempotentEventHandler — mark 가 일반 RuntimeException") {
        val (port, _, _, handler) = newHandler()
        val eventId = UUID.randomUUID()
        val group = "inventory-service"
        every { port.existsBy(eventId, group) } returns false
        every { port.mark(any()) } throws IllegalStateException("db down")

        When("process() 호출") {
            Then("예외 전파 (호출자가 offset commit 안 하도록)") {
                shouldThrow<IllegalStateException> {
                    handler.process(eventId, group) { /* ok */ }
                }
            }
        }
    }

    Given("IdempotentEventHandler — block 이 예외") {
        val (port, _, metrics, handler) = newHandler()
        val eventId = UUID.randomUUID()
        val group = "inventory-service"
        every { port.existsBy(eventId, group) } returns false

        When("process() 호출") {
            Then("mark 호출 안 됨 + 예외 전파 + error 메트릭 1") {
                shouldThrow<IllegalArgumentException> {
                    handler.process(eventId, group) { throw IllegalArgumentException("boom") }
                }
                verify(exactly = 0) { port.mark(any()) }
                metrics.errorCount(group) shouldBe 1.0
            }
        }
    }

    Given("IdempotentEventCleanupScheduler") {
        val port = mockk<ProcessedEventRepositoryPort>(relaxed = true)
        val props = IdempotentEventCleanupProperties(enabled = true)
        val scheduler = IdempotentEventCleanupScheduler(port, props)
        every { port.deleteOlderThan(any()) } returns 42

        When("cleanup() 호출") {
            scheduler.cleanup()

            Then("retention 만큼 과거 cutoff 으로 deleteOlderThan 호출") {
                verify(exactly = 1) {
                    port.deleteOlderThan(match { cutoff ->
                        // cutoff 가 거의 7일 전 (오차 5초 이내)
                        val expected = java.time.Instant.now().minus(props.retention)
                        kotlin.math.abs(java.time.Duration.between(cutoff, expected).seconds) <= 5
                    })
                }
            }
        }
    }

    Given("IdempotentMetrics — missingId") {
        val registry = SimpleMeterRegistry()
        val metrics = IdempotentMetrics(registry)

        When("missingId 호출 2회") {
            metrics.missingId("inventory-service")
            metrics.missingId("inventory-service")

            Then("missing 메트릭 카운터 2") {
                val counter = registry.find(IdempotentMetrics.MISSING_METRIC_NAME)
                    .tag("consumer_group", "inventory-service")
                    .counter()
                counter?.count() shouldBe 2.0
            }
        }
    }
})

private data class TestRig(
    val port: ProcessedEventRepositoryPort,
    val txTemplate: TransactionTemplate,
    val metrics: MetricsProbe,
    val handler: IdempotentEventHandler,
)

/**
 * 메트릭 호출 빈도를 검사하기 위한 thin probe — IdempotentMetrics 가 final 이므로
 * 별도 [SimpleMeterRegistry] 를 노출해 직접 counter 를 lookup 한다.
 */
private class MetricsProbe(val registry: SimpleMeterRegistry, val delegate: IdempotentMetrics) {
    fun processedCount(group: String) = lookup(group, "processed")
    fun skippedCount(group: String) = lookup(group, "skipped")
    fun raceCount(group: String) = lookup(group, "race")
    fun errorCount(group: String) = lookup(group, "error")

    private fun lookup(group: String, result: String): Double =
        registry.find(IdempotentMetrics.PROCESSED_METRIC_NAME)
            .tag("consumer_group", group)
            .tag("result", result)
            .counter()?.count() ?: 0.0
}

private fun newHandler(): TestRig {
    val port = mockk<ProcessedEventRepositoryPort>()
    val txManager = mockk<PlatformTransactionManager>()
    every { txManager.getTransaction(any()) } returns SimpleTransactionStatus()
    every { txManager.commit(any<TransactionStatus>()) } returns Unit
    every { txManager.rollback(any<TransactionStatus>()) } returns Unit
    val txTemplate = TransactionTemplate(txManager)
    val registry = SimpleMeterRegistry()
    val metrics = IdempotentMetrics(registry)
    val handler = IdempotentEventHandler(port, txTemplate, metrics)
    return TestRig(port, txTemplate, MetricsProbe(registry, metrics), handler)
}
