package com.kgd.common.messaging.outbox

import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.header.internals.RecordHeader
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import java.time.Clock
import java.time.LocalDateTime
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/**
 * `outbox_event` 를 Kafka 로 옮기는 릴레이. 여러 인스턴스가 같은 테이블을 돌아도 한 행은 한 번만 보낸다.
 *
 * 1. 트랜잭션 A — 차례가 된 행을 최대 [BATCH_SIZE] 개 `FOR UPDATE SKIP LOCKED` 로 집어 SENDING + 리스로 바꾸고 커밋.
 *    다른 릴레이는 잠긴 행을 건너뛰고, 커밋 뒤에는 SENDING 이라 집지 않는다.
 * 2. 트랜잭션 밖 — 동기 전송. 배치 전체가 [SEND_TIMEOUT_MS] 안에 끝나야 한다(리스보다 짧게).
 * 3. 트랜잭션 B — PUBLISHED, 또는 시도 수를 올리고 백오프 뒤로 미룬다. [MAX_ATTEMPTS] 번째 실패면 FAILED.
 *
 * 전송 중 프로세스가 죽으면 행은 SENDING 으로 남고 리스가 끝나면 다른 릴레이가 다시 집는다(at-least-once —
 * 컨슈머는 payload 의 `eventId` 로 중복을 거른다, ADR-0012).
 *
 * 트랜잭션은 도메인 TM 으로 연다 — commerce 폴드에서 스키마마다 TM 이 따로라 기본 TM 에 붙으면 잠금이 안 걸린다.
 */
