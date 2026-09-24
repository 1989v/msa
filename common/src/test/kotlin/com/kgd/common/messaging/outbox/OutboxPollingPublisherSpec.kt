package com.kgd.common.messaging.outbox

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.apache.kafka.clients.producer.ProducerRecord
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult
import org.springframework.transaction.PlatformTransactionManager
import tools.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.concurrent.CompletableFuture

class OutboxPollingPublisherSpec : BehaviorSpec({

    val clock = Clock.fixed(Instant.parse("2026-09-24T00:00:00Z"), ZoneOffset.UTC)
    val now = LocalDateTime.now(clock)
    val repository = mockk<OutboxRepository>(relaxed = true)
    val kafkaTemplate = mockk<KafkaTemplate<String, String>>()
    val metrics = mockk<OutboxMetrics>(relaxed = true)
    val publisher = OutboxPollingPublisher(
        name = "order",
        outboxRepository = repository,
        kafkaTemplate = kafkaTemplate,
        transactionManager = mockk<PlatformTransactionManager>(relaxed = true),
        objectMapper = ObjectMapper(),
        metrics = metrics,
        clock = clock,
    )

    fun row(id: Long, partitionKey: String? = null, headers: String? = null, attempts: Int = 0) = OutboxEntity(
        id = id,
        aggregateType = "Order",
        aggregateId = 42L,
        eventType = "order.order.completed",
        payload = """{"orderId":42}""",
        partitionKey = partitionKey,
        headers = headers,
        attempts = attempts,
    )

    fun sendSucceeds() {
        every { kafkaTemplate.send(any<ProducerRecord<String, String>>()) } returns
            CompletableFuture.completedFuture(mockk<SendResult<String, String>>(relaxed = true))
    }

    fun sendFails() {
        every { kafkaTemplate.send(any<ProducerRecord<String, String>>()) } returns
            CompletableFuture.failedFuture(RuntimeException("broker down"))
    }

    beforeEach { clearMocks(repository, kafkaTemplate, metrics, answers = true) }

    given("집을 행이 있는 릴레이") {
        `when`("partition_key 와 headers 가 있는 행의 발행이 성공하면") {
            then("레코드 키는 partition_key, 헤더는 복원, 값은 eventId 가 붙은 원문 JSON 이고 PUBLISHED 로 정산된다") {
                val r = row(1L, partitionKey = "order-7", headers = """{"traceparent":"00-abc-def-01"}""")
                every { repository.findClaimable(now, 100) } returns listOf(r)
                sendSucceeds()
                val record = slot<ProducerRecord<String, String>>()

                publisher.publishPendingEvents()

                verify { kafkaTemplate.send(capture(record)) }
                record.captured.topic() shouldBe "order.order.completed"
                record.captured.key() shouldBe "order-7"
                record.captured.value() shouldStartWith "{"
                ObjectMapper().readTree(record.captured.value()).get("eventId").asString() shouldBe r.eventId
                String(record.captured.headers().lastHeader("traceparent").value()) shouldBe "00-abc-def-01"
                verify { repository.markSending(listOf(1L), now.plusSeconds(30)) }
                verify { repository.settle(1L, "PUBLISHED", 0, null, now) }
            }
        }

        `when`("partition_key 가 비어 있으면") {
            then("aggregateId 가 레코드 키가 된다") {
                every { repository.findClaimable(now, 100) } returns listOf(row(2L))
                sendSucceeds()
                val record = slot<ProducerRecord<String, String>>()

                publisher.publishPendingEvents()

                verify { kafkaTemplate.send(capture(record)) }
                record.captured.key() shouldBe "42"
            }
        }

        `when`("발행이 실패하고 시도가 3회 쌓여 있었으면") {
            then("PENDING 으로 되돌리고 시도 4회 · 다음 시도는 백오프 뒤로 잡는다") {
                every { repository.findClaimable(now, 100) } returns listOf(row(3L, attempts = 3))
                sendFails()

                publisher.publishPendingEvents()

                verify { repository.settle(3L, "PENDING", 4, now.plusSeconds(8), null) }
                verify { metrics.incrementPublishError() }
            }
        }

        `when`("10번째 시도도 실패하면") {
            then("FAILED 로 멈추고 다시 집지 않는다") {
                every { repository.findClaimable(now, 100) } returns listOf(row(4L, attempts = 9))
                sendFails()

                publisher.publishPendingEvents()

                verify { repository.settle(4L, "FAILED", 10, null, null) }
            }
        }
    }

    given("정리 스케줄") {
        `when`("purgePublished 가 돌면") {
            then("7일 넘은 PUBLISHED 만 배치로 지운다") {
                every { repository.deletePublishedBefore(any(), any()) } returns 3

                publisher.purgePublished() shouldBe 3

                verify { repository.deletePublishedBefore(now.minusDays(7), 1000) }
            }
        }
    }
})
