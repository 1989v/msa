package com.kgd.quant.infrastructure.messaging

import com.kgd.common.exception.BusinessException
import org.apache.kafka.common.TopicPartition
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.util.backoff.FixedBackOff

/**
 * TG-P2-11.6 — Kafka Consumer DLQ (ADR-0015 §2 표준 정책).
 *
 * - 1초 고정 backoff × 3회 재시도 후 `{원본토픽}.DLT` 토픽으로 전달.
 * - 단, [BusinessException] / [IllegalArgumentException] 은 재시도 없이 즉시 DLT 로 전달 (ADR-0015 §2).
 * - `RECORD` Ack mode 는 [org.springframework.boot.autoconfigure.kafka.KafkaProperties] 에서 별도 지정.
 *
 * ## 등록 조건
 * `spring.kafka.bootstrap-servers` 가 명시된 환경에서만 활성화 (Phase 1 backtest-only 배포 보호).
 *
 * ## ADR-0012 멱등성 컨슈머와의 관계
 * DLQ 재처리 시에도 `processed_event` 테이블 기반 멱등성으로 중복 방어된다.
 * 본 빈은 DLQ 라우팅까지만 책임지고, consumer 측 idempotency 는 common 의 [com.kgd.common.messaging.IdempotentEventHandler] 가 담당한다 (ADR-0029).
 *
 * ## Phase 2 단순화
 * - DLQ Consumer (알림 발송, 재처리 API) 는 후속 PR.
 */
@Configuration
@ConditionalOnProperty(
    name = ["spring.kafka.bootstrap-servers"],
    matchIfMissing = false,
)
class KafkaConsumerErrorHandlerConfiguration {

    @Bean
    fun defaultErrorHandler(kafkaTemplate: KafkaTemplate<String, String>): DefaultErrorHandler {
        val recoverer = DeadLetterPublishingRecoverer(kafkaTemplate) { record, _ ->
            TopicPartition(record.topic() + DLT_SUFFIX, record.partition())
        }
        return DefaultErrorHandler(recoverer, FixedBackOff(BACKOFF_INTERVAL_MS, MAX_RETRIES)).apply {
            // ADR-0015 §2: 비즈니스 예외와 입력 검증 예외는 재시도 무의미 → 즉시 DLT.
            addNotRetryableExceptions(
                BusinessException::class.java,
                IllegalArgumentException::class.java,
            )
        }
    }

    companion object {
        const val DLT_SUFFIX: String = ".DLT"
        const val BACKOFF_INTERVAL_MS: Long = 1_000L
        const val MAX_RETRIES: Long = 3L
    }
}