class OutboxPollingPublisher(
    private val name: String,
    private val outboxRepository: OutboxRepository,
    private val kafkaTemplate: KafkaTemplate<String, String>,
    transactionManager: PlatformTransactionManager,
    private val objectMapper: ObjectMapper,
    private val metrics: OutboxMetrics = OutboxMetrics.NOOP,
    private val clock: Clock = Clock.systemDefaultZone(),
) {
    private val log = KotlinLogging.logger {}

    // READ COMMITTED: REPEATABLE READ 에서는 `status` 인덱스를 훑으며 잡은 갭 잠금과, 행을 SENDING 으로 옮기며
    // 그 인덱스에 새 항목을 넣는 잠금이 릴레이끼리 엇갈려 교착이 난다(통합 테스트에서 재현).
    private val tx = TransactionTemplate(transactionManager).apply {
        isolationLevel = TransactionDefinition.ISOLATION_READ_COMMITTED
    }

    @Scheduled(
        fixedDelayString = "\${outbox.polling.interval-ms:1000}",
        initialDelayString = "\${outbox.polling.initial-delay-ms:0}",
    )
    fun publishPendingEvents() {
        val claimed = claim()
        if (claimed.isNotEmpty()) {
            val outcomes = send(claimed)
            tx.executeWithoutResult { outcomes.forEach(::settle) }
        }
        refreshBacklog()
    }

    @Scheduled(
        fixedDelayString = "\${outbox.cleanup.interval-ms:3600000}",
        initialDelayString = "\${outbox.cleanup.initial-delay-ms:60000}",
    )
    fun purgePublished(): Int {
        val cutoff = now().minusDays(RETENTION_DAYS)
        var total = 0
        do {
            val deleted = tx.execute { outboxRepository.deletePublishedBefore(cutoff, PURGE_BATCH_SIZE) } ?: 0
            total += deleted
        } while (deleted >= PURGE_BATCH_SIZE)
        if (total > 0) log.info { "Purged $total published outbox rows: outbox=$name, before=$cutoff" }
        return total
    }

    private fun claim(): List<OutboxEntity> = tx.execute {
        val now = now()
        val rows = outboxRepository.findClaimable(now, BATCH_SIZE)
        if (rows.isNotEmpty()) {
            outboxRepository.markSending(rows.mapNotNull { it.id }, now.plusSeconds(LEASE_SECONDS))
        }
        rows
    }.orEmpty()

    private fun send(rows: List<OutboxEntity>): List<Outcome> {
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(SEND_TIMEOUT_MS)
        val inFlight = rows.map { row ->
            // 앞선 send 가 메타데이터 대기로 기한을 다 쓴 경우 — 나머지는 시도로 치지 않고 되돌린다.
            if (System.nanoTime() >= deadline) return@map row to null
            row to runCatching { kafkaTemplate.send(toRecord(row)) }
                .getOrElse { CompletableFuture.failedFuture(it) }
        }
        return inFlight.map { (row, future) ->
            if (future == null) return@map Outcome(row, sent = false, error = null)
            val remaining = (deadline - System.nanoTime()).coerceAtLeast(0)
            runCatching { future.get(remaining, TimeUnit.NANOSECONDS) }
                .fold(
                    onSuccess = { Outcome(row, sent = true, error = null) },
                    onFailure = { Outcome(row, sent = true, error = it) },
                )
        }
    }

    private fun toRecord(row: OutboxEntity): ProducerRecord<String, String> {
        val payload = (objectMapper.readTree(row.payload) as ObjectNode)
            .put("eventId", row.eventId)
            .let(objectMapper::writeValueAsString)
        val headers = row.headers
            ?.let { objectMapper.readTree(it).properties() }
            ?.map { (key, value) -> RecordHeader(key, value.asString().toByteArray()) }
            .orEmpty()
        val key = row.partitionKey ?: row.aggregateId.toString()
        return ProducerRecord(row.eventType, null, key, payload, headers)
    }

    private fun settle(outcome: Outcome) {
        val row = outcome.row
        val id = requireNotNull(row.id)
        val now = now()
        when {
            !outcome.sent -> outboxRepository.settle(id, PENDING, row.attempts, row.nextAttemptAt, null)
            outcome.error == null -> {
                outboxRepository.settle(id, PUBLISHED, row.attempts, null, now)
                metrics.incrementPublishSuccess()
                log.debug { "Published outbox event: outbox=$name, id=$id, type=${row.eventType}" }
            }
            else -> {
                val attempts = row.attempts + 1
                metrics.incrementPublishError()
                if (attempts >= MAX_ATTEMPTS) {
                    outboxRepository.settle(id, FAILED, attempts, null, null)
                    log.error(outcome.error) {
                        "Outbox event gave up after $attempts attempts: outbox=$name, id=$id, type=${row.eventType}"
                    }
                } else {
                    outboxRepository.settle(id, PENDING, attempts, now.plusSeconds(backoffSeconds(attempts)), null)
                    log.warn(outcome.error) {
                        "Outbox publish failed, will retry: outbox=$name, id=$id, type=${row.eventType}, attempts=$attempts"
                    }
                }
            }
        }
    }

    private fun refreshBacklog() {
        runCatching { outboxRepository.countUnpublishedByStatus() }
            .onSuccess { counts ->
                val byStatus = counts.associate { it.status to it.count }
                metrics.recordBacklog(
                    outbox = name,
                    backlog = (byStatus[PENDING] ?: 0) + (byStatus[SENDING] ?: 0),
                    failed = byStatus[FAILED] ?: 0,
                )
            }
            .onFailure { log.warn(it) { "Outbox backlog count failed: outbox=$name" } }
    }

    private fun now(): LocalDateTime = LocalDateTime.now(clock)

    private data class Outcome(val row: OutboxEntity, val sent: Boolean, val error: Throwable?)

    companion object {
        const val BATCH_SIZE = 100
        const val LEASE_SECONDS = 30L
        const val SEND_TIMEOUT_MS = 10_000L
        const val MAX_ATTEMPTS = 10
        const val RETENTION_DAYS = 7L
        const val PURGE_BATCH_SIZE = 1000
        private const val MAX_BACKOFF_SECONDS = 300L

        const val PENDING = "PENDING"
        const val SENDING = "SENDING"
        const val PUBLISHED = "PUBLISHED"
        const val FAILED = "FAILED"

        /** 1초에서 두 배씩, 5분 상한. 10번째 실패까지 약 8분 반. */
        fun backoffSeconds(attempts: Int): Long = minOf(1L shl (attempts - 1).coerceIn(0, 30), MAX_BACKOFF_SECONDS)
    }
}
