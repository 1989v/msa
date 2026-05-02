package com.kgd.common.messaging.outbox

import com.fasterxml.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult
import java.util.concurrent.CompletableFuture

class OutboxPollingPublisherSpec : BehaviorSpec({

    given("OutboxPollingPublisher") {
        val repository = mockk<OutboxRepository>(relaxed = true)
        every { repository.save(any<OutboxEntity>()) } answers { firstArg() }
        val kafkaTemplate = mockk<KafkaTemplate<String, Any>>()
        val objectMapper = ObjectMapper()
        val metrics = mockk<OutboxMetrics>(relaxed = true)
        val publisher = OutboxPollingPublisher(repository, kafkaTemplate, objectMapper, metrics)

        `when`("PENDING row 가 없으면") {
            every { repository.findAllByStatusOrderByCreatedAtAsc("PENDING") } returns emptyList()

            then("Kafka 호출 없이 종료하고 pending gauge 가 0 으로 갱신된다") {
                publisher.publishPendingEvents()
                verify(exactly = 0) { kafkaTemplate.send(any<String>(), any<String>(), any()) }
                verify(exactly = 1) { metrics.recordPendingCount(0L) }
            }
        }

        `when`("PENDING row 발행이 성공하면") {
            val row = OutboxEntity(
                id = 1L,
                aggregateType = "FulfillmentOrder",
                aggregateId = 42L,
                eventType = "fulfillment.order.created",
                payload = """{"orderId":42}""",
            )
            every { repository.findAllByStatusOrderByCreatedAtAsc("PENDING") } returns listOf(row)
            val future = CompletableFuture<SendResult<String, Any>>()
            future.complete(mockk(relaxed = true))
            every { kafkaTemplate.send(any<String>(), any<String>(), any()) } returns future

            then("payload 에 eventId 가 enrichment 되어 발행되고 status 가 PUBLISHED 로 갱신된다") {
                val payloadCaptor = slot<Any>()

                publisher.publishPendingEvents()

                verify(exactly = 1) {
                    kafkaTemplate.send(
                        "fulfillment.order.created",
                        "42",
                        capture(payloadCaptor),
                    )
                }
                val enriched = payloadCaptor.captured.toString()
                enriched.contains("\"eventId\"") shouldBe true
                enriched.contains(row.eventId) shouldBe true

                row.status shouldBe "PUBLISHED"
                (row.publishedAt != null) shouldBe true
                verify(exactly = 1) { repository.save(row) }
                verify(exactly = 1) { metrics.incrementPublishSuccess() }
                verify(exactly = 1) { metrics.recordPendingCount(1L) }
            }
        }

        `when`("Kafka future 가 실패하면") {
            val row = OutboxEntity(
                id = 2L,
                aggregateType = "FulfillmentOrder",
                aggregateId = 99L,
                eventType = "fulfillment.order.cancelled",
                payload = """{"orderId":99}""",
            )
            every { repository.findAllByStatusOrderByCreatedAtAsc("PENDING") } returns listOf(row)
            val future = CompletableFuture<SendResult<String, Any>>()
            future.completeExceptionally(RuntimeException("broker down"))
            every { kafkaTemplate.send(any<String>(), any<String>(), any()) } returns future

            then("status 는 PENDING 으로 유지되고 error metric 이 증가한다") {
                publisher.publishPendingEvents()

                row.status shouldBe "PENDING"
                row.publishedAt shouldBe null
                verify(exactly = 1) { metrics.incrementPublishError() }
            }
        }
    }
})
