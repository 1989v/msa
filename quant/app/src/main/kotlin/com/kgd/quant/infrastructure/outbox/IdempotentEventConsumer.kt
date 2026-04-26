package com.kgd.quant.infrastructure.outbox

import com.kgd.quant.infrastructure.persistence.entity.ProcessedEventEntity
import com.kgd.quant.infrastructure.persistence.entity.ProcessedEventId
import com.kgd.quant.infrastructure.persistence.repository.ProcessedEventJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant
import java.util.UUID

private val log = KotlinLogging.logger {}

/**
 * TG-P2-12.4 — Kafka consumer 측 멱등성 헬퍼 (ADR-0012).
 *
 * ## 동작
 * `(eventId, consumerGroup)` 단위로 `processed_event` 테이블을 조회/마킹한다.
 *
 * ```kotlin
 * @KafkaListener(...)
 * fun onEvent(record: ConsumerRecord<String, String>) {
 *     idempotentConsumer.process(eventId, "quant-notification") {
 *         // 비즈니스 처리
 *     }
 * }
 * ```
 *
 * ## 처리 흐름
 * 1. `(eventId, consumerGroup)` lookup → 존재하면 skip.
 * 2. 미존재면 [block] 실행 → INSERT 마킹.
 * 3. INSERT 시 PK 충돌은 다른 instance 가 동시에 처리한 것이므로 silent skip.
 *
 * ## @Transactional (ADR-0020)
 * 본 헬퍼는 클래스 레벨 `@Transactional` 을 선언하지 않는다. 비즈니스 처리(`block`)와 마킹은
 * 별도 트랜잭션이며, 호출자가 비즈니스 처리 트랜잭션 경계를 결정한다 (외부 IO 분리 원칙).
 *
 * 마킹 INSERT 만 [TransactionTemplate] 으로 단독 트랜잭션을 연다 — 호출자의 ThreadLocal 컨텍스트와
 * 충돌하지 않도록 `PROPAGATION_REQUIRES_NEW` 도 검토했으나 Phase 2 단순화를 위해 default
 * (호출자 트랜잭션이 있으면 참여, 없으면 신규 생성) 를 사용한다.
 *
 * ## Phase 2 단순화
 * - 본 PR 은 헬퍼만 제공하며, 실제 컨슈머에 적용하는 wire-up 은 Phase 3 외부 통합 시 본격 도입한다.
 *   (Phase 1 / Phase 2 outbox relay 는 publisher-only.)
 */
@Component
class IdempotentEventConsumer(
    private val processedEventRepo: ProcessedEventJpaRepository,
    private val transactionTemplate: TransactionTemplate,
) {

    /**
     * @param eventId        도메인 이벤트 UUID (Kafka record key 또는 payload field).
     * @param consumerGroup  Kafka consumer group (예: `quant-notification`).
     * @param block          비즈니스 처리 블록. 미처리 시에만 실행.
     * @return true = 신규 처리, false = 이미 처리됨 (skip)
     */
    fun process(
        eventId: UUID,
        consumerGroup: String,
        block: () -> Unit,
    ): Boolean {
        val pk = ProcessedEventId(eventId = eventId, consumerGroup = consumerGroup)
        val already = processedEventRepo.existsById(pk)
        if (already) {
            log.debug { "idempotent skip eventId=$eventId consumerGroup=$consumerGroup" }
            return false
        }

        block()

        return try {
            transactionTemplate.execute {
                processedEventRepo.save(
                    ProcessedEventEntity(
                        eventId = eventId,
                        consumerGroup = consumerGroup,
                        processedAt = Instant.now(),
                    )
                )
            }
            true
        } catch (e: DataIntegrityViolationException) {
            // 다른 instance 가 동시에 마킹한 경우. 비즈니스 처리는 이미 수행되었으므로 정상으로 간주.
            log.debug {
                "idempotent marking concurrent insert eventId=$eventId consumerGroup=$consumerGroup " +
                    "reason=${e.message}"
            }
            true
        }
    }
}
