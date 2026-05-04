package com.kgd.quant.domain.live

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import java.time.Instant

/**
 * KillSwitch — 3-레벨 비상 정지 (ADR-0037 Phase 3).
 *
 * Global / Tenant / Strategy 3 레벨. 어느 한 레벨이라도 ON 이면 해당 범위의 신규 주문 차단.
 *
 * 저장:
 * - Redis (저지연 read, ≤200ms 반영) — 키: `quant:kill-switch:global`,
 *   `quant:kill-switch:tenant:{tenantId}`, `quant:kill-switch:strategy:{strategyId}`
 * - MySQL `kill_switch_log` (append-only, 감사)
 *
 * 도메인 레벨에서는 sealed 식별 + 상태 표현만 책임. Redis/JPA 는 인프라 레이어.
 */
sealed interface KillSwitch {
    val enabled: Boolean
    val toggledAt: Instant
    val actorId: Long
    val reason: String?

    data class Global(
        override val enabled: Boolean,
        override val toggledAt: Instant,
        override val actorId: Long,
        override val reason: String?,
    ) : KillSwitch

    data class Tenant(
        val tenantId: TenantId,
        override val enabled: Boolean,
        override val toggledAt: Instant,
        override val actorId: Long,
        override val reason: String?,
    ) : KillSwitch

    data class Strategy(
        val strategyId: StrategyId,
        override val enabled: Boolean,
        override val toggledAt: Instant,
        override val actorId: Long,
        override val reason: String?,
    ) : KillSwitch
}

/**
 * 3 레벨 결합 평가 — 하나라도 ON 이면 차단 결과.
 */
data class KillSwitchSnapshot(
    val global: Boolean,
    val tenant: Boolean,
    val strategy: Boolean,
) {
    val anyEnabled: Boolean = global || tenant || strategy
}
