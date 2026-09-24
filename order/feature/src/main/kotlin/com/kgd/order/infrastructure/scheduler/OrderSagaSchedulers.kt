package com.kgd.order.infrastructure.scheduler

import com.kgd.order.application.order.usecase.CleanupIdempotencyKeysUseCase
import com.kgd.order.application.saga.usecase.ProcessSagaDeadlineUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * 사가 기한 점검 — 기한이 지난 사가마다 한 트랜잭션. 한 건이 실패해도 나머지는 계속한다(다음 주기에 다시 본다).
 * 여러 인스턴스가 같은 사가를 동시에 보면 `@Version` 이 한쪽을 되돌리고 그쪽은 다시 읽어 NOT_DUE 로 끝난다.
 */
@Component
class OrderSagaDeadlineScheduler(
    private val deadlines: ProcessSagaDeadlineUseCase,
    @Value("\${order.saga.deadline-batch-size:50}") private val batchSize: Int,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(
        fixedDelayString = "\${order.saga.deadline-check-interval-ms:5000}",
        initialDelayString = "\${order.saga.deadline-initial-delay-ms:10000}",
    )
    fun run() {
        deadlines.dueOrderIds(batchSize).forEach { orderId ->
            runCatching { deadlines.onDeadline(orderId) }
                .onFailure { log.error(it) { "사가 기한 처리 실패: orderId=$orderId" } }
        }
    }
}

/** 보관 기한(24시간)이 지난 Idempotency-Key 삭제 */
@Component
class IdempotencyKeyCleanupScheduler(
    private val cleanup: CleanupIdempotencyKeysUseCase,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(fixedDelayString = "\${order.idempotency.cleanup-interval-ms:3600000}", initialDelayString = "\${order.idempotency.cleanup-initial-delay-ms:60000}")
    fun run() {
        val deleted = cleanup.cleanup()
        if (deleted > 0) log.info { "만료된 멱등 키 삭제: $deleted" }
    }
}
