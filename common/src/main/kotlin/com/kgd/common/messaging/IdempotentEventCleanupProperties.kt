package com.kgd.common.messaging

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * ADR-0029 Verification Follow-up §1 — `processed_event` retention 스케줄러 설정.
 *
 * ## Properties
 * - `kgd.common.messaging.idempotent.cleanup.enabled` (default `false`) — opt-in.
 * - `kgd.common.messaging.idempotent.cleanup.retention` (default `P7D`) — ADR-0012 7일 보관 정책.
 * - `kgd.common.messaging.idempotent.cleanup.cron` (default `0 30 3 * * *`) — Asia/Seoul 03:30.
 * - `kgd.common.messaging.idempotent.cleanup.zone` (default `Asia/Seoul`).
 */
@ConfigurationProperties(prefix = "kgd.common.messaging.idempotent.cleanup")
data class IdempotentEventCleanupProperties(
    val enabled: Boolean = false,
    val retention: Duration = Duration.ofDays(7),
    val cron: String = "0 30 3 * * *",
    val zone: String = "Asia/Seoul",
)
