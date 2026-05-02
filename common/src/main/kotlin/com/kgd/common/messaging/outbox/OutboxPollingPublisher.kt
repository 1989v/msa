package com.kgd.common.messaging.outbox

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.slf4j.LoggerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.scheduling.annotation.Scheduled
import java.time.LocalDateTime

/**
 * Polls `outbox_event` for PENDING rows and publishes them to Kafka.
 *
 * Schedule:
 * - `@Scheduled(fixedDelayString = "\${outbox.polling.interval-ms:1000}")` (default 1s)
 * - 활성화 토글은 [KgdMessagingOutboxAutoConfiguration] 의 `outbox.polling.enabled` (default `true`).
 *
 * 발행 시 message body 안에 `eventId` 가 enrichment 되어 consumer 측에서 [com.kgd.common.messaging.outbox.OutboxEntity.eventId]
 * 를 그대로 멱등 키로 사용할 수 있다 (ADR-0012).
 *
 * at-least-once: Kafka future 실패 시 row 는 PENDING 으로 유지되어 다음 polling 에 재시도된다.
 * 프로세스 crash 시에도 commit 된 PENDING row 가 그대로 남아 재기동 후 자동 발행된다.
 */
class OutboxPollingPublisher(
    private val outboxRepository: OutboxRepository,
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    private val objectMapper: ObjectMapper,
    private val metrics: OutboxMetrics = OutboxMetrics.NOOP,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedDelayString = "\${outbox.polling.interval-ms:1000}")
    fun publishPendingEvents() {
        val events = outboxRepository.findAllByStatusOrderByCreatedAtAsc("PENDING")
        if (events.isEmpty()) return

        log.debug("Found {} pending outbox events", events.size)

        for (event in events) {
            try {
                val enrichedPayload = objectMapper.readTree(event.payload).let { node ->
                    (node as ObjectNode).put("eventId", event.eventId)
                    objectMapper.writeValueAsString(node)
                }
                kafkaTemplate.send(event.eventType, event.aggregateId.toString(), enrichedPayload)
                    .whenComplete { _, ex ->
                        if (ex != null) {
                            log.error(
                                "Failed to publish outbox event id={}, type={}",
                                event.id,
                                event.eventType,
                                ex,
                            )
                            metrics.incrementPublishError()
                        } else {
                            event.status = "PUBLISHED"
                            event.publishedAt = LocalDateTime.now()
                            outboxRepository.save(event)
                            metrics.incrementPublishSuccess()
                            log.info(
                                "Published outbox event: id={}, type={}, aggregateId={}",
                                event.id,
                                event.eventType,
                                event.aggregateId,
                            )
                        }
                    }
            } catch (e: Exception) {
                log.error("Failed to publish outbox event id={}, type={}", event.id, event.eventType, e)
                metrics.incrementPublishError()
            }
        }
    }
}
