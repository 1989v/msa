package com.kgd.quant.infrastructure.outbox

import com.kgd.quant.infrastructure.metrics.QuantMetrics
import com.kgd.quant.infrastructure.persistence.repository.OutboxJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Profile
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit

private val log = KotlinLogging.logger {}

/**
 * TG-08.6 / TG-P2-12: Outbox → Kafka relay 스케줄러.
 *
 * ## Phase 1 → Phase 2 전환
 * Phase 1 에서는 log-only 였으나 (Kafka 인프라 미배포), TG-P2-12 부터 실 publish 를 수행한다.
 * `quant.outbox.relay.enabled=true` 일 때만 publish 가 활성화되며,
 * `KafkaTemplate` bean 이 없는 환경(테스트, Phase 1 backtest-only) 에서는 자동으로 비활성화된다.
 *
 * ## 처리 흐름 (ADR-0015 §5)
 * 1. `published_at IS NULL` row 를 1초 간격으로 polling (top 100, occurred_at ASC).
 * 2. 각 row 를 단순 generic 토픽 `quant.events.v1` 으로 publish (key = `eventId`).
 *    - 정밀 토픽 매핑(`quant.{aggregate}.{event}.v1`) 은 후속 PR 에서 [topicMapping] 확장.
 * 3. publish ack 수신 시 `published_at = NOW()` 업데이트 (eventId 단위 batch update).
 * 4. publish 실패 시 published_at 미세팅 → 다음 polling 사이클에서 재시도.
 *
 * ## Profile
 * 테스트 프로파일에서는 스케줄러가 돌지 않도록 `@Profile("!test")` 로 제한한다.
 *
 * ## @Transactional (ADR-0020)
 * 클래스 레벨 `@Transactional` 없음. publish 는 외부 IO 이므로 트랜잭션 밖에서 합성하고,
 * `markPublished` 만 [TransactionTemplate] 으로 단독 트랜잭션을 연다 (Modifying JPQL 요구사항 충족).
 *
 * ## 단순화 / TODO
 * - `failure_count` 컬럼 (Flyway V004) + DLQ 분기 + 임계 초과 시 RISK 알림 enqueue 는 후속 PR.
 * - 이벤트 type → 토픽 정밀 매핑 ([topicMapping]) 은 후속 PR.
 * - Idempotent consumer ([com.kgd.common.messaging.IdempotentEventHandler]) 활용은 후속 (Phase 3 외부 통합 시 본격 도입).
 */
@Component
@Profile("!test")
class OutboxRelay(
    private val outboxRepo: OutboxJpaRepository,
    private val kafkaTemplateProvider: ObjectProvider<KafkaTemplate<String, String>>,
    private val metrics: QuantMetrics,
    private val transactionTemplate: TransactionTemplate,
    @Value("\${quant.outbox.relay.enabled:false}")
    private val enabled: Boolean,
    @Value("\${quant.outbox.relay.topic:quant.events.v1}")
    private val defaultTopic: String,
    @Value("\${quant.outbox.relay.publish-timeout-seconds:5}")
    private val publishTimeoutSeconds: Long,
) {

    @Scheduled(fixedDelay = POLL_INTERVAL_MS)
    fun relay() {
        if (!enabled) return
        val template = kafkaTemplateProvider.ifAvailable
        if (template == null) {
            log.debug { "outbox relay enabled but KafkaTemplate is unavailable — skipping cycle" }
            return
        }

        val batch = outboxRepo.findTop100ByPublishedAtIsNullOrderByOccurredAtAsc()
        if (batch.isEmpty()) return

        val publishedEventIds = mutableListOf<UUID>()
        for (entity in batch) {
            val topic = topicMapping(entity.eventType)
            try {
                template.send(topic, entity.eventId.toString(), entity.payload)
                    .get(publishTimeoutSeconds, TimeUnit.SECONDS)
                publishedEventIds.add(entity.eventId)
                metrics.outboxPublished(topic)
            } catch (e: Exception) {
                metrics.outboxPublishFailed(topic)
                log.warn {
                    "outbox publish failed eventId=${entity.eventId} topic=$topic " +
                        "reason=${e.message}"
                }
            }
        }

        if (publishedEventIds.isNotEmpty()) {
            try {
                transactionTemplate.execute {
                    outboxRepo.markPublished(publishedEventIds, Instant.now())
                }
            } catch (e: Exception) {
                // markPublished 실패 시 다음 polling 에서 중복 publish 가 발생할 수 있다.
                // 컨슈머 측 멱등성 (processed_event 기반 common IdempotentEventHandler) 으로 방어된다 (ADR-0012, ADR-0029).
                log.warn { "outbox markPublished failed size=${publishedEventIds.size} reason=${e.message}" }
            }
        }
    }

    /**
     * 이벤트 type → Kafka 토픽 매핑.
     *
     * Phase 2 단순화: 모든 이벤트는 generic [defaultTopic] 으로 발행한다 (consumer 측에서 type 분기).
     * 후속 PR 에서 `quant.{aggregate}.{event}.v1` 정밀 매핑으로 확장 가능 — 본 메서드만 수정하면 된다.
     */
    fun topicMapping(eventType: String): String = defaultTopic

    companion object {
        const val POLL_INTERVAL_MS: Long = 1_000L
    }
}
