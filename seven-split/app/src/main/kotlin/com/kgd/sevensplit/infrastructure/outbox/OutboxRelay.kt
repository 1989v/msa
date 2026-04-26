package com.kgd.sevensplit.infrastructure.outbox

import com.kgd.sevensplit.infrastructure.persistence.repository.OutboxJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.annotation.Profile
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * TG-08.6: Outbox relay 스케줄러.
 *
 * Phase 1 에서는 Kafka 실발행을 하지 않고, 미발행 배치 크기만 주기적으로 로깅한다. Phase 2 에서
 * `KafkaTemplate<String, String>` 을 주입받아 payload 를 그대로 발행하고, 성공 시
 * `markPublished(eventIds, now)` 로 published_at 을 기록한다.
 *
 * ## Profile
 * 테스트 프로파일에서는 스케줄러가 돌지 않도록 `@Profile("!test")` 로 제한한다.
 *
 * ## @Transactional
 * 클래스 레벨 `@Transactional` 없음 (ADR-0020). read-only 스캔은 자체 트랜잭션으로 실행됨.
 */
@Component
@Profile("!test")
class OutboxRelay(
    private val outboxRepo: OutboxJpaRepository,
    // private val kafkaTemplate: KafkaTemplate<String, String>,  // Phase 2 에서 활성화
) {

    @Scheduled(fixedDelay = 1000L)
    fun relay() {
        val batch = outboxRepo.findTop100ByPublishedAtIsNullOrderByOccurredAtAsc()
        if (batch.isEmpty()) return

        log.info {
            "outbox batch size=${batch.size} (Phase 1 placeholder — no real Kafka publish)"
        }
        // Phase 2:
        //   batch.forEach { kafkaTemplate.send(topicFor(it.eventType), it.payload) }
        //   outboxRepo.markPublished(batch.map { it.eventId }, Instant.now())
    }
}
