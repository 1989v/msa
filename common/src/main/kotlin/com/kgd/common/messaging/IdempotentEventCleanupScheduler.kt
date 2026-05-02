package com.kgd.common.messaging

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.scheduling.annotation.Scheduled
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * ADR-0029 Verification Follow-up §1 — `processed_event` retention 스케줄러.
 *
 * 기본 매일 03:30 Asia/Seoul 에 [IdempotentEventCleanupProperties.retention] 보다 오래된 row 삭제.
 *
 * - cron 표현은 [IdempotentEventCleanupProperties.cron] 으로 override.
 * - 멀티 인스턴스 환경에서 동시 실행 시에도 안전 (DELETE 는 idempotent). shedlock 도입은 후속 PR.
 */
class IdempotentEventCleanupScheduler(
    private val port: ProcessedEventRepositoryPort,
    private val properties: IdempotentEventCleanupProperties,
) {

    @Scheduled(
        cron = "\${kgd.common.messaging.idempotent.cleanup.cron:0 30 3 * * *}",
        zone = "\${kgd.common.messaging.idempotent.cleanup.zone:Asia/Seoul}",
    )
    fun cleanup() {
        val cutoff = Instant.now().minus(properties.retention)
        try {
            val deleted = port.deleteOlderThan(cutoff)
            log.info { "idempotent cleanup deleted=$deleted cutoff=$cutoff retention=${properties.retention}" }
        } catch (t: Throwable) {
            log.error(t) { "idempotent cleanup failed cutoff=$cutoff" }
            throw t
        }
    }
}
