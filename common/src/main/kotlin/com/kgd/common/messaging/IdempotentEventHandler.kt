package com.kgd.common.messaging

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant
import java.util.UUID

private val log = KotlinLogging.logger {}

/**
 * ADR-0029 — Kafka consumer 측 멱등성 헬퍼 (ADR-0012 보강).
 *
 * ## 동작
 * `(eventId, consumerGroup)` 단위로 [ProcessedEventRepositoryPort] 를 조회/마킹한다.
 *
 * ```kotlin
 * @KafkaListener(...)
 * fun onEvent(record: ConsumerRecord<String, String>) {
 *     idempotentHandler.process(eventId, "inventory-service") {
 *         // 비즈니스 처리 — 호출자가 트랜잭션 경계 결정
 *     }
 * }
 * ```
 *
 * ## 처리 흐름 (Policy A — 분리)
 * 1. `existsBy(eventId, consumerGroup)` → true 면 [Outcome.SKIPPED] 반환.
 * 2. 미존재면 [block] 실행 — 호출자의 트랜잭션 경계에 따른다.
 * 3. 마킹 INSERT 만 [TransactionTemplate] 단독 트랜잭션.
 *    - PK 충돌(`DataIntegrityViolationException`) 은 다른 instance 가 동시에 처리한 race
 *      → silent skip + [Outcome.RACE] 반환.
 *
 * ## @Transactional (ADR-0020)
 * 본 헬퍼는 클래스 레벨 `@Transactional` 을 선언하지 않는다. 비즈니스 처리(`block`)와 마킹은
 * 별도 트랜잭션이며, 외부 IO 가 들어와도 호출자의 트랜잭션 점유 시간이 늘어나지 않는다.
 *
 * ## 호출자 책임
 * - `block` 자체는 자연 멱등이거나 DB UNIQUE/Optimistic Lock 으로 보호되어야 한다 (ADR-0029 §3 Policy A).
 * - eventId 누락 시 호출자가 graceful degrade 결정 ([IdempotentMetrics.missingId] 사용 권장).
 */
class IdempotentEventHandler(
    private val processedEventRepo: ProcessedEventRepositoryPort,
    private val transactionTemplate: TransactionTemplate,
    private val metrics: IdempotentMetrics? = null,
) {

    /**
     * @param eventId       도메인 이벤트 UUID.
     * @param consumerGroup Kafka consumer group (예: "inventory-service").
     * @param block         비즈니스 처리 블록. 미처리 시에만 실행.
     * @return [Outcome] (PROCESSED / SKIPPED / RACE).
     * @throws Throwable    `block` 또는 마킹 INSERT 가 던진 예외 (멱등 무관 예외) 는 전파.
     */
    fun process(
        eventId: UUID,
        consumerGroup: String,
        block: () -> Unit,
    ): Outcome {
        if (processedEventRepo.existsBy(eventId, consumerGroup)) {
            log.debug { "idempotent skip eventId=$eventId consumerGroup=$consumerGroup" }
            metrics?.skipped(consumerGroup)
            return Outcome.SKIPPED
        }

        try {
            block()
        } catch (t: Throwable) {
            metrics?.error(consumerGroup)
            throw t
        }

        return try {
            transactionTemplate.execute {
                processedEventRepo.mark(
                    ProcessedEventRecord(
                        eventId = eventId,
                        consumerGroup = consumerGroup,
                        processedAt = Instant.now(),
                    )
                )
            }
            metrics?.processed(consumerGroup)
            Outcome.PROCESSED
        } catch (e: DataIntegrityViolationException) {
            log.debug {
                "idempotent marking concurrent insert eventId=$eventId consumerGroup=$consumerGroup " +
                    "reason=${e.message}"
            }
            metrics?.race(consumerGroup)
            Outcome.RACE
        }
    }

    /**
     * 처리 결과. true/false boolean 보다 의도가 명확하고 메트릭 result tag 와 일치.
     */
    enum class Outcome {
        /** 신규 처리 + 마킹 성공. */
        PROCESSED,

        /** 이미 처리된 이벤트 (existsBy=true). */
        SKIPPED,

        /** 다른 instance 가 동시 INSERT — `block` 은 이미 수행됨, 마킹은 흡수. */
        RACE;

        /** Boolean 호환성 — true = 신규 처리(흡수 포함), false = skip. */
        fun isHandled(): Boolean = this != SKIPPED
    }
}
